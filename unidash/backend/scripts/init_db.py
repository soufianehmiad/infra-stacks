#!/usr/bin/env python3
"""
Database initialization script.

Creates tables and initial admin user.
Run this once before starting the application.
"""
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.db import Base, engine, SessionLocal
from app.db.models import User
from app.core.security import hash_password
from app.config import settings


def init_database():
    """Create all database tables."""
    print("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    print("✓ Database tables created")


def create_admin_user(username: str = "admin", password: str = "admin"):
    """
    Create initial admin user.

    Args:
        username: Admin username (default: admin)
        password: Admin password (default: admin)

    SECURITY: Change the default password immediately after first login!
    """
    db = SessionLocal()

    try:
        # Check if admin already exists
        existing_admin = db.query(User).filter(User.username == username).first()
        if existing_admin:
            print(f"⚠ Admin user '{username}' already exists")
            return

        # Create admin user
        admin = User(
            username=username,
            password_hash=hash_password(password),
            is_admin=True,
            is_active=True,
        )

        db.add(admin)
        db.commit()
        db.refresh(admin)

        print(f"✓ Admin user created:")
        print(f"  Username: {username}")
        print(f"  Password: {password}")
        print(f"  User ID: {admin.id}")
        print("\n⚠️  SECURITY WARNING: Change the default password immediately!")

    except Exception as e:
        print(f"✗ Failed to create admin user: {e}")
        db.rollback()
        raise
    finally:
        db.close()


def main():
    """Main initialization routine."""
    print("=" * 60)
    print("UniDash Database Initialization")
    print("=" * 60)
    print()

    # Initialize database
    init_database()
    print()

    # Create admin user
    create_admin_user()
    print()

    print("=" * 60)
    print("Initialization complete!")
    print("=" * 60)


if __name__ == "__main__":
    main()
