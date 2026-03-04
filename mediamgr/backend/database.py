import aiosqlite
import os
from pathlib import Path

DATA_DIR = os.environ.get("DATA_DIR", "/data")
DB_PATH = os.path.join(DATA_DIR, "mediamgr.db")


async def get_db():
    return await aiosqlite.connect(DB_PATH)


async def init_db():
    Path(DATA_DIR).mkdir(parents=True, exist_ok=True)
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS files (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                path TEXT UNIQUE NOT NULL,
                filename TEXT NOT NULL,
                folder TEXT NOT NULL,
                size_bytes INTEGER NOT NULL,
                codec TEXT NOT NULL,
                resolution TEXT NOT NULL,
                width INTEGER NOT NULL DEFAULT 0,
                height INTEGER NOT NULL DEFAULT 0,
                duration_s REAL NOT NULL DEFAULT 0,
                audio_codec TEXT NOT NULL DEFAULT '',
                suggested_action TEXT NOT NULL DEFAULT 'skip',
                scanned_at TEXT NOT NULL
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS jobs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                file_id INTEGER NOT NULL,
                filename TEXT NOT NULL,
                action TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                progress INTEGER NOT NULL DEFAULT 0,
                eta_s INTEGER,
                size_before INTEGER,
                size_after INTEGER,
                created_at TEXT NOT NULL,
                started_at TEXT,
                finished_at TEXT,
                error TEXT,
                FOREIGN KEY (file_id) REFERENCES files(id)
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS storage_snapshots (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date TEXT NOT NULL UNIQUE,
                movies_bytes INTEGER NOT NULL DEFAULT 0,
                series_bytes INTEGER NOT NULL DEFAULT 0,
                anime_bytes INTEGER NOT NULL DEFAULT 0,
                downloads_bytes INTEGER NOT NULL DEFAULT 0,
                saved_bytes INTEGER NOT NULL DEFAULT 0
            )
        """)
        await db.commit()


_SORT_COLUMNS = {
    "filename": "filename",
    "size_bytes": "size_bytes",
    "codec": "codec",
    "height": "height",
    "duration_s": "duration_s",
    "audio_codec": "audio_codec",
    "suggested_action": "suggested_action",
}


async def get_files(folder=None, codec=None, resolution=None, audio=None, search=None, suggested_action=None, limit=None, offset=0, sort_by="size_bytes", sort_dir="desc"):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        where = " WHERE 1=1"
        params = []
        if folder and folder != "all":
            where += " AND folder = ?"
            params.append(folder)
        if codec:
            where += " AND codec LIKE ?"
            params.append(f"%{codec}%")
        if resolution:
            where += " AND resolution = ?"
            params.append(resolution)
        if audio:
            where += " AND audio_codec LIKE ?"
            params.append(f"%{audio}%")
        if search:
            where += " AND filename LIKE ?"
            params.append(f"%{search}%")
        if suggested_action:
            where += " AND suggested_action = ?"
            params.append(suggested_action)

        async with db.execute(f"SELECT COUNT(*) FROM files{where}", params) as cursor:
            total = (await cursor.fetchone())[0]

        col = _SORT_COLUMNS.get(sort_by, "size_bytes")
        direction = "ASC" if sort_dir == "asc" else "DESC"
        query = f"SELECT * FROM files{where} ORDER BY {col} {direction}"
        page_params = list(params)
        if limit is not None:
            query += " LIMIT ? OFFSET ?"
            page_params += [limit, offset]

        async with db.execute(query, page_params) as cursor:
            rows = await cursor.fetchall()
            return [dict(row) for row in rows], total


async def upsert_file(data: dict):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            INSERT INTO files
                (path, filename, folder, size_bytes, codec, resolution, width, height,
                 duration_s, audio_codec, suggested_action, scanned_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(path) DO UPDATE SET
                filename=excluded.filename,
                folder=excluded.folder,
                size_bytes=excluded.size_bytes,
                codec=excluded.codec,
                resolution=excluded.resolution,
                width=excluded.width,
                height=excluded.height,
                duration_s=excluded.duration_s,
                audio_codec=excluded.audio_codec,
                suggested_action=excluded.suggested_action,
                scanned_at=excluded.scanned_at
        """, (
            data["path"], data["filename"], data["folder"],
            data["size_bytes"], data["codec"], data["resolution"],
            data["width"], data["height"], data["duration_s"],
            data["audio_codec"], data["suggested_action"], data["scanned_at"]
        ))
        await db.commit()


