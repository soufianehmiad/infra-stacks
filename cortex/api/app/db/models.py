# cortex/api/app/db/models.py
import enum
from datetime import datetime
from sqlalchemy import (String, Integer, BigInteger, Float, Text, Boolean,
                        DateTime, Enum, ForeignKey, JSON)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(256), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    last_login: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    failed_attempts: Mapped[int] = mapped_column(Integer, default=0)
    locked_until: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class Service(Base):
    __tablename__ = "services"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    container_id: Mapped[str] = mapped_column(String(64), unique=True)
    name: Mapped[str] = mapped_column(String(128))
    type: Mapped[str] = mapped_column(String(64), nullable=True)
    url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    port: Mapped[int | None] = mapped_column(Integer, nullable=True)
    path: Mapped[str | None] = mapped_column(String(256), nullable=True)
    icon: Mapped[str | None] = mapped_column(String(64), nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="unknown")
    labels: Mapped[dict] = mapped_column(JSON, default=dict)
    discovered_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    last_seen: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class ActionEnum(str, enum.Enum):
    reencode = "reencode"
    remux = "remux"
    downscale = "downscale"
    delete = "delete"


class StatusEnum(str, enum.Enum):
    pending = "pending"
    running = "running"
    done = "done"
    failed = "failed"
    cancelled = "cancelled"


class MediaFile(Base):
    __tablename__ = "media_files"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    path: Mapped[str] = mapped_column(String(1024), unique=True)
    filename: Mapped[str] = mapped_column(String(512))
    folder: Mapped[str] = mapped_column(String(128))
    size_bytes: Mapped[int] = mapped_column(BigInteger, default=0)
    codec: Mapped[str | None] = mapped_column(String(64), nullable=True)
    resolution: Mapped[str | None] = mapped_column(String(32), nullable=True)
    bitrate: Mapped[int | None] = mapped_column(Integer, nullable=True)
    duration: Mapped[float | None] = mapped_column(Float, nullable=True)
    audio: Mapped[str | None] = mapped_column(String(128), nullable=True)
    suggested_action: Mapped[str | None] = mapped_column(String(32), nullable=True)
    scanned_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    flagged: Mapped[bool] = mapped_column(Boolean, default=False)
    jobs: Mapped[list["Job"]] = relationship("Job", back_populates="media_file")


class Job(Base):
    __tablename__ = "jobs"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    file_id: Mapped[int] = mapped_column(ForeignKey("media_files.id"))
    action: Mapped[ActionEnum] = mapped_column(Enum(ActionEnum))
    status: Mapped[StatusEnum] = mapped_column(Enum(StatusEnum), default=StatusEnum.pending)
    size_before: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    size_after: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    progress: Mapped[float] = mapped_column(Float, default=0)
    eta_s: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    log: Mapped[str] = mapped_column(Text, default="")
    media_file: Mapped["MediaFile"] = relationship("MediaFile", back_populates="jobs")


class StorageSnapshot(Base):
    __tablename__ = "storage_snapshots"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    folder: Mapped[str] = mapped_column(String(128))
    used_bytes: Mapped[int] = mapped_column(BigInteger)
    total_bytes: Mapped[int] = mapped_column(BigInteger)
    saved_bytes: Mapped[int] = mapped_column(BigInteger, default=0)
    taken_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
