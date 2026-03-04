# cortex/api/app/api/routes/storage.py
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import get_db
from app.db.models import StorageSnapshot
from app.core.deps import get_current_user

router = APIRouter(prefix="/storage", tags=["storage"])


@router.get("/")
async def get_current_storage(
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    """Return latest snapshot per folder."""
    result = await db.execute(
        select(StorageSnapshot).order_by(StorageSnapshot.taken_at.desc()).limit(10)
    )
    snapshots = result.scalars().all()
    seen = {}
    for s in snapshots:
        if s.folder not in seen:
            seen[s.folder] = {c.key: getattr(s, c.key) for c in s.__table__.columns}
    return list(seen.values())


@router.get("/history")
async def get_storage_history(
    days: int = 30,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    since = datetime.utcnow() - timedelta(days=days)
    result = await db.execute(
        select(StorageSnapshot)
        .where(StorageSnapshot.taken_at >= since)
        .order_by(StorageSnapshot.taken_at.asc())
    )
    snapshots = result.scalars().all()
    return [
        {c.key: getattr(s, c.key) for c in s.__table__.columns}
        for s in snapshots
    ]
