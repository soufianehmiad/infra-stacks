# cortex/encoder/app/encoder.py
# Adapted from mediamgr/backend/encoder.py — replaced aiosqlite with SQLAlchemy async + Redis pub
import asyncio
import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import redis.asyncio as aioredis

from sqlalchemy import select
from app.db.session import AsyncSessionLocal
from app.db.models import Job, MediaFile, StatusEnum
from app.core.config import settings

_running_jobs: set[int] = set()
_running_procs: dict[int, asyncio.subprocess.Process] = {}

_redis: Optional[aioredis.Redis] = None


def _get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(settings.redis_url, decode_responses=True)
    return _redis


async def _publish_progress(job_id: int, pct: float, eta_s: Optional[int], status: str, filename: str = ""):
    r = _get_redis()
    payload = json.dumps({"pct": pct, "eta_s": eta_s, "status": status})
    await r.publish(f"job:progress:{job_id}", payload)
    if filename:
        heartbeat = json.dumps({
            "ts": datetime.utcnow().isoformat(),
            "type": "encoder",
            "msg": f"{filename} · {pct:.0f}% · ETA {eta_s}s" if eta_s else f"{filename} · {pct:.0f}%",
        })
        await r.publish("heartbeat", heartbeat)


def _parse_progress(line: str, duration_s: float) -> Optional[int]:
    match = re.search(r"time=(\d+):(\d+):(\d+\.\d+)", line)
    if not match or duration_s <= 0:
        return None
    h, m, s = int(match.group(1)), int(match.group(2)), float(match.group(3))
    progress_s = h * 3600 + m * 60 + s
    return min(99, int(progress_s / duration_s * 100))


def _build_ffmpeg_cmd(action: str, src: str, tmp: str, codec: str, width: int, height: int) -> list[str]:
    base = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "warning", "-stats"]
    if action == "reencode":
        return base + [
            "-hwaccel", "vaapi", "-hwaccel_device", "/dev/dri/renderD128",
            "-hwaccel_output_format", "vaapi", "-i", src,
            "-vf", "format=vaapi,hwupload", "-c:v", "h264_vaapi",
            "-qp", "26", "-c:a", "copy", "-c:s", "copy", tmp
        ]
    elif action == "remux":
        return base + ["-i", src, "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-c:s", "copy", tmp]
    elif action == "downscale":
        return base + [
            "-hwaccel", "vaapi", "-hwaccel_device", "/dev/dri/renderD128",
            "-hwaccel_output_format", "vaapi", "-i", src,
            "-vf", "scale_vaapi=1920:-2", "-c:v", "h264_vaapi",
            "-qp", "26", "-c:a", "aac", "-b:a", "192k", "-c:s", "copy", tmp
        ]
    raise ValueError(f"Unknown action: {action}")


async def _run_ffmpeg(cmd: list[str], job_id: int, duration_s: float, filename: str) -> int:
    proc = await asyncio.create_subprocess_exec(
        *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
    )
    _running_procs[job_id] = proc
    start_time = asyncio.get_event_loop().time()
    last_pct = 0

    async def read_stderr():
        nonlocal last_pct
        async with AsyncSessionLocal() as db:
            while True:
                line = await proc.stderr.readline()
                if not line:
                    break
                text = line.decode("utf-8", errors="replace")
                pct = _parse_progress(text, duration_s)
                if pct is not None and pct != last_pct:
                    last_pct = pct
                    elapsed = asyncio.get_event_loop().time() - start_time
                    eta_s = int(elapsed / pct * (100 - pct)) if pct > 0 else None
                    await _publish_progress(job_id, pct, eta_s, "running", filename)
                    # Update DB progress
                    r = await db.execute(select(Job).where(Job.id == job_id))
                    job = r.scalar_one_or_none()
                    if job:
                        job.progress = pct
                        job.eta_s = eta_s
                        await db.commit()

    try:
        await asyncio.gather(read_stderr(), proc.wait())
    finally:
        _running_procs.pop(job_id, None)

    return proc.returncode


