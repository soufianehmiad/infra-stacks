# cortex/api/app/api/routes/auth.py
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Response, Cookie
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from app.db.session import get_db
from app.db.models import User
from app.core.security import verify_password, create_access_token, create_refresh_token, decode_token
from app.core.redis import get_redis

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    username: str
    password: str


@router.post("/login")
async def login(req: LoginRequest, response: Response, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.username == req.username))
    user = result.scalar_one_or_none()

    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if user.locked_until and user.locked_until > datetime.utcnow():
        raise HTTPException(status_code=403, detail="Account locked")

    access_token = create_access_token(user.id)
    refresh_token = create_refresh_token(user.id)

    redis = get_redis()
    await redis.setex(f"session:{user.id}:refresh", 60 * 60 * 24 * 7, refresh_token)

    user.last_login = datetime.utcnow()
    user.failed_attempts = 0
    await db.commit()

    response.set_cookie("access_token", access_token, httponly=True, secure=False, samesite="lax", max_age=900)
    response.set_cookie("refresh_token", refresh_token, httponly=True, secure=False, samesite="lax", max_age=60 * 60 * 24 * 7)
    response.set_cookie("unidash_auth", "1", secure=False, samesite="lax", max_age=60 * 60 * 24 * 7)
    return {"ok": True}


@router.post("/refresh")
async def refresh(response: Response, refresh_token: str | None = Cookie(default=None)):
    if not refresh_token:
        raise HTTPException(status_code=401, detail="No refresh token")
    try:
        payload = decode_token(refresh_token)
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    user_id = int(payload["sub"])
    redis = get_redis()
    stored = await redis.get(f"session:{user_id}:refresh")
    if stored != refresh_token:
        raise HTTPException(status_code=401, detail="Refresh token reuse detected")

    new_access = create_access_token(user_id)
    new_refresh = create_refresh_token(user_id)
    await redis.setex(f"session:{user_id}:refresh", 60 * 60 * 24 * 7, new_refresh)

    response.set_cookie("access_token", new_access, httponly=True, secure=False, samesite="lax", max_age=900)
    response.set_cookie("refresh_token", new_refresh, httponly=True, secure=False, samesite="lax", max_age=60 * 60 * 24 * 7)
    return {"ok": True}


@router.post("/logout")
async def logout(response: Response, access_token: str | None = Cookie(default=None)):
    if access_token:
        redis = get_redis()
        await redis.setex(f"blocklist:{access_token}", 900, "1")
    response.delete_cookie("access_token", httponly=True, secure=False, samesite="lax")
    response.delete_cookie("refresh_token", httponly=True, secure=False, samesite="lax")
    response.delete_cookie("unidash_auth", secure=False, samesite="lax")
    return {"ok": True}
