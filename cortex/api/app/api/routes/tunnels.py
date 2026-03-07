# cortex/api/app/api/routes/tunnels.py
import json
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field
from typing import Annotated
from app.core.deps import get_current_user
from app.core.redis import get_redis
from app.services import cloudflare
from app.services.cloudflare import expose_service, unexpose_service

router = APIRouter(prefix="/tunnels", tags=["tunnels"])

TUNNELS_CACHE_KEY = "tunnels:list"
TUNNELS_CACHE_TTL = 60
INGRESS_CACHE_KEY = "cf:ingress:all"
INGRESS_CACHE_TTL = 120


class ControlRequest(BaseModel):
    action: str  # start | stop | restart


class IngressRequest(BaseModel):
    rules: list[dict]


class ExposeRequest(BaseModel):
    hostname: Annotated[str, Field(min_length=1)]
    internal_url: Annotated[str, Field(min_length=1)]  # keep as str (not AnyHttpUrl) to avoid serialization issues


@router.get("/")
async def list_tunnels(_=Depends(get_current_user)):
    redis = get_redis()
    cached = await redis.get(TUNNELS_CACHE_KEY)
    if cached:
        return json.loads(cached)
    data = await cloudflare.list_tunnels()
    await redis.setex(TUNNELS_CACHE_KEY, TUNNELS_CACHE_TTL, json.dumps(data))
    return data


@router.get("/ingress/all")
async def all_ingress(_=Depends(get_current_user)):
    """Return all ingress rules across all tunnels — used by Services page to show public_url."""
    redis = get_redis()
    cached = await redis.get(INGRESS_CACHE_KEY)
    if cached:
        return json.loads(cached)
    tunnels = await cloudflare.list_tunnels()
    result: dict[str, dict] = {}
    for t in tunnels:
        cfg = await cloudflare.get_config(t["name"])
        if cfg:
            for r in cfg.get("ingress", []):
                if r.get("hostname"):
                    result[r["hostname"]] = {
                        "tunnel": t["name"],
                        "service": r.get("service", ""),
                    }
    await redis.setex(INGRESS_CACHE_KEY, INGRESS_CACHE_TTL, json.dumps(result))
    return result


@router.post("/{name}/control")
async def control_tunnel(name: str, req: ControlRequest, _=Depends(get_current_user)):
    result = await cloudflare.control_tunnel(name, req.action)
    if not result["ok"]:
        raise HTTPException(500, result.get("error"))
    return result


@router.get("/{name}/logs")
async def get_logs(name: str, lines: int = 150, _=Depends(get_current_user)):
    return await cloudflare.get_logs(name, lines)


@router.get("/{name}/config")
async def get_config(name: str, _=Depends(get_current_user)):
    cfg = await cloudflare.get_config(name)
    if cfg is None:
        raise HTTPException(404, "Config not found")
    return cfg


@router.put("/{name}/ingress")
async def update_ingress(name: str, req: IngressRequest, _=Depends(get_current_user)):
    result = await cloudflare.update_ingress(name, req.rules)
    if not result["ok"]:
        raise HTTPException(500, result.get("error"))
    return result


@router.post("/{name}/expose")
async def expose(name: str, req: ExposeRequest, _=Depends(get_current_user)):
    result = await expose_service(name, req.hostname, req.internal_url)
    if not result["ok"]:
        raise HTTPException(500, result.get("error"))
    redis = get_redis()
    await redis.delete(TUNNELS_CACHE_KEY, INGRESS_CACHE_KEY, "services:status")
    return result


@router.delete("/{name}/expose")
async def unexpose(name: str, hostname: str, _=Depends(get_current_user)):
    result = await unexpose_service(name, hostname)
    if not result["ok"]:
        raise HTTPException(500, result.get("error"))
    redis = get_redis()
    await redis.delete(TUNNELS_CACHE_KEY, INGRESS_CACHE_KEY, "services:status")
    return result


@router.websocket("/{name}/logs/stream")
async def stream_logs(websocket: WebSocket, name: str):
    await websocket.accept()
    try:
        await cloudflare.stream_logs(websocket, name)
    except WebSocketDisconnect:
        pass
