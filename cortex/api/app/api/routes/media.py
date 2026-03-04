# cortex/api/app/api/routes/media.py
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, asc, desc
from app.db.session import get_db
from app.db.models import MediaFile
from app.core.deps import get_current_user

router = APIRouter(prefix="/media", tags=["media"])


@router.get("/")
async def list_media(
    folder: str | None = None,
    codec: str | None = None,
    search: str | None = None,
    limit: int = 100,
    offset: int = 0,
    sort_by: str = "size_bytes",
    sort_dir: str = "desc",
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    q = select(MediaFile)
    if folder:
        q = q.where(MediaFile.folder == folder)
    if codec:
        q = q.where(MediaFile.codec == codec)
    if search:
        q = q.where(MediaFile.filename.ilike(f"%{search}%"))

    sort_col = getattr(MediaFile, sort_by, MediaFile.size_bytes)
    order = desc(sort_col) if sort_dir == "desc" else asc(sort_col)
    total = await db.scalar(select(func.count()).select_from(q.subquery()))
    result = await db.execute(q.order_by(order).limit(limit).offset(offset))
    items = result.scalars().all()
    return {"items": [
        {c.key: getattr(r, c.key) for c in r.__table__.columns}
        for r in items
    ], "total": total}


@router.get("/{file_id}")
async def get_media_file(
    file_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    result = await db.execute(select(MediaFile).where(MediaFile.id == file_id))
    f = result.scalar_one_or_none()
    if not f:
        from fastapi import HTTPException
        raise HTTPException(404, "File not found")
    return {c.key: getattr(f, c.key) for c in f.__table__.columns}
