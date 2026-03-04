# cortex/api/app/api/routes/tunnels.py
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from app.core.deps import get_current_user
from app.services import cloudflare

router = APIRouter(prefix="/tunnels", tags=["tunnels"])


class ControlRequest(BaseModel):
    action: str  # start | stop | restart


class IngressRequest(BaseModel):
    rules: list[dict]


@router.get("/")
async def list_tunnels(_=Depends(get_current_user)):
    return await cloudflare.list_tunnels()


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


@router.websocket("/{name}/logs/stream")
async def stream_logs(websocket: WebSocket, name: str):
    await websocket.accept()
    try:
        await cloudflare.stream_logs(websocket, name)
    except WebSocketDisconnect:
        pass
