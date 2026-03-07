# cortex/api/app/core/config.py
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    postgres_host: str
    postgres_port: int = 5432
    postgres_db: str
    postgres_user: str
    postgres_password: str
    redis_host: str
    redis_port: int = 6379
    redis_password: str = ""
    secret_key: str
    admin_username: str = "admin"
    admin_password: str
    cf_host: str = "10.99.0.50"
    cf_user: str = "root"
    cf_key: str = "/run/secrets/cf_key"
    pve_host: str = "10.99.0.254"
    pve_token_id: str = ""
    pve_token_secret: str = ""

    @property
    def database_url(self) -> str:
        return (f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}"
                f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}")

    @property
    def redis_url(self) -> str:
        if self.redis_password:
            return f"redis://:{self.redis_password}@{self.redis_host}:{self.redis_port}"
        return f"redis://{self.redis_host}:{self.redis_port}"

    class Config:
        env_file = ".env"


settings = Settings()
