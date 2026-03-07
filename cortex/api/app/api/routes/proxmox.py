# cortex/api/app/api/routes/proxmox.py
import json
from fastapi import APIRouter, Depends, HTTPException
from app.core.deps import get_current_user
from app.core.redis import get_redis
from app.services import proxmox

router = APIRouter(prefix="/proxmox", tags=["proxmox"])

CACHE_TTL = 30


@router.get("/nodes")
async def node_status(_=Depends(get_current_user)):
    redis = get_redis()
    cached = await redis.get("pve:node")
    if cached:
        return json.loads(cached)
    try:
        data = await proxmox.get_node_status()
    except Exception as e:
        raise HTTPException(502, f"Proxmox API error: {e}")
    await redis.setex("pve:node", CACHE_TTL, json.dumps(data))
    return data


@router.get("/storage")
async def storage(_=Depends(get_current_user)):
    redis = get_redis()
    cached = await redis.get("pve:storage")
    if cached:
        return json.loads(cached)
    try:
        data = await proxmox.get_storage()
    except Exception as e:
        raise HTTPException(502, f"Proxmox API error: {e}")
    await redis.setex("pve:storage", CACHE_TTL, json.dumps(data))
    return data


@router.get("/lxc")
async def lxc_list(_=Depends(get_current_user)):
    redis = get_redis()
    cached = await redis.get("pve:lxc")
    if cached:
        return json.loads(cached)
    try:
        data = await proxmox.get_lxc_list()
    except Exception as e:
        raise HTTPException(502, f"Proxmox API error: {e}")
    await redis.setex("pve:lxc", CACHE_TTL, json.dumps(data))
    return data
