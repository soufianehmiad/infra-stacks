import asyncio
import os
import shutil
import time
from datetime import datetime, timedelta, timezone

import database

MEDIA_ROOT = os.environ.get("MEDIA_ROOT", "/media")

FOLDERS = {
    "movies": "movies",
    "series": "series",
    "anime": "anime",
    "downloads": "downloads",
}

_storage_cache: list | None = None
_storage_cache_at: float = 0.0
_CACHE_TTL = 60.0  # seconds


def _folder_size(path: str) -> int:
    total = 0
    try:
        for dirpath, _, filenames in os.walk(path):
            for f in filenames:
                fp = os.path.join(dirpath, f)
                try:
                    total += os.path.getsize(fp)
                except OSError:
                    pass
    except OSError:
        pass
    return total


def _disk_usage(path: str) -> dict:
    try:
        usage = shutil.disk_usage(path)
        return {
            "total_bytes": usage.total,
            "used_bytes": usage.used,
            "free_bytes": usage.free,
        }
    except OSError:
        return {"total_bytes": 0, "used_bytes": 0, "free_bytes": 0}


async def get_storage_info() -> list[dict]:
    global _storage_cache, _storage_cache_at

    now = time.monotonic()
    if _storage_cache is not None and (now - _storage_cache_at) < _CACHE_TTL:
        return _storage_cache

    loop = asyncio.get_event_loop()
    # Call disk_usage once for the whole media root
    disk = await loop.run_in_executor(None, _disk_usage, MEDIA_ROOT)
    results = []

    for name, subdir in FOLDERS.items():
        folder_path = os.path.join(MEDIA_ROOT, subdir)
        if os.path.exists(folder_path):
            used = await loop.run_in_executor(None, _folder_size, folder_path)
        else:
            used = 0
        results.append({
            "folder": name,
            "used_bytes": used,
            "total_bytes": disk["total_bytes"],
            "free_bytes": disk["free_bytes"],
        })

    _storage_cache = results
    _storage_cache_at = now
    return results


async def take_snapshot():
    """Record daily storage snapshot."""
    loop = asyncio.get_event_loop()
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    folder_sizes = {}
    for name, subdir in FOLDERS.items():
        path = os.path.join(MEDIA_ROOT, subdir)
        size = await loop.run_in_executor(None, _folder_size, path) if os.path.exists(path) else 0
        folder_sizes[name] = size

    # Calculate total saved bytes from jobs
    stats = await database.get_stats()
    saved_bytes = stats.get("saved_bytes", 0)

    await database.upsert_storage_snapshot({
        "date": today,
        "movies_bytes": folder_sizes.get("movies", 0),
        "series_bytes": folder_sizes.get("series", 0),
        "anime_bytes": folder_sizes.get("anime", 0),
        "downloads_bytes": folder_sizes.get("downloads", 0),
        "saved_bytes": saved_bytes,
    })


async def snapshot_scheduler():
    """Take a snapshot once per day at midnight UTC."""
    while True:
        now = datetime.now(timezone.utc)
        midnight = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
        wait_s = (midnight - now).total_seconds()
        await asyncio.sleep(wait_s)
        try:
            await take_snapshot()
        except Exception:
            pass
