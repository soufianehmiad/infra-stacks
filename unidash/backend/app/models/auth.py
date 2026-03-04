"""Authentication and authorization models"""
from pydantic import BaseModel, Field, ConfigDict, field_validator
from datetime import datetime
from typing import Literal
import re


class TokenPayload(BaseModel):
    """JWT token payload structure"""
    sub: str = Field(..., description="Subject (user ID)")
    exp: datetime = Field(..., description="Expiration timestamp")
    iat: datetime = Field(default_factory=datetime.utcnow, description="Issued at timestamp")
    type: Literal["access", "refresh"] = Field(default="access", description="Token type")

    model_config = ConfigDict(json_schema_extra={"ts_export": True})


class LoginRequest(BaseModel):
    """User login credentials"""
    username: str = Field(..., min_length=1, max_length=100, description="Username")
    password: str = Field(..., min_length=1, description="Password")

    model_config = ConfigDict(json_schema_extra={"ts_export": True})


class LoginResponse(BaseModel):
    """Login success response with tokens"""
    access_token: str = Field(..., description="JWT access token (15min)")
    refresh_token: str = Field(..., description="JWT refresh token (7 days)")
    token_type: str = Field(default="bearer", description="Token type")
    expires_in: int = Field(default=900, description="Access token expiry in seconds")
    user: "UserInfo" = Field(..., description="User information")

    model_config = ConfigDict(json_schema_extra={"ts_export": True})


class RefreshRequest(BaseModel):
    """Token refresh request"""
    refresh_token: str = Field(..., description="Refresh token")

    model_config = ConfigDict(json_schema_extra={"ts_export": True})


class RefreshResponse(BaseModel):
    """Token refresh response"""
    access_token: str = Field(..., description="New JWT access token")
    expires_in: int = Field(default=900, description="Token expiry in seconds")

    model_config = ConfigDict(json_schema_extra={"ts_export": True})


class UserInfo(BaseModel):
    """User information (non-sensitive)"""
    id: str = Field(..., description="User ID")
    username: str = Field(..., description="Username")
    email: str | None = Field(None, description="Email address")
    is_admin: bool = Field(default=False, description="Admin privileges")
    created_at: datetime | None = Field(None, description="Account creation timestamp")

    model_config = ConfigDict(
        json_schema_extra={"ts_export": True},
        from_attributes=True
    )


class ChangePasswordRequest(BaseModel):
    """Password change request"""
    current_password: str = Field(..., min_length=1, description="Current password")
    new_password: str = Field(..., min_length=8, description="New password (min 8 chars)")

    @field_validator("new_password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        """Validate password meets security requirements"""
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not re.search(r"[a-z]", v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not re.search(r"[0-9]", v):
            raise ValueError("Password must contain at least one digit")
        return v

    model_config = ConfigDict(json_schema_extra={"ts_export": True})
