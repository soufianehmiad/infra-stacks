"""Health check models"""
from pydantic import BaseModel, Field, ConfigDict
from typing import Literal
from datetime import datetime


class HealthCheck(BaseModel):
    """Application health check response"""
    status: Literal["healthy", "degraded", "unhealthy"] = Field(
        ...,
        description="Overall health status"
    )
    version: str = Field(..., description="Application version")
    environment: str = Field(..., description="Deployment environment")
    uptime_seconds: float | None = Field(None, description="Application uptime in seconds", ge=0)
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="Check timestamp")
    services_count: int | None = Field(None, description="Number of discovered services", ge=0)
    checks: dict[str, bool] = Field(
        default_factory=dict,
        description="Individual component health checks"
    )

    model_config = ConfigDict(json_schema_extra={"ts_export": True})


class ComponentHealth(BaseModel):
    """Individual component health status"""
    name: str = Field(..., description="Component name")
    healthy: bool = Field(..., description="Whether component is healthy")
    message: str | None = Field(None, description="Status message or error")
    response_time_ms: float | None = Field(None, description="Response time in milliseconds", ge=0)

    model_config = ConfigDict(json_schema_extra={"ts_export": True})


class DetailedHealthCheck(HealthCheck):
    """Detailed health check with component breakdown"""
    components: list[ComponentHealth] = Field(
        default_factory=list,
        description="Individual component health details"
    )

    model_config = ConfigDict(json_schema_extra={"ts_export": True})
