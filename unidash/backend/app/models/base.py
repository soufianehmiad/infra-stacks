"""Base Pydantic models and enums"""
from pydantic import BaseModel, ConfigDict, Field
from datetime import datetime
from enum import Enum


class StatusEnum(str, Enum):
    """Container status enumeration"""
    RUNNING = "running"
    STOPPED = "stopped"
    PAUSED = "paused"
    RESTARTING = "restarting"
    UNKNOWN = "unknown"


class TimestampedModel(BaseModel):
    """Base model with automatic timestamps"""
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={"ts_export": True}
    )


class BaseResponse(BaseModel):
    """Standard API response wrapper"""
    success: bool = True
    message: str | None = None

    model_config = ConfigDict(json_schema_extra={"ts_export": True})
