# cortex/api/app/core/deps.py
from fastapi import Depends, HTTPException, Cookie
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import get_db
from app.db.models import User
from app.core.security import decode_token
from app.core.redis import get_redis


async def get_current_user(
    access_token: str | None = Cookie(default=None),
    db: AsyncSession = Depends(get_db),
) -> User:
    if not access_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = decode_token(access_token)
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid token")

    user_id = int(payload["sub"])
    redis = get_redis()
    if await redis.exists(f"blocklist:{access_token}"):
        raise HTTPException(status_code=401, detail="Token revoked")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user
