"""
Backend tests for MediaMgr.

Run with:  pytest test_mediamgr.py -v
"""
import os
import pytest
import pytest_asyncio
import asyncio
from datetime import datetime, timezone

# ─── Fixtures ────────────────────────────────────────────────────────────────

@pytest_asyncio.fixture
async def db(tmp_path, monkeypatch):
    """Initialise a fresh in-process SQLite DB for each test."""
    import database
    monkeypatch.setattr(database, "DB_PATH", str(tmp_path / "test.db"))
    monkeypatch.setattr(database, "DATA_DIR", str(tmp_path))
    await database.init_db()
    return database


@pytest_asyncio.fixture
async def db_with_file(db):
    """DB pre-populated with one sample file record."""
    await db.upsert_file({
        "path": "/media/movies/test.mkv",
        "filename": "test.mkv",
        "folder": "movies",
        "size_bytes": 5_000_000_000,
        "codec": "HEVC",
        "resolution": "1080p",
        "width": 1920,
        "height": 1080,
        "duration_s": 7200.0,
        "audio_codec": "AAC",
        "suggested_action": "skip",
        "scanned_at": datetime.now(timezone.utc).isoformat(),
    })
    rows, _ = await db.get_files()
    return db, rows[0]


# ─── scanner._suggest_action ─────────────────────────────────────────────────

class TestSuggestAction:
    from scanner import _suggest_action

    def test_av1_always_skip(self):
        from scanner import _suggest_action
        assert _suggest_action("AV1", 1920, 1080, "Opus", "movies") == "skip"

    def test_hevc_aac_skip(self):
        from scanner import _suggest_action
        assert _suggest_action("HEVC", 1920, 1080, "AAC", "series") == "skip"

    def test_hevc_truehd_remux(self):
        from scanner import _suggest_action
        assert _suggest_action("HEVC", 1920, 1080, "TrueHD Atmos", "movies") == "remux"

    def test_hevc_dtshd_remux(self):
        from scanner import _suggest_action
        assert _suggest_action("HEVC", 1920, 1080, "DTS-HD Master Audio", "series") == "remux"

    def test_avc_reencode(self):
        from scanner import _suggest_action
        assert _suggest_action("AVC", 1920, 1080, "AC-3", "movies") == "reencode"

    def test_h264_reencode(self):
        from scanner import _suggest_action
        assert _suggest_action("h264", 1280, 720, "AAC", "series") == "reencode"

    def test_4k_movies_remux(self):
        from scanner import _suggest_action
        # movies is in KEEP_4K_FOLDERS → remux
        assert _suggest_action("HEVC", 3840, 2160, "AAC", "movies") == "remux"

    def test_4k_anime_remux(self):
        from scanner import _suggest_action
        assert _suggest_action("HEVC", 3840, 2160, "AAC", "anime") == "remux"

    def test_4k_series_downscale(self):
        from scanner import _suggest_action
        # series is NOT in KEEP_4K_FOLDERS → downscale
        assert _suggest_action("HEVC", 3840, 2160, "AAC", "series") == "downscale"

    def test_4k_downloads_downscale(self):
        from scanner import _suggest_action
        assert _suggest_action("AVC", 3840, 2160, "EAC3", "downloads") == "downscale"

    def test_unknown_codec_skip(self):
        from scanner import _suggest_action
        assert _suggest_action("VP9", 1920, 1080, "Vorbis", "movies") == "skip"


# ─── encoder._codec_after_action ─────────────────────────────────────────────

class TestCodecAfterAction:
    def test_reencode_returns_avc(self):
        from encoder import _codec_after_action
        assert _codec_after_action("reencode", "HEVC") == "AVC"

    def test_downscale_returns_avc(self):
        from encoder import _codec_after_action
        assert _codec_after_action("downscale", "HEVC") == "AVC"

    def test_remux_preserves_codec(self):
        from encoder import _codec_after_action
        assert _codec_after_action("remux", "HEVC") == "HEVC"

    def test_remux_preserves_av1(self):
        from encoder import _codec_after_action
        assert _codec_after_action("remux", "AV1") == "AV1"


