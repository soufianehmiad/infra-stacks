# cortex/api/app/api/websocket/manager.py
import asyncio
import json
from fastapi import WebSocket
from app.core.redis import get_redis


class WSManager:
    def __init__(self):
        self._job_clients: dict[int, list[WebSocket]] = {}
        self._heartbeat_clients: list[WebSocket] = []

    async def subscribe_job(self, job_id: int, ws: WebSocket):
        self._job_clients.setdefault(job_id, []).append(ws)
        try:
            redis = get_redis()
            pubsub = redis.pubsub()
            await pubsub.subscribe(f"job:progress:{job_id}")
            async for message in pubsub.listen():
                if message["type"] == "message":
                    await ws.send_text(message["data"])
                    data = json.loads(message["data"])
                    if data.get("status") in ("done", "failed", "cancelled"):
                        break
        finally:
            clients = self._job_clients.get(job_id, [])
            if ws in clients:
                clients.remove(ws)

    async def subscribe_heartbeat(self, ws: WebSocket):
        self._heartbeat_clients.append(ws)
        try:
            redis = get_redis()
            pubsub = redis.pubsub()
            await pubsub.subscribe("heartbeat")
            async for message in pubsub.listen():
                if message["type"] == "message":
                    await ws.send_text(message["data"])
        finally:
            if ws in self._heartbeat_clients:
                self._heartbeat_clients.remove(ws)


manager = WSManager()
