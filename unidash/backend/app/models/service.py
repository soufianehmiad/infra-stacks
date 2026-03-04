"""Service discovery and management models"""
from pydantic import BaseModel, Field, ConfigDict, HttpUrl
from typing import Literal
from .base import StatusEnum


class ServiceBase(BaseModel):
    """Base service information"""
    id: str = Field(..., description="Container ID (12 char short hash)")
    name: str = Field(..., description="Display name (e.g., 'Sonarr')")
    container_name: str = Field(..., description="Docker container name")
    type: str = Field(..., description="Service type identifier")
    internal_port: int = Field(..., description="Internal container port", ge=1, le=65535)
    proxy_path: str | None = Field(None, description="URL path for reverse proxy")
    icon: str | None = Field(None, description="Icon filename (e.g., 'sonarr.svg')")
    status: StatusEnum = Field(default=StatusEnum.UNKNOWN, description="Container status")

    model_config = ConfigDict(
        json_schema_extra={"ts_export": True},
        from_attributes=True
    )


class ServiceResponse(ServiceBase):
    """Service with computed fields and metrics"""
    target_url: str = Field(..., description="Internal proxy target URL")
    health_status: Literal["healthy", "degraded", "unhealthy"] | None = Field(
        None,
        description="Health check status"
    )
    uptime_seconds: float | None = Field(None, description="Container uptime in seconds")
    cpu_usage: float | None = Field(None, description="CPU usage percentage", ge=0, le=100)
    memory_usage: float | None = Field(None, description="Memory usage in MB", ge=0)


class ServiceList(BaseModel):
    """Paginated service list response"""
    services: list[ServiceResponse]
    total: int = Field(..., description="Total number of services")
    page: int = Field(default=1, description="Current page number", ge=1)
    page_size: int = Field(default=100, description="Items per page", ge=1, le=1000)

    model_config = ConfigDict(json_schema_extra={"ts_export": True})


class ServiceActionRequest(BaseModel):
    """Service action request"""
    action: Literal["start", "stop", "restart"] = Field(..., description="Action to perform")

    model_config = ConfigDict(json_schema_extra={"ts_export": True})


class ServiceActionResponse(BaseModel):
    """Service action response"""
    success: bool
    message: str
    service_id: str
    new_status: StatusEnum

    model_config = ConfigDict(json_schema_extra={"ts_export": True})
