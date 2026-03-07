# cortex/api/app/api/routes/kubernetes.py
import json
from fastapi import APIRouter, Depends, HTTPException
from app.core.deps import get_current_user
from app.core.redis import get_redis
from app.services import kubernetes

router = APIRouter(prefix="/kubernetes", tags=["kubernetes"])

CACHE_TTL = 30


@router.get("/apps")
async def list_apps(_=Depends(get_current_user)):
    redis = get_redis()
    cached = await redis.get("k8s:apps")
    if cached:
        return json.loads(cached)
    try:
        data = await kubernetes.get_apps()
    except Exception as e:
        raise HTTPException(502, f"Kubernetes API error: {e}")
    await redis.setex("k8s:apps", CACHE_TTL, json.dumps(data))
    return data
