# cortex/api/app/main.py
import asyncio
import json
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.db.session import engine
from app.db.models import Base
from app.api.routes import auth, services, tunnels, ws, media, jobs, storage, proxmox, kubernetes
from app.services.docker_discovery import discover_services
from app.services.docker_events import start_event_watchers
from app.core.redis import get_redis


async def _warm_cache():
    """Pre-populate service cache so first request is always a hit."""
    await asyncio.sleep(0.2)
    try:
        data = await discover_services()
        redis = get_redis()
        await redis.setex("services:status", 300, json.dumps(data))
    except Exception:
        pass


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    _warm_task = asyncio.create_task(_warm_cache())  # noqa: F841
    _events_task = asyncio.create_task(start_event_watchers())  # noqa: F841
    yield


app = FastAPI(title="Cortex API", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

app.include_router(auth.router, prefix="/api")
app.include_router(services.router, prefix="/api")
app.include_router(tunnels.router, prefix="/api")
app.include_router(ws.router)
app.include_router(media.router, prefix="/api")
app.include_router(jobs.router, prefix="/api")
app.include_router(storage.router, prefix="/api")
app.include_router(proxmox.router, prefix="/api")
app.include_router(kubernetes.router, prefix="/api")


@app.get("/api/health")
async def health():
    return {"status": "ok"}
