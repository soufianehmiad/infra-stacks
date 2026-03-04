"""
Authentication API routes.

Handles login, token refresh, logout, and user profile.
"""
from datetime import datetime, timedelta
from typing import Annotated
import hashlib
import json
from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
from sqlalchemy.orm import Session
from ...config import settings
from ...core.security import (
    verify_password,
    create_access_token,
    create_refresh_token,
    verify_token,
)
from ...core.dependencies import CurrentUser, get_db
from ...db.models import User, RefreshToken, AuditLog
from ...models.auth import LoginRequest, LoginResponse, UserInfo

router = APIRouter(prefix="/auth", tags=["authentication"])


def hash_token(token: str) -> str:
    """Hash token for storage (SHA-256)."""
    return hashlib.sha256(token.encode()).hexdigest()


def create_audit_log(
    db: Session,
    user_id: str | None,
    event_type: str,
    event_status: str,
    request: Request,
    details: dict | None = None,
):
    """Create audit log entry."""
    log = AuditLog(
        user_id=user_id,
        event_type=event_type,
        event_status=event_status,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        details=json.dumps(details) if details else None,
    )
    db.add(log)
    db.commit()


def check_account_lockout(user: User) -> bool:
    """
    Check if account is locked due to failed login attempts.

    Returns True if account is locked, False otherwise.
    """
    if user.locked_until and user.locked_until > datetime.utcnow():
        return True

    # Reset lock if expired
    if user.locked_until and user.locked_until <= datetime.utcnow():
        user.locked_until = None
        user.failed_login_attempts = 0

    return False


def handle_failed_login(db: Session, user: User):
    """Handle failed login attempt with account lockout."""
    user.failed_login_attempts += 1
    user.last_failed_login = datetime.utcnow()

    # Lock account after MAX_LOGIN_ATTEMPTS
    if user.failed_login_attempts >= settings.MAX_LOGIN_ATTEMPTS:
        user.locked_until = datetime.utcnow() + timedelta(
            minutes=settings.LOCKOUT_DURATION_MINUTES
        )

    db.commit()


@router.post("/login", response_model=LoginResponse)
async def login(
    credentials: LoginRequest,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
):
    """
    Authenticate user and issue JWT tokens.

    Returns access token (15min) and refresh token (7 days).
    Implements rate limiting and account lockout on failed attempts.
    """
    # Find user by username
    user = db.query(User).filter(User.username == credentials.username).first()

    if not user:
        # Generic error to prevent username enumeration
        create_audit_log(
            db, None, "login", "failure",
            request, {"reason": "user_not_found", "username": credentials.username}
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )

    # Check account lockout
    if check_account_lockout(user):
        locked_minutes = int((user.locked_until - datetime.utcnow()).total_seconds() / 60)
        create_audit_log(
            db, user.id, "login", "failure",
            request, {"reason": "account_locked"}
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Account locked due to multiple failed attempts. Try again in {locked_minutes} minutes.",
        )

    # Check if account is active
    if not user.is_active:
        create_audit_log(
            db, user.id, "login", "failure",
            request, {"reason": "account_disabled"}
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled",
        )

    # Verify password
    if not verify_password(credentials.password, user.password_hash):
        handle_failed_login(db, user)
        create_audit_log(
            db, user.id, "login", "failure",
            request, {"reason": "invalid_password"}
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )

    # Successful login - reset failed attempts
    user.failed_login_attempts = 0
    user.last_failed_login = None
    user.locked_until = None
    user.last_login = datetime.utcnow()
    db.commit()

    # Create tokens
    access_token = create_access_token(user.id)
    refresh_token = create_refresh_token(user.id)

    # Store refresh token in database
    token_record = RefreshToken(
        user_id=user.id,
        token_hash=hash_token(refresh_token),
        expires_at=datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    db.add(token_record)
    db.commit()

    # Audit log
    create_audit_log(db, user.id, "login", "success", request)

    return LoginResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="Bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=UserInfo(
            id=user.id,
            username=user.username,
            email=user.email,
            is_admin=user.is_admin,
        ),
    )


@router.post("/refresh", response_model=LoginResponse)
async def refresh_tokens(
    request: Request,
    refresh_token: str,
    db: Annotated[Session, Depends(get_db)],
):
    """
    Refresh access token using refresh token.

    Implements token rotation: issues new refresh token and revokes old one.
    """
    # Verify refresh token
    try:
        user_id = verify_token(refresh_token, token_type="refresh")
    except HTTPException:
        create_audit_log(
            db, None, "token_refresh", "failure",
            request, {"reason": "invalid_token"}
        )
        raise

    # Check if token exists and is not revoked
    token_hash = hash_token(refresh_token)
    token_record = (
        db.query(RefreshToken)
        .filter(
            RefreshToken.token_hash == token_hash,
            RefreshToken.revoked_at.is_(None),
            RefreshToken.expires_at > datetime.utcnow(),
        )
        .first()
    )

    if not token_record:
        create_audit_log(
            db, user_id, "token_refresh", "failure",
            request, {"reason": "token_revoked_or_expired"}
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token is invalid or expired",
        )

    # Get user
    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.is_active:
        create_audit_log(
            db, user_id, "token_refresh", "failure",
            request, {"reason": "user_not_found_or_disabled"}
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or disabled",
        )

    # Token rotation: revoke old token
    token_record.revoked_at = datetime.utcnow()

    # Create new tokens
    new_access_token = create_access_token(user.id)
    new_refresh_token = create_refresh_token(user.id)

    # Store new refresh token
    new_token_record = RefreshToken(
        user_id=user.id,
        token_hash=hash_token(new_refresh_token),
        expires_at=datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    db.add(new_token_record)
    db.commit()

    # Audit log
    create_audit_log(db, user.id, "token_refresh", "success", request)

    return LoginResponse(
        access_token=new_access_token,
        refresh_token=new_refresh_token,
        token_type="Bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=UserInfo(
            id=user.id,
            username=user.username,
            email=user.email,
            is_admin=user.is_admin,
        ),
    )


@router.post("/logout")
async def logout(
    request: Request,
    refresh_token: str,
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
):
    """
    Logout user by revoking refresh token.

    Requires valid access token. Revokes the provided refresh token.
    """
    # Revoke the refresh token
    token_hash = hash_token(refresh_token)
    token_record = (
        db.query(RefreshToken)
        .filter(
            RefreshToken.token_hash == token_hash,
            RefreshToken.user_id == current_user.id,
            RefreshToken.revoked_at.is_(None),
        )
        .first()
    )

    if token_record:
        token_record.revoked_at = datetime.utcnow()
        db.commit()

    # Audit log
    create_audit_log(db, current_user.id, "logout", "success", request)

    return {"message": "Successfully logged out"}


@router.get("/me", response_model=UserInfo)
async def get_current_user_info(current_user: CurrentUser):
    """
    Get current user information.

    Requires valid access token.
    """
    return UserInfo(
        id=current_user.id,
        username=current_user.username,
        email=current_user.email,
        is_admin=current_user.is_admin,
    )
