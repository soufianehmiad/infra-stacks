# cortex/api/app/main.py
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.db.session import engine
from app.db.models import Base
from app.api.routes import auth, services, tunnels, ws, media, jobs, storage


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield


app = FastAPI(title="Cortex API", lifespan=lifespan)

app.add_middleware(CORSMiddleware, allow_origins=["*"],
                   allow_methods=["*"], allow_headers=["*"])

app.include_router(auth.router, prefix="/api")
app.include_router(services.router, prefix="/api")
app.include_router(tunnels.router, prefix="/api")
app.include_router(ws.router)
app.include_router(media.router, prefix="/api")
app.include_router(jobs.router, prefix="/api")
app.include_router(storage.router, prefix="/api")


@app.get("/api/health")
async def health():
    return {"status": "ok"}
