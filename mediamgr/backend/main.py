import asyncio
import os
from datetime import datetime, timezone
from typing import Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, APIRouter, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware

import database
import scanner
import encoder
import storage
import cloudflare
from models import CreateJobRequest, TunnelControlRequest, UpdateIngressRequest

app = FastAPI(title="MediaMgr")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")
AUTH_TOKEN = os.environ.get("AUTH_TOKEN", "")

router = APIRouter(prefix="/mediamgr")


# ─── Auth middleware ──────────────────────────────────────────────────────────

def _is_authed(request: Request) -> bool:
    if not AUTH_TOKEN:
        return True
    # Own token cookie
    if request.cookies.get("mm_auth") == AUTH_TOKEN:
        return True
    # Shared unidash session cookie (unidash sets unidash_auth=1; Path=/ on login)
    if request.cookies.get("unidash_auth") == "1":
        return True
    # Authorization header (curl / API use)
    if request.headers.get("Authorization") == f"Bearer {AUTH_TOKEN}":
        return True
    return False


@app.middleware("http")
async def auth_middleware(request: Request, call_next):
    path = request.url.path
    # Always allow: assets, login endpoint, WebSocket upgrade (checked inside handler)
    if (not AUTH_TOKEN
            or path.startswith("/mediamgr/assets/")
            or path == "/mediamgr/auth/login"):
        return await call_next(request)
    if not _is_authed(request):
        # API / WS → 401 JSON so the frontend can detect and show login
        if path.startswith("/mediamgr/api/") or path.startswith("/mediamgr/ws/"):
            return JSONResponse(status_code=401, content={"detail": "Unauthorized"})
        # SPA routes → still serve index.html; the JS will detect 401 and show login
        return await call_next(request)
    return await call_next(request)


# ─── Auth endpoints ───────────────────────────────────────────────────────────

@app.post("/mediamgr/auth/login")
async def auth_login(request: Request):
    body = await request.json()
    token = body.get("token", "")
    if not AUTH_TOKEN or token == AUTH_TOKEN:
        resp = JSONResponse({"ok": True})
        # Own session cookie
        resp.set_cookie("mm_auth", token, httponly=True, samesite="lax",
                        max_age=60 * 60 * 24 * 7, path="/")  # 7 days, matches unidash
        # Shared unidash session cookie — unidash checks cookieAuth === '1'
        resp.set_cookie("unidash_auth", "1", httponly=False, samesite="lax",
                        max_age=60 * 60 * 24 * 7, path="/")
        return resp
    raise HTTPException(status_code=401, detail="Invalid token")


@app.post("/mediamgr/auth/logout")
async def auth_logout():
    resp = JSONResponse({"ok": True})
    resp.delete_cookie("mm_auth", path="/")
    resp.delete_cookie("unidash_auth", path="/")
    return resp


@app.on_event("startup")
async def startup():
    await database.init_db()
    try:
        await storage.take_snapshot()
    except Exception:
        pass
    asyncio.create_task(encoder.process_queue())
    asyncio.create_task(storage.snapshot_scheduler())


# ─── Files ───────────────────────────────────────────────────────────────────

@router.get("/api/files")
async def list_files(
    folder: Optional[str] = None,
    codec: Optional[str] = None,
    resolution: Optional[str] = None,
    audio: Optional[str] = None,
    search: Optional[str] = None,
    suggested_action: Optional[str] = None,
    limit: Optional[int] = 100,
    offset: Optional[int] = 0,
    sort_by: Optional[str] = "size_bytes",
    sort_dir: Optional[str] = "desc",
):
    files, total = await database.get_files(
        folder=folder, codec=codec, resolution=resolution,
        audio=audio, search=search, suggested_action=suggested_action,
        limit=limit, offset=offset, sort_by=sort_by, sort_dir=sort_dir,
    )
    return {"items": files, "total": total, "limit": limit, "offset": offset}


@router.delete("/api/files/{file_id}")
async def delete_file(file_id: int):
    rec = await database.get_file_by_id(file_id)
    if not rec:
        raise HTTPException(status_code=404, detail="File not found")
    try:
        os.remove(rec["path"])
    except FileNotFoundError:
        pass
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    await database.delete_file_record(file_id)
    return {"ok": True}


# ─── Scanner ─────────────────────────────────────────────────────────────────

_scan_task: Optional[asyncio.Task] = None


@router.post("/api/scan")
async def start_scan():
    global _scan_task
    if scanner.get_scan_status()["running"]:
        return {"ok": False, "message": "Scan already running"}
    _scan_task = asyncio.create_task(scanner.run_scan())
    return {"ok": True}


@router.get("/api/scan/status")
async def scan_status():
    return scanner.get_scan_status()


# ─── Jobs ─────────────────────────────────────────────────────────────────────