async def run_job(job_id: int):
    if job_id in _running_jobs:
        return
    _running_jobs.add(job_id)

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Job).where(Job.id == job_id)
        )
        job = result.scalar_one_or_none()
        if not job or job.status not in (StatusEnum.pending, StatusEnum.running):
            _running_jobs.discard(job_id)
            return

        file_result = await db.execute(select(MediaFile).where(MediaFile.id == job.file_id))
        file_rec = file_result.scalar_one_or_none()
        if not file_rec:
            job.status = StatusEnum.failed
            job.log = "File record not found"
            job.finished_at = datetime.now(timezone.utc)
            await db.commit()
            _running_jobs.discard(job_id)
            return

        src = file_rec.path
        action = job.action.value
        filename = file_rec.filename

        job.status = StatusEnum.running
        await db.commit()

    await _publish_progress(job_id, 0, None, "running", filename)

    if action == "delete":
        try:
            os.remove(src)
            async with AsyncSessionLocal() as db:
                r = await db.execute(select(MediaFile).where(MediaFile.path == src))
                mf = r.scalar_one_or_none()
                if mf:
                    await db.delete(mf)
                r2 = await db.execute(select(Job).where(Job.id == job_id))
                j = r2.scalar_one_or_none()
                if j:
                    j.status = StatusEnum.done
                    j.progress = 100
                    j.finished_at = datetime.now(timezone.utc)
                await db.commit()
            await _publish_progress(job_id, 100, 0, "done")
        except Exception as e:
            async with AsyncSessionLocal() as db:
                r = await db.execute(select(Job).where(Job.id == job_id))
                j = r.scalar_one_or_none()
                if j:
                    j.status = StatusEnum.failed
                    j.log = str(e)
                    j.finished_at = datetime.now(timezone.utc)
                await db.commit()
            await _publish_progress(job_id, 0, None, "failed")
        finally:
            _running_jobs.discard(job_id)
        return

    # ffmpeg actions
    src_path = Path(src)
    tmp = str(src_path.with_suffix(".cortex_tmp" + src_path.suffix))

    async with AsyncSessionLocal() as db:
        r = await db.execute(select(MediaFile).where(MediaFile.path == src))
        file_rec = r.scalar_one_or_none()
        codec = file_rec.codec if file_rec else "unknown"
        duration_s = file_rec.duration or 0.0
        width = 1920
        height = 1080

    try:
        cmd = _build_ffmpeg_cmd(action, src, tmp, codec, width, height)
        rc = await _run_ffmpeg(cmd, job_id, duration_s, filename)

        async with AsyncSessionLocal() as db:
            r = await db.execute(select(Job).where(Job.id == job_id))
            j = r.scalar_one_or_none()
            if j and j.status == StatusEnum.cancelled:
                if os.path.exists(tmp):
                    os.remove(tmp)
                await _publish_progress(job_id, 0, None, "cancelled")
                return

        if rc != 0:
            raise RuntimeError(f"ffmpeg exited with code {rc}")

        src_size = os.path.getsize(src)
        new_size = os.path.getsize(tmp)

        async with AsyncSessionLocal() as db:
            r = await db.execute(select(Job).where(Job.id == job_id))
            j = r.scalar_one_or_none()
            if action == "reencode" and new_size >= src_size:
                os.remove(tmp)
                if j:
                    j.status = StatusEnum.done
                    j.progress = 100
                    j.size_before = src_size
                    j.size_after = new_size
                    j.finished_at = datetime.now(timezone.utc)
                    j.log = "reverted: output was larger than input"
                await db.commit()
                await _publish_progress(job_id, 100, 0, "done")
            else:
                os.replace(tmp, src)
                new_codec = "AVC" if action in ("reencode", "downscale") else codec
                rf = await db.execute(select(MediaFile).where(MediaFile.path == src))
                mf = rf.scalar_one_or_none()
                if mf:
                    mf.size_bytes = new_size
                    mf.codec = new_codec
                    mf.suggested_action = "skip"
                    mf.scanned_at = datetime.now(timezone.utc)
                if j:
                    j.status = StatusEnum.done
                    j.progress = 100
                    j.size_before = src_size
                    j.size_after = new_size
                    j.finished_at = datetime.now(timezone.utc)
                await db.commit()
                await _publish_progress(job_id, 100, 0, "done")

    except Exception as e:
        if os.path.exists(tmp):
            try:
                os.remove(tmp)
            except Exception:
                pass
        async with AsyncSessionLocal() as db:
            r = await db.execute(select(Job).where(Job.id == job_id))
            j = r.scalar_one_or_none()
            if j and j.status != StatusEnum.cancelled:
                j.status = StatusEnum.failed
                j.log = str(e)
                j.finished_at = datetime.now(timezone.utc)
                await db.commit()
                await _publish_progress(job_id, 0, None, "failed")
            elif j and j.status == StatusEnum.cancelled:
                await _publish_progress(job_id, 0, None, "cancelled")
    finally:
        _running_jobs.discard(job_id)


async def process_queue():
    """Background task: pick pending jobs and run them one at a time."""
    while True:
        await asyncio.sleep(3)
        if _running_jobs:
            continue
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(Job).where(Job.status == StatusEnum.pending)
                .order_by(Job.created_at.asc()).limit(1)
            )
            job = result.scalar_one_or_none()
            if job:
                asyncio.create_task(run_job(job.id))
