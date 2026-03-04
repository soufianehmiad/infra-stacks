"""WebSocket message models"""
from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime
from typing import Literal, Any
from .base import StatusEnum


class WSMessage(BaseModel):
    """Base WebSocket message structure"""
    type: str = Field(..., description="Message type identifier")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="Message timestamp")
    data: dict[str, Any] = Field(default_factory=dict, description="Message payload")

    model_config = ConfigDict(json_schema_extra={"ts_export": True})


class PingMessage(WSMessage):
    """Client ping message for keep-alive"""
    type: Literal["ping"] = "ping"


class PongMessage(WSMessage):
    """Server pong response"""
    type: Literal["pong"] = "pong"


class ServiceUpdateMessage(WSMessage):
    """Service state change notification"""
    type: Literal["service_update"] = "service_update"
    service_id: str = Field(..., description="Container ID that changed")
    action: Literal["added", "removed", "updated", "status_changed"] = Field(
        ...,
        description="Type of change"
    )
    new_status: StatusEnum | None = Field(None, description="New status (if status changed)")

    model_config = ConfigDict(json_schema_extra={"ts_export": True})


class MetricsMessage(WSMessage):
    """System metrics update"""
    type: Literal["metrics"] = "metrics"
    cpu_usage: float = Field(..., description="CPU usage percentage", ge=0, le=100)
    memory_usage: float = Field(..., description="Memory usage in MB", ge=0)
    memory_total: float = Field(..., description="Total memory in MB", ge=0)
    network_rx: float = Field(..., description="Network received MB/s", ge=0)
    network_tx: float = Field(..., description="Network transmitted MB/s", ge=0)
    disk_usage: float = Field(..., description="Disk usage percentage", ge=0, le=100)

    model_config = ConfigDict(json_schema_extra={"ts_export": True})


class NotificationMessage(WSMessage):
    """User notification message"""
    type: Literal["notification"] = "notification"
    level: Literal["info", "success", "warning", "error"] = Field(..., description="Notification level")
    title: str = Field(..., description="Notification title")
    message: str = Field(..., description="Notification message")

    model_config = ConfigDict(json_schema_extra={"ts_export": True})


class ErrorMessage(WSMessage):
    """Error message"""
    type: Literal["error"] = "error"
    error: str = Field(..., description="Error message")
    code: int | None = Field(None, description="Error code")

    model_config = ConfigDict(json_schema_extra={"ts_export": True})
