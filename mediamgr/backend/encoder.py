import asyncio
import os
import re
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import database

MEDIA_ROOT = os.environ.get("MEDIA_ROOT", "/media")

# Active job websocket subscribers: job_id -> list of queues
_subscribers: dict[int, list[asyncio.Queue]] = {}

# Currently running job ids (to avoid duplicate runs)
_running_jobs: set[int] = set()

# Live subprocess references for cancel support: job_id -> process
_running_procs: dict[int, asyncio.subprocess.Process] = {}


def subscribe(job_id: int) -> asyncio.Queue:
    q: asyncio.Queue = asyncio.Queue(maxsize=200)
    _subscribers.setdefault(job_id, []).append(q)
    return q


def unsubscribe(job_id: int, q: asyncio.Queue):
    if job_id in _subscribers:
        try:
            _subscribers[job_id].remove(q)
        except ValueError:
            pass
        if not _subscribers[job_id]:
            del _subscribers[job_id]


async def _broadcast(job_id: int, msg: dict):
    for q in list(_subscribers.get(job_id, [])):
        if q.full():
            # Drop oldest item to make room, ensuring terminal messages are never lost
            try:
                q.get_nowait()
            except asyncio.QueueEmpty:
                pass
        try:
            q.put_nowait(msg)
        except asyncio.QueueFull:
            pass


async def kill_running_job(job_id: int):
    """Terminate the ffmpeg process for a running job, if any."""
    proc = _running_procs.get(job_id)
    if proc and proc.returncode is None:
        try:
            proc.terminate()
        except ProcessLookupError:
            pass


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
            "-hwaccel", "vaapi",
            "-hwaccel_device", "/dev/dri/renderD128",
            "-hwaccel_output_format", "vaapi",
            "-i", src,
            "-vf", "format=vaapi,hwupload",
            "-c:v", "h264_vaapi",
            "-qp", "26",
            "-c:a", "copy",
            "-c:s", "copy",
            tmp
        ]
    elif action == "remux":
        return base + [
            "-i", src,
            "-c:v", "copy",
            "-c:a", "aac",
            "-b:a", "192k",
            "-c:s", "copy",
            tmp
        ]
    elif action == "downscale":
        return base + [
            "-hwaccel", "vaapi",
            "-hwaccel_device", "/dev/dri/renderD128",
            "-hwaccel_output_format", "vaapi",
            "-i", src,
            "-vf", "scale_vaapi=1920:-2",   # -2 preserves aspect ratio
            "-c:v", "h264_vaapi",
            "-qp", "26",
            "-c:a", "aac",
            "-b:a", "192k",
            "-c:s", "copy",
            tmp
        ]
    raise ValueError(f"Unknown action: {action}")


def _codec_after_action(action: str, original_codec: str) -> str:
    """Return the correct codec label for the output file."""
    if action in ("reencode", "downscale"):
        return "AVC"       # h264_vaapi output
    elif action == "remux":
        return original_codec  # video stream is copied unchanged
    return original_codec


async def _run_ffmpeg(cmd: list[str], job_id: int, duration_s: float) -> int:
    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    _running_procs[job_id] = proc

    start_time = asyncio.get_event_loop().time()
    last_pct = 0

    async def read_stderr():
        nonlocal last_pct
        while True:
            line = await proc.stderr.readline()
            if not line:
                break
            text = line.decode("utf-8", errors="replace")
            pct = _parse_progress(text, duration_s)
            if pct is not None and pct != last_pct:
                last_pct = pct
                elapsed = asyncio.get_event_loop().time() - start_time
                eta_s = None
                if pct > 0:
                    eta_s = int(elapsed / pct * (100 - pct))
                await _broadcast(job_id, {"pct": pct, "eta_s": eta_s, "status": "running"})
                await database.update_job(job_id, progress=pct, eta_s=eta_s)

    try:
        await asyncio.gather(read_stderr(), proc.wait())
    finally:
        _running_procs.pop(job_id, None)

    return proc.returncode


