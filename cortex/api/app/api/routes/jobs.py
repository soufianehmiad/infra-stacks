# cortex/api/app/api/routes/jobs.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from app.db.session import get_db
from app.db.models import Job, StatusEnum, ActionEnum
from app.core.deps import get_current_user

router = APIRouter(prefix="/jobs", tags=["jobs"])


class CreateJobRequest(BaseModel):
    file_id: int
    action: str


@router.get("/")
async def list_jobs(
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    result = await db.execute(
        select(Job).order_by(Job.created_at.desc()).limit(200)
    )
    jobs = result.scalars().all()
    return [
        {c.key: getattr(j, c.key) for c in j.__table__.columns}
        for j in jobs
    ]


@router.post("/")
async def create_job(
    req: CreateJobRequest,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    try:
        action = ActionEnum(req.action)
    except ValueError:
        raise HTTPException(400, f"Invalid action: {req.action}")

    job = Job(file_id=req.file_id, action=action, status=StatusEnum.pending)
    db.add(job)
    await db.commit()
    await db.refresh(job)
    return {c.key: getattr(job, c.key) for c in job.__table__.columns}


@router.delete("/{job_id}")
async def cancel_job(
    job_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    result = await db.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(404, "Job not found")
    if job.status in (StatusEnum.done, StatusEnum.failed, StatusEnum.cancelled):
        raise HTTPException(400, "Job already finished")
    job.status = StatusEnum.cancelled
    await db.commit()
    return {"ok": True}