async def get_file_by_id(file_id: int):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM files WHERE id = ?", (file_id,)) as cursor:
            row = await cursor.fetchone()
            return dict(row) if row else None


async def delete_file_record(file_id: int):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("DELETE FROM files WHERE id = ?", (file_id,))
        await db.commit()


async def get_active_job_for_file(file_id: int):
    """Return the first pending/running job for a file, or None."""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT id FROM jobs WHERE file_id=? AND status IN ('pending','running') LIMIT 1",
            (file_id,)
        ) as cursor:
            row = await cursor.fetchone()
            return dict(row) if row else None


async def get_next_pending_job():
    """Return the id of the oldest pending job, or None."""
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute(
            "SELECT id FROM jobs WHERE status='pending' ORDER BY created_at ASC LIMIT 1"
        ) as cursor:
            row = await cursor.fetchone()
            return row[0] if row else None


async def get_all_file_paths():
    """Return all file paths currently in the DB."""
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute("SELECT path FROM files") as cursor:
            rows = await cursor.fetchall()
            return [row[0] for row in rows]


async def delete_file_by_path(path: str):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("DELETE FROM files WHERE path=?", (path,))
        await db.commit()


async def create_job(file_id: int, filename: str, action: str, size_before: int, created_at: str):
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute("""
            INSERT INTO jobs (file_id, filename, action, status, progress, size_before, created_at)
            VALUES (?, ?, ?, 'pending', 0, ?, ?)
        """, (file_id, filename, action, size_before, created_at))
        await db.commit()
        return cursor.lastrowid


async def get_jobs(limit=500):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM jobs ORDER BY created_at DESC LIMIT ?", (limit,)
        ) as cursor:
            rows = await cursor.fetchall()
            return [dict(row) for row in rows]


async def get_job_by_id(job_id: int):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM jobs WHERE id = ?", (job_id,)) as cursor:
            row = await cursor.fetchone()
            return dict(row) if row else None


async def update_job(job_id: int, **kwargs):
    if not kwargs:
        return
    sets = ", ".join(f"{k}=?" for k in kwargs)
    values = list(kwargs.values()) + [job_id]
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(f"UPDATE jobs SET {sets} WHERE id = ?", values)
        await db.commit()


async def get_storage_history(days=30):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM storage_snapshots ORDER BY date DESC LIMIT ?", (days,)
        ) as cursor:
            rows = await cursor.fetchall()
            return [dict(row) for row in rows]


async def upsert_storage_snapshot(data: dict):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            INSERT INTO storage_snapshots
                (date, movies_bytes, series_bytes, anime_bytes, downloads_bytes, saved_bytes)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(date) DO UPDATE SET
                movies_bytes=excluded.movies_bytes,
                series_bytes=excluded.series_bytes,
                anime_bytes=excluded.anime_bytes,
                downloads_bytes=excluded.downloads_bytes,
                saved_bytes=excluded.saved_bytes
        """, (
            data["date"], data["movies_bytes"], data["series_bytes"],
            data["anime_bytes"], data["downloads_bytes"], data["saved_bytes"]
        ))
        await db.commit()


async def get_stats():
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute("SELECT COUNT(*) FROM files") as cur:
            files_count = (await cur.fetchone())[0]
        async with db.execute("SELECT COUNT(*) FROM jobs") as cur:
            jobs_count = (await cur.fetchone())[0]
        async with db.execute(
            "SELECT COALESCE(SUM(size_before - size_after), 0) FROM jobs WHERE status='done' AND size_after IS NOT NULL"
        ) as cur:
            saved_bytes = (await cur.fetchone())[0]
        async with db.execute(
            "SELECT COUNT(*) FROM jobs WHERE status='pending'"
        ) as cur:
            pending_jobs = (await cur.fetchone())[0]
        return {
            "files_count": files_count,
            "jobs_count": jobs_count,
            "saved_bytes": saved_bytes,
            "pending_jobs": pending_jobs
        }
