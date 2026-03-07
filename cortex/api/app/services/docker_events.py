# cortex/api/app/services/docker_events.py
import asyncio
import json
import docker
from app.core.redis import get_redis
from app.services.docker_discovery import _get_hosts, discover_services

CACHE_KEY = "services:status"
CACHE_TTL = 300

# Keep references to prevent GC cancellation
_watcher_tasks: list[asyncio.Task] = []


async def _on_event(event: dict):
    """Re-discover on container event, update cache, notify frontend."""
    redis = get_redis()
    try:
        data = await discover_services()
        await redis.setex(CACHE_KEY, CACHE_TTL, json.dumps(data))
        name = event.get("Actor", {}).get("Attributes", {}).get("name", "unknown")
        await redis.publish("heartbeat", json.dumps({
            "type": "services:refresh",
            "msg": f"container {event.get('status', 'changed')}: {name}"
        }))
    except Exception:
        pass  # On failure, leave old cache intact and don't notify
    finally:
        await redis.aclose()


async def _watch_host(base_url: str):
    """Watch Docker events on one host. Reconnects on error."""
    loop = asyncio.get_running_loop()
    while True:
        try:
            def _run_stream():
                client = docker.DockerClient(base_url=base_url, timeout=5)
                try:
                    for event in client.events(
                        filters={"type": "container", "event": ["start", "stop", "die"]},
                        decode=True
                    ):
                        fut = asyncio.run_coroutine_threadsafe(_on_event(event), loop)
                        fut.add_done_callback(
                            lambda f: f.exception() and print(
                                f"[docker_events] handler error: {f.exception()}"
                            )
                        )
                finally:
                    try:
                        client.close()
                    except Exception:
                        pass
            await loop.run_in_executor(None, _run_stream)
        except Exception:
            await asyncio.sleep(5)


async def start_event_watchers():
    """Start one watcher task per Docker host. Store references to prevent GC cancellation."""
    for host in _get_hosts():
        task = asyncio.create_task(_watch_host(host))
        _watcher_tasks.append(task)
