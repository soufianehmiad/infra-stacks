# cortex/encoder/app/main.py
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from app.core.config import settings
from app import encoder, storage


@asynccontextmanager
async def lifespan(app: FastAPI):
    asyncio.create_task(encoder.process_queue())
    asyncio.create_task(storage.snapshot_scheduler())
    yield


app = FastAPI(title="Cortex Encoder", lifespan=lifespan)


@app.get("/encoder/health")
async def health():
    return {"status": "ok"}


@app.post("/encoder/scan")
async def trigger_scan():
    from app import scanner
    asyncio.create_task(scanner.run_scan())
    return {"ok": True}


@app.get("/encoder/scan/status")
async def scan_status():
    from app import scanner
    return scanner.get_scan_status()
