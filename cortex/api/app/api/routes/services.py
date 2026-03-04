# cortex/api/app/api/routes/services.py
import json
import docker
from fastapi import APIRouter, Depends, HTTPException
from app.core.deps import get_current_user
from app.services.docker_discovery import discover_services
from app.core.redis import get_redis

router = APIRouter(prefix="/services", tags=["services"])


@router.get("/")
async def list_services(_=Depends(get_current_user)):
    redis = get_redis()
    cached = await redis.get("services:status")
    if cached:
        return json.loads(cached)
    services = discover_services()
    await redis.setex("services:status", 10, json.dumps(services))
    return services


@router.post("/{container_id}/action")
async def service_action(container_id: str, action: str, _=Depends(get_current_user)):
    if action not in ("start", "stop", "restart"):
        raise HTTPException(400, "Invalid action")
    try:
        client = docker.from_env()
        container = client.containers.get(container_id)
        getattr(container, action)()
        redis = get_redis()
        await redis.delete("services:status")
        return {"ok": True}
    except docker.errors.NotFound:
        raise HTTPException(404, "Container not found")
    except Exception as e:
        raise HTTPException(500, str(e))
