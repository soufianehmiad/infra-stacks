# cortex/api/app/api/routes/services.py
import json
import asyncio
import docker
from fastapi import APIRouter, Depends, HTTPException
from app.core.deps import get_current_user
from app.services.docker_discovery import discover_services, _get_hosts
from app.core.redis import get_redis

router = APIRouter(prefix="/services", tags=["services"])

CACHE_KEY = "services:status"
CACHE_TTL = 300

@router.get("/")
async def list_services(_=Depends(get_current_user)):
    redis = get_redis()
    cached = await redis.get(CACHE_KEY)
    if cached:
        return json.loads(cached)
    services = await discover_services()

    # Enrich with Cloudflared public URLs (best-effort — uses cached ingress map)
    try:
        cached_ingress = await redis.get("cf:ingress:all")
        if cached_ingress:
            hostname_map = json.loads(cached_ingress)
        else:
            from app.services import cloudflare
            tunnels_data = await cloudflare.list_tunnels()
            hostname_map: dict[str, dict] = {}
            for t in tunnels_data:
                cfg = await cloudflare.get_config(t["name"])
                if cfg:
                    for rule in cfg.get("ingress", []):
                        if rule.get("hostname") and rule.get("service"):
                            hostname_map[rule["hostname"]] = {
                                "tunnel": t["name"],
                                "service": rule["service"],
                            }
            await redis.setex("cf:ingress:all", 120, json.dumps(hostname_map))
        # Build reverse map: internal_url → public hostname
        ingress_map: dict[str, str] = {}
        for hostname, info in hostname_map.items():
            svc_url = info["service"].rstrip("/")
            ingress_map[svc_url] = f"https://{hostname}"
        for svc in services:
            if svc.get("url"):
                internal = svc["url"].rstrip("/")
                svc["public_url"] = ingress_map.get(internal)
    except Exception:
        pass  # Cloudflare enrichment is best-effort

    await redis.setex(CACHE_KEY, CACHE_TTL, json.dumps(services))
    return services

@router.post("/{container_id}/action")
async def service_action(container_id: str, action: str, _=Depends(get_current_user)):
    if action not in ("start", "stop", "restart"):
        raise HTTPException(400, "Invalid action")
    loop = asyncio.get_running_loop()
    def _do_action():
        for host in _get_hosts():
            client = None
            try:
                client = docker.DockerClient(base_url=host, timeout=5)
                container = client.containers.get(container_id)
                getattr(container, action)()
                return (True, None, None)
            except docker.errors.NotFound:
                continue
            except Exception as e:
                return (False, 500, str(e))
            finally:
                if client:
                    try:
                        client.close()
                    except Exception:
                        pass
        return (False, 404, "Container not found")

    ok, status_code, message = await loop.run_in_executor(None, _do_action)
    if not ok:
        raise HTTPException(status_code, message)
    redis = get_redis()
    await redis.delete(CACHE_KEY)
    await redis.publish("heartbeat", json.dumps({"type": "services:refresh", "msg": f"{action} on {container_id}", "ts": ""}))
    return {"ok": True}
