"""
SQLAlchemy database models.

Stores users, refresh tokens, and audit logs.
"""
from datetime import datetime
from sqlalchemy import Boolean, Column, String, Integer, DateTime, ForeignKey, Text, Index
from sqlalchemy.orm import relationship
from .session import Base
import uuid


def generate_uuid() -> str:
    """Generate UUID string for primary keys."""
    return str(uuid.uuid4())


class User(Base):
    """
    User account model.

    Stores user credentials and profile information.
    """
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=True, index=True)
    password_hash = Column(String(255), nullable=False)

    is_active = Column(Boolean, default=True, nullable=False)
    is_admin = Column(Boolean, default=False, nullable=False)

    failed_login_attempts = Column(Integer, default=0, nullable=False)
    last_failed_login = Column(DateTime, nullable=True)
    locked_until = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    last_login = Column(DateTime, nullable=True)

    # Relationships
    refresh_tokens = relationship("RefreshToken", back_populates="user", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="user", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<User(id={self.id}, username={self.username})>"


class RefreshToken(Base):
    """
    Refresh token model.

    Stores active refresh tokens for token rotation.
    Allows revoking tokens on logout or security events.
    """
    __tablename__ = "refresh_tokens"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    token_hash = Column(String(64), unique=True, nullable=False, index=True)  # SHA-256 hash

    expires_at = Column(DateTime, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    revoked_at = Column(DateTime, nullable=True)

    # Track where token was issued from
    ip_address = Column(String(45), nullable=True)  # IPv6 max length
    user_agent = Column(String(500), nullable=True)

    # Relationships
    user = relationship("User", back_populates="refresh_tokens")

    # Index for cleanup queries
    __table_args__ = (
        Index('ix_refresh_tokens_expires_revoked', 'expires_at', 'revoked_at'),
    )

    def __repr__(self):
        return f"<RefreshToken(id={self.id}, user_id={self.user_id})>"


class AuditLog(Base):
    """
    Audit log model.

    Tracks security-relevant events for compliance and forensics.
    """
    __tablename__ = "audit_logs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)

    event_type = Column(String(50), nullable=False, index=True)  # login, logout, token_refresh, etc.
    event_status = Column(String(20), nullable=False)  # success, failure

    ip_address = Column(String(45), nullable=True)
    user_agent = Column(String(500), nullable=True)

    details = Column(Text, nullable=True)  # JSON string with additional context

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    # Relationships
    user = relationship("User", back_populates="audit_logs")

    # Composite index for querying logs
    __table_args__ = (
        Index('ix_audit_logs_user_event_created', 'user_id', 'event_type', 'created_at'),
    )

    def __repr__(self):
        return f"<AuditLog(id={self.id}, event_type={self.event_type})>"
