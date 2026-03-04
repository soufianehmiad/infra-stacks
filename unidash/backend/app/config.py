"""Application configuration with Pydantic Settings"""
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Literal
import secrets


class Settings(BaseSettings):
    """Application settings with validation"""

    # Application
    APP_NAME: str = "UniDash"
    APP_VERSION: str = "2.0.0"
    ENV: Literal["development", "production"] = "development"
    DEBUG: bool = False

    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # Security - JWT
    JWT_SECRET_KEY: str = secrets.token_urlsafe(32)
    JWT_REFRESH_SECRET_KEY: str = secrets.token_urlsafe(32)
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Security - Rate Limiting
    RATE_LIMIT_PER_MINUTE: int = 60
    MAX_LOGIN_ATTEMPTS: int = 5
    LOCKOUT_DURATION_MINUTES: int = 15

    # Database
    DATABASE_URL: str = "sqlite:///./unidash.db"

    # Docker
    DOCKER_HOST: str = "unix:///var/run/docker.sock"

    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:9999"]

    # Logging
    LOG_LEVEL: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )


# Global settings instance
settings = Settings()