async def run_job(job_id: int):
    if job_id in _running_jobs:
        return
    _running_jobs.add(job_id)

    job = await database.get_job_by_id(job_id)
    if not job or job["status"] not in ("pending", "running"):
        _running_jobs.discard(job_id)
        return

    file_rec = await database.get_file_by_id(job["file_id"])
    if not file_rec:
        await database.update_job(job_id, status="failed", error="File record not found",
                                   finished_at=datetime.now(timezone.utc).isoformat())
        _running_jobs.discard(job_id)
        return

    src = file_rec["path"]
    action = job["action"]
    started_at = datetime.now(timezone.utc).isoformat()

    await database.update_job(job_id, status="running", started_at=started_at)
    await _broadcast(job_id, {"pct": 0, "eta_s": None, "status": "running"})

    if action == "delete":
        try:
            os.remove(src)
            await database.delete_file_record(file_rec["id"])
            await database.update_job(
                job_id, status="done", progress=100,
                finished_at=datetime.now(timezone.utc).isoformat()
            )
            await _broadcast(job_id, {"pct": 100, "eta_s": 0, "status": "done"})
        except Exception as e:
            await database.update_job(
                job_id, status="failed", error=str(e),
                finished_at=datetime.now(timezone.utc).isoformat()
            )
            await _broadcast(job_id, {"pct": 0, "eta_s": None, "status": "failed"})
        finally:
            _running_jobs.discard(job_id)
        return

    # ffmpeg actions
    src_path = Path(src)
    tmp = str(src_path.with_suffix(".mediamgr_tmp" + src_path.suffix))

    try:
        cmd = _build_ffmpeg_cmd(
            action, src, tmp,
            file_rec["codec"], file_rec["width"], file_rec["height"]
        )
        rc = await _run_ffmpeg(cmd, job_id, file_rec["duration_s"])

        # Check if job was cancelled while running (proc was terminated)
        current_job = await database.get_job_by_id(job_id)
        if current_job and current_job["status"] == "cancelled":
            if os.path.exists(tmp):
                try:
                    os.remove(tmp)
                except Exception:
                    pass
            await _broadcast(job_id, {"pct": 0, "eta_s": None, "status": "cancelled"})
            return

        if rc != 0:
            raise RuntimeError(f"ffmpeg exited with code {rc}")

        src_size = os.path.getsize(src)
        new_size = os.path.getsize(tmp)

        # Auto-revert: only for reencode if new file is larger
        if action == "reencode" and new_size >= src_size:
            os.remove(tmp)
            await database.update_job(
                job_id, status="reverted", progress=100,
                size_before=src_size, size_after=new_size,
                finished_at=datetime.now(timezone.utc).isoformat()
            )
            await _broadcast(job_id, {"pct": 100, "eta_s": 0, "status": "reverted"})
        else:
            # Replace original with new file
            os.replace(tmp, src)
            # Update file record with accurate metadata
            new_codec = _codec_after_action(action, file_rec["codec"])
            await database.upsert_file({
                **file_rec,
                "size_bytes": new_size,
                "codec": new_codec,
                "suggested_action": "skip",
                "scanned_at": datetime.now(timezone.utc).isoformat(),
            })
            await database.update_job(
                job_id, status="done", progress=100,
                size_before=src_size, size_after=new_size,
                finished_at=datetime.now(timezone.utc).isoformat()
            )
            await _broadcast(job_id, {"pct": 100, "eta_s": 0, "status": "done"})

    except Exception as e:
        # Clean up temp file if it exists
        if os.path.exists(tmp):
            try:
                os.remove(tmp)
            except Exception:
                pass
        # Don't overwrite a cancelled status
        current_job = await database.get_job_by_id(job_id)
        if current_job and current_job["status"] == "cancelled":
            await _broadcast(job_id, {"pct": 0, "eta_s": None, "status": "cancelled"})
        else:
            await database.update_job(
                job_id, status="failed", error=str(e),
                finished_at=datetime.now(timezone.utc).isoformat()
            )
            await _broadcast(job_id, {"pct": 0, "eta_s": None, "status": "failed"})
    finally:
        _running_jobs.discard(job_id)


async def process_queue():
    """Background task: pick pending jobs and run them one at a time."""
    while True:
        await asyncio.sleep(3)
        if _running_jobs:
            continue
        job_id = await database.get_next_pending_job()
        if job_id:
            asyncio.create_task(run_job(job_id))
