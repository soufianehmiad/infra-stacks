#!/usr/bin/env python3
"""
One-time admin user seed script.

Usage (inside Docker):
  docker compose run --rm api python scripts/seed_admin.py

Or set env vars:
  ADMIN_USERNAME / ADMIN_PASSWORD (from .env)
"""
import asyncio
import os
import sys

# Add app to path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy import select
from app.db.models import User
from app.core.security import hash_password
from app.core.config import settings


async def seed():
    engine = create_async_engine(settings.database_url, echo=False)
    Session = async_sessionmaker(engine, expire_on_commit=False)

    async with Session() as db:
        result = await db.execute(select(User).where(User.username == settings.admin_username))
        existing = result.scalar_one_or_none()
        if existing:
            print(f"[seed] User '{settings.admin_username}' already exists — skipping.")
            return

        user = User(
            username=settings.admin_username,
            password_hash=hash_password(settings.admin_password),
        )
        db.add(user)
        await db.commit()
        print(f"[seed] Created admin user '{settings.admin_username}'.")


if __name__ == "__main__":
    asyncio.run(seed())
