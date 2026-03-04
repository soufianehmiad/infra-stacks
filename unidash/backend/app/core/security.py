"""
Security utilities for JWT and password hashing.

Uses Argon2id for password hashing (winner of Password Hashing Competition).
Uses HS256 (HMAC-SHA256) for JWT signing.
"""
from datetime import datetime, timedelta
from typing import Any
from jose import JWTError, jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from fastapi import HTTPException, status
from ..config import settings

# Argon2 hasher with secure parameters
ph = PasswordHasher(
    time_cost=2,        # Number of iterations
    memory_cost=65536,  # 64 MB memory
    parallelism=2,      # Number of threads
    hash_len=32,        # 32-byte hash
    salt_len=16,        # 16-byte salt
)


def hash_password(password: str) -> str:
    """
    Hash a password using Argon2id.

    Args:
        password: Plain text password

    Returns:
        Hashed password string
    """
    return ph.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    """
    Verify a password against its hash.

    Args:
        password: Plain text password
        password_hash: Hashed password

    Returns:
        True if password matches, False otherwise
    """
    try:
        ph.verify(password_hash, password)

        # Check if rehash needed (parameters changed)
        if ph.check_needs_rehash(password_hash):
            # Caller should rehash the password
            pass

        return True
    except VerifyMismatchError:
        return False


def create_access_token(subject: str, additional_claims: dict[str, Any] | None = None) -> str:
    """
    Create JWT access token with short expiry (15 minutes).

    Args:
        subject: Subject identifier (usually user ID)
        additional_claims: Optional additional JWT claims

    Returns:
        Encoded JWT token string
    """
    expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode = {
        "sub": subject,
        "exp": expire,
        "iat": datetime.utcnow(),
        "type": "access",
    }

    if additional_claims:
        to_encode.update(additional_claims)

    return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(subject: str) -> str:
    """
    Create JWT refresh token with long expiry (7 days).

    Args:
        subject: Subject identifier (usually user ID)

    Returns:
        Encoded JWT token string
    """
    expire = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)

    to_encode = {
        "sub": subject,
        "exp": expire,
        "iat": datetime.utcnow(),
        "type": "refresh",
    }

    return jwt.encode(
        to_encode,
        settings.JWT_REFRESH_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM
    )


def verify_token(token: str, token_type: str = "access") -> str:
    """
    Verify and decode JWT token.

    Args:
        token: JWT token string
        token_type: Expected token type ("access" or "refresh")

    Returns:
        Subject (user ID) from token

    Raises:
        HTTPException: If token is invalid, expired, or wrong type
    """
    try:
        # Select correct secret based on token type
        secret = (
            settings.JWT_SECRET_KEY
            if token_type == "access"
            else settings.JWT_REFRESH_SECRET_KEY
        )

        # Decode and verify token
        payload = jwt.decode(token, secret, algorithms=[settings.JWT_ALGORITHM])

        # Verify token type
        if payload.get("type") != token_type:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid token type. Expected {token_type}",
            )

        # Extract subject
        subject: str = payload.get("sub")
        if subject is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token missing subject",
            )

        return subject

    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
        )
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Could not validate token: {str(e)}",
        )
