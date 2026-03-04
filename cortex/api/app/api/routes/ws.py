# cortex/api/app/api/routes/ws.py
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.api.websocket.manager import manager

router = APIRouter(prefix="/ws", tags=["ws"])


@router.websocket("/jobs/{job_id}")
async def ws_job(websocket: WebSocket, job_id: int):
    await websocket.accept()
    try:
        await manager.subscribe_job(job_id, websocket)
    except WebSocketDisconnect:
        pass


@router.websocket("/heartbeat")
async def ws_heartbeat(websocket: WebSocket):
    await websocket.accept()
    try:
        await manager.subscribe_heartbeat(websocket)
    except WebSocketDisconnect:
        pass