# ─── database ────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_db_init_creates_tables(db):
    import aiosqlite
    import database
    async with aiosqlite.connect(database.DB_PATH) as conn:
        async with conn.execute("SELECT name FROM sqlite_master WHERE type='table'") as cur:
            tables = {row[0] for row in await cur.fetchall()}
    assert {"files", "jobs", "storage_snapshots"} <= tables


@pytest.mark.asyncio
async def test_upsert_and_get_file(db):
    await db.upsert_file({
        "path": "/media/movies/a.mkv",
        "filename": "a.mkv",
        "folder": "movies",
        "size_bytes": 1_000_000,
        "codec": "HEVC",
        "resolution": "1080p",
        "width": 1920, "height": 1080,
        "duration_s": 3600.0,
        "audio_codec": "AAC",
        "suggested_action": "skip",
        "scanned_at": datetime.now(timezone.utc).isoformat(),
    })
    rows, total = await db.get_files()
    assert total == 1
    assert rows[0]["filename"] == "a.mkv"


@pytest.mark.asyncio
async def test_upsert_updates_existing(db):
    base = {
        "path": "/media/movies/a.mkv", "filename": "a.mkv", "folder": "movies",
        "size_bytes": 1_000_000, "codec": "AVC", "resolution": "1080p",
        "width": 1920, "height": 1080, "duration_s": 3600.0,
        "audio_codec": "AAC", "suggested_action": "reencode",
        "scanned_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.upsert_file(base)
    await db.upsert_file({**base, "codec": "HEVC", "suggested_action": "skip"})
    rows, total = await db.get_files()
    assert total == 1  # no duplicate
    assert rows[0]["codec"] == "HEVC"
    assert rows[0]["suggested_action"] == "skip"


@pytest.mark.asyncio
async def test_get_files_filter_folder(db):
    now = datetime.now(timezone.utc).isoformat()
    for folder in ("movies", "series", "anime"):
        await db.upsert_file({
            "path": f"/media/{folder}/x.mkv", "filename": "x.mkv", "folder": folder,
            "size_bytes": 1, "codec": "HEVC", "resolution": "1080p",
            "width": 1920, "height": 1080, "duration_s": 1.0,
            "audio_codec": "AAC", "suggested_action": "skip", "scanned_at": now,
        })
    rows, total = await db.get_files(folder="series")
    assert total == 1
    assert rows[0]["folder"] == "series"


@pytest.mark.asyncio
async def test_get_files_filter_codec(db):
    now = datetime.now(timezone.utc).isoformat()
    for codec in ("HEVC", "AVC", "AV1"):
        await db.upsert_file({
            "path": f"/media/movies/{codec}.mkv", "filename": f"{codec}.mkv", "folder": "movies",
            "size_bytes": 1, "codec": codec, "resolution": "1080p",
            "width": 1920, "height": 1080, "duration_s": 1.0,
            "audio_codec": "AAC", "suggested_action": "skip", "scanned_at": now,
        })
    rows, total = await db.get_files(codec="avc")
    assert total == 1
    assert rows[0]["codec"] == "AVC"


@pytest.mark.asyncio
async def test_get_files_filter_search(db):
    now = datetime.now(timezone.utc).isoformat()
    for name in ("inception.mkv", "interstellar.mkv", "avatar.mkv"):
        await db.upsert_file({
            "path": f"/media/movies/{name}", "filename": name, "folder": "movies",
            "size_bytes": 1, "codec": "HEVC", "resolution": "1080p",
            "width": 1920, "height": 1080, "duration_s": 1.0,
            "audio_codec": "AAC", "suggested_action": "skip", "scanned_at": now,
        })
    rows, total = await db.get_files(search="inter")
    assert total == 1
    assert rows[0]["filename"] == "interstellar.mkv"


@pytest.mark.asyncio
async def test_get_files_pagination(db):
    now = datetime.now(timezone.utc).isoformat()
    for i in range(10):
        await db.upsert_file({
            "path": f"/media/movies/file{i:02d}.mkv", "filename": f"file{i:02d}.mkv",
            "folder": "movies", "size_bytes": (10 - i) * 1_000_000,  # descending size
            "codec": "HEVC", "resolution": "1080p",
            "width": 1920, "height": 1080, "duration_s": 1.0,
            "audio_codec": "AAC", "suggested_action": "skip", "scanned_at": now,
        })
    rows, total = await db.get_files(limit=4, offset=0)
    assert total == 10
    assert len(rows) == 4

    rows2, total2 = await db.get_files(limit=4, offset=4)
    assert total2 == 10
    assert len(rows2) == 4
    # No overlap
    ids1 = {r["id"] for r in rows}
    ids2 = {r["id"] for r in rows2}
    assert ids1.isdisjoint(ids2)


@pytest.mark.asyncio
async def test_get_files_suggested_action_filter(db):
    now = datetime.now(timezone.utc).isoformat()
    for action in ("skip", "reencode", "remux"):
        await db.upsert_file({
            "path": f"/media/movies/{action}.mkv", "filename": f"{action}.mkv",
            "folder": "movies", "size_bytes": 1, "codec": "HEVC", "resolution": "1080p",
            "width": 1920, "height": 1080, "duration_s": 1.0,
            "audio_codec": "AAC", "suggested_action": action, "scanned_at": now,
        })
    rows, total = await db.get_files(suggested_action="reencode")
    assert total == 1
    assert rows[0]["suggested_action"] == "reencode"


@pytest.mark.asyncio
async def test_create_and_get_job(db, db_with_file):
    db, file_rec = db_with_file
    job_id = await db.create_job(
        file_id=file_rec["id"],
        filename=file_rec["filename"],
        action="reencode",
        size_before=file_rec["size_bytes"],
        created_at=datetime.now(timezone.utc).isoformat(),
    )
    assert job_id is not None
    job = await db.get_job_by_id(job_id)
    assert job["action"] == "reencode"
    assert job["status"] == "pending"
    assert job["file_id"] == file_rec["id"]


@pytest.mark.asyncio
async def test_update_job(db, db_with_file):
    db, file_rec = db_with_file
    job_id = await db.create_job(
        file_id=file_rec["id"], filename=file_rec["filename"],
        action="remux", size_before=file_rec["size_bytes"],
        created_at=datetime.now(timezone.utc).isoformat(),
    )
    await db.update_job(job_id, status="done", size_after=4_000_000_000)
    job = await db.get_job_by_id(job_id)
    assert job["status"] == "done"
    assert job["size_after"] == 4_000_000_000


@pytest.mark.asyncio
async def test_get_active_job_for_file(db, db_with_file):
    db, file_rec = db_with_file
    # No job yet
    assert await db.get_active_job_for_file(file_rec["id"]) is None
    job_id = await db.create_job(
        file_id=file_rec["id"], filename=file_rec["filename"],
        action="reencode", size_before=file_rec["size_bytes"],
        created_at=datetime.now(timezone.utc).isoformat(),
    )
    active = await db.get_active_job_for_file(file_rec["id"])
    assert active is not None
    assert active["id"] == job_id
    # After completion, no longer active
    await db.update_job(job_id, status="done")
    assert await db.get_active_job_for_file(file_rec["id"]) is None


@pytest.mark.asyncio
async def test_delete_file_record(db, db_with_file):
    db, file_rec = db_with_file
    await db.delete_file_record(file_rec["id"])
    _, total = await db.get_files()
    assert total == 0


@pytest.mark.asyncio
async def test_stale_file_cleanup(db):
    now = datetime.now(timezone.utc).isoformat()
    for name in ("keep.mkv", "stale.mkv"):
        await db.upsert_file({
            "path": f"/media/movies/{name}", "filename": name, "folder": "movies",
            "size_bytes": 1, "codec": "HEVC", "resolution": "1080p",
            "width": 1920, "height": 1080, "duration_s": 1.0,
            "audio_codec": "AAC", "suggested_action": "skip", "scanned_at": now,
        })
    all_paths = await db.get_all_file_paths()
    assert len(all_paths) == 2

    await db.delete_file_by_path("/media/movies/stale.mkv")
    remaining = await db.get_all_file_paths()
    assert remaining == ["/media/movies/keep.mkv"]


# ─── API endpoints ────────────────────────────────────────────────────────────
# Uses httpx.AsyncClient + ASGITransport so requests run in the same event loop
# as the test — module-level DB_PATH monkeypatching is reliably seen by all code.

@pytest_asyncio.fixture
async def api_client(tmp_path, monkeypatch):
    """Async ASGI test client with isolated DB (no background workers needed)."""
    import database
    monkeypatch.setattr(database, "DB_PATH", str(tmp_path / "api_test.db"))
    monkeypatch.setattr(database, "DATA_DIR", str(tmp_path))
    # Create tables in the same event loop that the tests will use
    await database.init_db()

    from httpx import AsyncClient, ASGITransport
    from main import app
    # ASGITransport does not run ASGI lifespan — we initialised DB above directly
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield client


async def _seed(one=True):
    """Insert sample file(s) into the already-patched DB."""
    import database
    now = datetime.now(timezone.utc).isoformat()
    if one:
        await database.upsert_file({
            "path": "/media/movies/sample.mkv", "filename": "sample.mkv", "folder": "movies",
            "size_bytes": 10_000_000_000, "codec": "AVC", "resolution": "1080p",
            "width": 1920, "height": 1080, "duration_s": 5400.0,
            "audio_codec": "AC-3", "suggested_action": "reencode", "scanned_at": now,
        })
    else:
        for i in range(5):
            await database.upsert_file({
                "path": f"/media/movies/f{i}.mkv", "filename": f"f{i}.mkv",
                "folder": "movies", "size_bytes": (5 - i) * 1_000_000,
                "codec": "HEVC", "resolution": "1080p", "width": 1920, "height": 1080,
                "duration_s": 1.0, "audio_codec": "AAC", "suggested_action": "skip",
                "scanned_at": now,
            })


@pytest.mark.asyncio
async def test_api_files_empty(api_client):
    r = await api_client.get("/api/files")
    assert r.status_code == 200
    body = r.json()
    assert body["items"] == []
    assert body["total"] == 0


@pytest.mark.asyncio
async def test_api_files_with_data(api_client):
    await _seed()
    r = await api_client.get("/api/files")
    assert r.status_code == 200
    body = r.json()
    assert body["total"] == 1
    assert body["items"][0]["filename"] == "sample.mkv"


@pytest.mark.asyncio
async def test_api_files_pagination(api_client):
    await _seed(one=False)
    r = await api_client.get("/api/files?limit=2&offset=0")
    body = r.json()
    assert body["total"] == 5
    assert len(body["items"]) == 2

    r2 = await api_client.get("/api/files?limit=2&offset=2")
    assert len(r2.json()["items"]) == 2


@pytest.mark.asyncio
async def test_api_scan_status(api_client):
    r = await api_client.get("/api/scan/status")
    assert r.status_code == 200
    body = r.json()
    assert "running" in body


@pytest.mark.asyncio
async def test_api_create_job(api_client):
    await _seed()
    file_id = (await api_client.get("/api/files")).json()["items"][0]["id"]
    r = await api_client.post("/api/jobs", json={"file_id": file_id, "action": "reencode"})
    assert r.status_code == 200
    assert r.json()["status"] == "pending"


@pytest.mark.asyncio
async def test_api_create_job_invalid_action(api_client):
    await _seed()
    file_id = (await api_client.get("/api/files")).json()["items"][0]["id"]
    r = await api_client.post("/api/jobs", json={"file_id": file_id, "action": "transcode"})
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_api_create_job_duplicate(api_client):
    await _seed()
    file_id = (await api_client.get("/api/files")).json()["items"][0]["id"]
    await api_client.post("/api/jobs", json={"file_id": file_id, "action": "reencode"})
    r = await api_client.post("/api/jobs", json={"file_id": file_id, "action": "reencode"})
    assert r.status_code == 409


@pytest.mark.asyncio
async def test_api_create_job_missing_file(api_client):
    r = await api_client.post("/api/jobs", json={"file_id": 9999, "action": "reencode"})
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_api_list_jobs(api_client):
    r = await api_client.get("/api/jobs")
    assert r.status_code == 200
    assert isinstance(r.json(), list)


@pytest.mark.asyncio
async def test_api_delete_file_not_found(api_client):
    r = await api_client.delete("/api/files/9999")
    assert r.status_code == 404
