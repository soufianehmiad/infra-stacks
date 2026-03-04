# cortex/encoder/app/scanner.py
# Adapted from mediamgr/backend/scanner.py — replaced aiosqlite with SQLAlchemy async
import asyncio
import json
import os
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.db.session import AsyncSessionLocal
from app.core.config import settings

MEDIA_ROOT = settings.media_root
MEDIA_EXTENSIONS = {".mkv", ".mp4", ".avi", ".m4v", ".mov", ".wmv", ".flv", ".ts", ".m2ts"}
KEEP_4K_FOLDERS = ["movies", "anime"]

_scan_state = {
    "running": False,
    "scanned": 0,
    "total": 0,
}


def get_scan_status():
    return dict(_scan_state)


def _suggest_action(codec: str, width: int, height: int, audio_codec: str, folder: str) -> str:
    codec_lower = codec.lower()
    audio_lower = audio_codec.lower()
    is_4k = width >= 3840 or height >= 2160

    if "av1" in codec_lower:
        return "skip"
    if is_4k:
        return "remux" if folder in KEEP_4K_FOLDERS else "downscale"
    if "hevc" in codec_lower or "h265" in codec_lower or "h.265" in codec_lower:
        if any(a in audio_lower for a in ["truehd", "dts-hd", "dts-ma", "dtshd"]):
            return "remux"
        return "skip"
    if "avc" in codec_lower or "h264" in codec_lower or "h.264" in codec_lower:
        return "reencode"
    return "skip"


def _get_folder(path: str) -> str:
    rel = os.path.relpath(path, MEDIA_ROOT)
    parts = rel.split(os.sep)
    return parts[0] if parts else "unknown"


def _mediainfo(path: str) -> Optional[dict]:
    try:
        result = subprocess.run(
            ["mediainfo", "--Output=JSON", path],
            capture_output=True, text=True, timeout=30
        )
        if result.returncode != 0:
            return None
        data = json.loads(result.stdout)
        tracks = data.get("media", {}).get("track", [])

        general = next((t for t in tracks if t.get("@type") == "General"), {})
        video = next((t for t in tracks if t.get("@type") == "Video"), {})
        audio = next((t for t in tracks if t.get("@type") == "Audio"), {})

        width = int(video.get("Width", 0))
        height = int(video.get("Height", 0))

        if height >= 2160 or width >= 3840:
            resolution = "4K"
        elif height >= 1080 or width >= 1920:
            resolution = "1080p"
        elif height >= 720 or width >= 1280:
            resolution = "720p"
        else:
            resolution = f"{width}x{height}" if width else "unknown"

        codec = video.get("Format", "unknown")
        audio_codec = audio.get("Format", "unknown")
        commercial = audio.get("Format_Commercial_IfAny", "")
        if commercial:
            audio_codec = commercial

        duration_str = general.get("Duration", "0")
        try:
            duration_s = float(duration_str)
        except (ValueError, TypeError):
            duration_s = 0.0

        size_bytes = int(general.get("FileSize", os.path.getsize(path)))

        return {
            "codec": codec,
            "width": width,
            "height": height,
            "resolution": resolution,
            "audio_codec": audio_codec,
            "duration_s": duration_s,
            "size_bytes": size_bytes,
        }
    except Exception:
        return None


async def _upsert_file(info: dict):
    from app.db.models import MediaFile
    async with AsyncSessionLocal() as db:
        stmt = pg_insert(MediaFile).values(
            path=info["path"],
            filename=info["filename"],
            folder=info["folder"],
            size_bytes=info["size_bytes"],
            codec=info["codec"],
            resolution=info["resolution"],
            bitrate=None,
            duration=info["duration_s"],
            audio=info["audio_codec"],
            suggested_action=info["suggested_action"],
            scanned_at=datetime.now(timezone.utc),
            flagged=False,
        ).on_conflict_do_update(
            index_elements=["path"],
            set_={
                "filename": info["filename"],
                "folder": info["folder"],
                "size_bytes": info["size_bytes"],
                "codec": info["codec"],
                "resolution": info["resolution"],
                "duration": info["duration_s"],
                "audio": info["audio_codec"],
                "suggested_action": info["suggested_action"],
                "scanned_at": datetime.now(timezone.utc),
            }
        )
        await db.execute(stmt)
        await db.commit()


async def run_scan():
    if _scan_state["running"]:
        return

    _scan_state["running"] = True
    _scan_state["scanned"] = 0
    _scan_state["total"] = 0

    try:
        media_files = []
        for root, _, files in os.walk(MEDIA_ROOT):
            for f in files:
                if Path(f).suffix.lower() in MEDIA_EXTENSIONS:
                    media_files.append(os.path.join(root, f))

        _scan_state["total"] = len(media_files)
        scanned_paths = set()

        for path in media_files:
            try:
                info = await asyncio.get_event_loop().run_in_executor(None, _mediainfo, path)
                if info:
                    folder = _get_folder(path)
                    suggested = _suggest_action(
                        info["codec"], info["width"], info["height"],
                        info["audio_codec"], folder
                    )
                    await _upsert_file({
                        "path": path,
                        "filename": os.path.basename(path),
                        "folder": folder,
                        "size_bytes": info["size_bytes"],
                        "codec": info["codec"],
                        "resolution": info["resolution"],
                        "duration_s": info["duration_s"],
                        "audio_codec": info["audio_codec"],
                        "suggested_action": suggested,
                    })
                    scanned_paths.add(path)
            except Exception:
                pass
            _scan_state["scanned"] += 1
            if _scan_state["scanned"] % 10 == 0:
                await asyncio.sleep(0)

        # Remove DB records for files no longer on disk
        from app.db.models import MediaFile
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(MediaFile.path))
            db_paths = {row[0] for row in result.fetchall()}
            stale = db_paths - scanned_paths
            for stale_path in stale:
                r = await db.execute(select(MediaFile).where(MediaFile.path == stale_path))
                mf = r.scalar_one_or_none()
                if mf:
                    await db.delete(mf)
            await db.commit()
    finally:
        _scan_state["running"] = False
