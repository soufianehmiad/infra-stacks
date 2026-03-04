from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class FileRecord(BaseModel):
    id: int
    path: str
    filename: str
    folder: str
    size_bytes: int
    codec: str
    resolution: str
    width: int
    height: int
    duration_s: float
    audio_codec: str
    suggested_action: str
    scanned_at: str


class JobRecord(BaseModel):
    id: int
    file_id: int
    filename: str
    action: str
    status: str  # pending|running|done|failed|reverted|cancelled
    progress: int
    eta_s: Optional[int]
    size_before: Optional[int]
    size_after: Optional[int]
    created_at: str
    started_at: Optional[str]
    finished_at: Optional[str]
    error: Optional[str]


class CreateJobRequest(BaseModel):
    file_id: int
    action: str  # reencode|remux|downscale|delete


class StorageInfo(BaseModel):
    folder: str
    used_bytes: int
    total_bytes: int
    free_bytes: int


class StorageSnapshot(BaseModel):
    date: str
    movies_bytes: int
    series_bytes: int
    anime_bytes: int
    downloads_bytes: int
    saved_bytes: int


class ScanStatus(BaseModel):
    running: bool
    scanned: int
    total: int


class WsMessage(BaseModel):
    pct: int
    eta_s: Optional[int]
    status: str


class TunnelControlRequest(BaseModel):
    action: str  # start|stop|restart


class IngressRule(BaseModel):
    hostname: Optional[str] = None
    path: Optional[str] = None
    service: str


class UpdateIngressRequest(BaseModel):
    rules: List[IngressRule]
