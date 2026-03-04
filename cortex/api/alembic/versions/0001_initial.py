"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-02-28

"""
from alembic import op
import sqlalchemy as sa

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("username", sa.String(64), unique=True, nullable=False),
        sa.Column("password_hash", sa.String(256), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("last_login", sa.DateTime(), nullable=True),
        sa.Column("failed_attempts", sa.Integer(), default=0),
        sa.Column("locked_until", sa.DateTime(), nullable=True),
    )

    op.create_table(
        "services",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("container_id", sa.String(64), unique=True),
        sa.Column("name", sa.String(128)),
        sa.Column("type", sa.String(64), nullable=True),
        sa.Column("url", sa.String(512), nullable=True),
        sa.Column("port", sa.Integer(), nullable=True),
        sa.Column("path", sa.String(256), nullable=True),
        sa.Column("icon", sa.String(64), nullable=True),
        sa.Column("status", sa.String(32), default="unknown"),
        sa.Column("labels", sa.JSON(), nullable=True),
        sa.Column("discovered_at", sa.DateTime(), nullable=True),
        sa.Column("last_seen", sa.DateTime(), nullable=True),
    )

    op.create_table(
        "media_files",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("path", sa.String(1024), unique=True),
        sa.Column("filename", sa.String(512)),
        sa.Column("folder", sa.String(128)),
        sa.Column("size_bytes", sa.BigInteger(), default=0),
        sa.Column("codec", sa.String(64), nullable=True),
        sa.Column("resolution", sa.String(32), nullable=True),
        sa.Column("bitrate", sa.Integer(), nullable=True),
        sa.Column("duration", sa.Float(), nullable=True),
        sa.Column("audio", sa.String(128), nullable=True),
        sa.Column("suggested_action", sa.String(32), nullable=True),
        sa.Column("scanned_at", sa.DateTime(), nullable=True),
        sa.Column("flagged", sa.Boolean(), default=False),
    )

    action_enum = sa.Enum("reencode", "remux", "downscale", "delete", name="actionenum")
    status_enum = sa.Enum("pending", "running", "done", "failed", "cancelled", name="statusenum")

    op.create_table(
        "jobs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("file_id", sa.Integer(), sa.ForeignKey("media_files.id")),
        sa.Column("action", action_enum),
        sa.Column("status", status_enum, default="pending"),
        sa.Column("size_before", sa.BigInteger(), nullable=True),
        sa.Column("size_after", sa.BigInteger(), nullable=True),
        sa.Column("progress", sa.Float(), default=0),
        sa.Column("eta_s", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("finished_at", sa.DateTime(), nullable=True),
        sa.Column("log", sa.Text(), default=""),
    )

    op.create_table(
        "storage_snapshots",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("folder", sa.String(128)),
        sa.Column("used_bytes", sa.BigInteger()),
        sa.Column("total_bytes", sa.BigInteger()),
        sa.Column("saved_bytes", sa.BigInteger(), default=0),
        sa.Column("taken_at", sa.DateTime(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("storage_snapshots")
    op.drop_table("jobs")
    op.drop_table("media_files")
    op.drop_table("services")
    op.drop_table("users")
    sa.Enum(name="actionenum").drop(op.get_bind())
    sa.Enum(name="statusenum").drop(op.get_bind())