@router.post("/api/jobs")
async def create_job(req: CreateJobRequest):
    rec = await database.get_file_by_id(req.file_id)
    if not rec:
        raise HTTPException(status_code=404, detail="File not found")

    if req.action not in ("reencode", "remux", "downscale", "delete"):
        raise HTTPException(status_code=400, detail="Invalid action")

    existing = await database.get_active_job_for_file(req.file_id)
    if existing:
        raise HTTPException(status_code=409, detail="A job is already pending or running for this file")

    created_at = datetime.now(timezone.utc).isoformat()
    job_id = await database.create_job(
        file_id=req.file_id,
        filename=rec["filename"],
        action=req.action,
        size_before=rec["size_bytes"],
        created_at=created_at,
    )
    return {"id": job_id, "status": "pending"}


@router.get("/api/jobs")
async def list_jobs():
    return await database.get_jobs()


@router.delete("/api/jobs/{job_id}")
async def cancel_job(job_id: int):
    job = await database.get_job_by_id(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job["status"] not in ("pending", "running"):
        raise HTTPException(status_code=400, detail="Job cannot be cancelled")
    await encoder.kill_running_job(job_id)
    await database.update_job(
        job_id,
        status="cancelled",
        finished_at=datetime.now(timezone.utc).isoformat()
    )
    return {"ok": True}


# ─── Storage ─────────────────────────────────────────────────────────────────

@router.get("/api/storage")
async def get_storage():
    info = await storage.get_storage_info()
    stats = await database.get_stats()
    return {"folders": info, "stats": stats}


@router.get("/api/storage/history")
async def get_storage_history(days: int = 30):
    return await database.get_storage_history(days=days)


# ─── WebSocket ────────────────────────────────────────────────────────────────

@router.websocket("/ws/jobs/{job_id}")
async def ws_job_progress(websocket: WebSocket, job_id: int):
    await websocket.accept()
    q = encoder.subscribe(job_id)

    job = await database.get_job_by_id(job_id)
    if job:
        await websocket.send_json({
            "pct": job["progress"],
            "eta_s": job["eta_s"],
            "status": job["status"],
        })
        if job["status"] in ("done", "failed", "reverted", "cancelled"):
            encoder.unsubscribe(job_id, q)
            await websocket.close()
            return

    try:
        while True:
            try:
                msg = await asyncio.wait_for(q.get(), timeout=30)
                await websocket.send_json(msg)
                if msg.get("status") in ("done", "failed", "reverted", "cancelled"):
                    break
            except asyncio.TimeoutError:
                await websocket.send_json({"ping": True})
    except WebSocketDisconnect:
        pass
    finally:
        encoder.unsubscribe(job_id, q)


# ─── Cloudflare tunnels ───────────────────────────────────────────────────────

@router.get("/api/cf/tunnels")
async def cf_list_tunnels():
    return await cloudflare.list_tunnels()


@router.post("/api/cf/tunnels/{name}/control")
async def cf_control_tunnel(name: str, req: TunnelControlRequest):
    result = await cloudflare.control_tunnel(name, req.action)
    if not result["ok"]:
        raise HTTPException(status_code=500, detail=result.get("error", "Unknown error"))
    return result


@router.get("/api/cf/tunnels/{name}/logs")
async def cf_get_logs(name: str, lines: int = 150):
    return await cloudflare.get_logs(name, lines)


@router.get("/api/cf/tunnels/{name}/config")
async def cf_get_config(name: str):
    cfg = await cloudflare.get_config(name)
    if cfg is None:
        raise HTTPException(status_code=404, detail="Config not found")
    return cfg


@router.put("/api/cf/tunnels/{name}/ingress")
async def cf_update_ingress(name: str, req: UpdateIngressRequest):
    rules = [r.model_dump(exclude_none=True) for r in req.rules]
    result = await cloudflare.update_ingress(name, rules)
    if not result["ok"]:
        raise HTTPException(status_code=500, detail=result.get("error", "Unknown error"))
    return result


@router.websocket("/ws/cf/tunnels/{name}/logs")
async def ws_cf_logs(websocket: WebSocket, name: str):
    await websocket.accept()
    try:
        await cloudflare.stream_logs(websocket, name)
    except WebSocketDisconnect:
        pass


# ─── Include router ───────────────────────────────────────────────────────────

app.include_router(router)


# ─── Static / SPA fallback ────────────────────────────────────────────────────

if os.path.exists(STATIC_DIR):
    app.mount("/mediamgr/assets", StaticFiles(directory=os.path.join(STATIC_DIR, "assets")), name="assets")

    @app.get("/mediamgr")
    @app.get("/mediamgr/")
    async def spa_root():
        return FileResponse(os.path.join(STATIC_DIR, "index.html"))

    @app.get("/mediamgr/{full_path:path}")
    async def spa_fallback(full_path: str):
        return FileResponse(os.path.join(STATIC_DIR, "index.html"))
