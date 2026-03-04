"""
Database configuration and models
"""
import json
from datetime import datetime
from typing import Optional, List, Dict, Any
from pathlib import Path

from sqlalchemy import (
    create_engine, Column, Integer, String, Text, Boolean,
    DateTime, ForeignKey, JSON, Float, Index, CheckConstraint
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship, Session
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

from app.core.config import get_settings

settings = get_settings()

# Create SQLite database URL
DATABASE_URL = f"sqlite+aiosqlite:///{settings.database_url}"

# Create async engine
engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    future=True
)

# Create async session factory
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False
)

# Create base class for models
Base = declarative_base()


class User(Base):
    """User model for OAuth authentication"""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    name = Column(String(255))
    google_id = Column(String(255), unique=True, index=True)
    access_token = Column(Text)
    refresh_token = Column(Text)
    token_expiry = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    sync_profiles = relationship("SyncProfile", back_populates="user", cascade="all, delete-orphan")
    activity_logs = relationship("ActivityLog", back_populates="user", cascade="all, delete-orphan")


class SyncProfile(Base):
    """Sync profile configuration"""
    __tablename__ = "sync_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    source_path = Column(Text, nullable=False)
    destination_path = Column(Text, nullable=False)
    sync_direction = Column(String(50), nullable=False, default="bidirectional")
    allow_deletions = Column(Boolean, default=False)
    conflict_resolution = Column(String(50), default="prompt")
    filter_rules = Column(JSON, default=dict)  # {"include": [], "exclude": []}
    schedule_config = Column(JSON, default=dict)  # {"cron": "", "event_triggers": []}
    last_sync_timestamp = Column(DateTime)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="sync_profiles")
    sync_history = relationship("SyncHistory", back_populates="profile", cascade="all, delete-orphan")

    # Check constraint for sync direction
    __table_args__ = (
        CheckConstraint(
            sync_direction.in_(['bidirectional', 'upload_only', 'download_only']),
            name='check_sync_direction'
        ),
        CheckConstraint(
            conflict_resolution.in_(['prompt', 'keep_newer', 'keep_both', 'keep_local', 'keep_remote']),
            name='check_conflict_resolution'
        ),
    )


class SyncHistory(Base):
    """Sync operation history"""
    __tablename__ = "sync_history"

    id = Column(Integer, primary_key=True, index=True)
    profile_id = Column(Integer, ForeignKey("sync_profiles.id"), nullable=False)
    started_at = Column(DateTime, nullable=False)
    completed_at = Column(DateTime)
    status = Column(String(50), nullable=False)  # pending, in_progress, completed, failed
    files_synced = Column(Integer, default=0)
    bytes_transferred = Column(Float, default=0)
    errors = Column(JSON, default=list)
    summary = Column(JSON, default=dict)

    # Relationships
    profile = relationship("SyncProfile", back_populates="sync_history")

    # Index for faster queries
    __table_args__ = (
        Index('idx_sync_history_profile_time', 'profile_id', 'started_at'),
    )


class ActivityLog(Base):
    """Activity log for all operations"""
    __tablename__ = "activity_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    action = Column(String(100), nullable=False)  # sync, upload, download, delete, conflict_resolved
    source_path = Column(Text)
    destination_path = Column(Text)
    file_name = Column(String(255))
    file_size = Column(Float)
    status = Column(String(50))  # success, failed, skipped
    error_message = Column(Text)
    metadata = Column(JSON, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    # Relationships
    user = relationship("User", back_populates="activity_logs")

    # Index for faster queries
    __table_args__ = (
        Index('idx_activity_user_time', 'user_id', 'created_at'),
        Index('idx_activity_action', 'action'),
    )


class ConflictResolution(Base):
    """Conflict resolution history"""
    __tablename__ = "conflict_resolutions"

    id = Column(Integer, primary_key=True, index=True)
    sync_history_id = Column(Integer, ForeignKey("sync_history.id"))
    file_path = Column(Text, nullable=False)
    local_modified = Column(DateTime)
    remote_modified = Column(DateTime)
    resolution = Column(String(50), nullable=False)  # keep_local, keep_remote, keep_both, merged
    resolved_at = Column(DateTime, default=datetime.utcnow)
    resolved_by = Column(String(50))  # auto, user


class Settings(Base):
    """Application settings"""
    __tablename__ = "settings"

    id = Column(Integer, primary_key=True)
    key = Column(String(100), unique=True, nullable=False, index=True)
    value = Column(JSON, nullable=False)
    category = Column(String(50))
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


async def init_db():
    """Initialize database and create tables"""
    async with engine.begin() as conn:
        # Create all tables
        await conn.run_sync(Base.metadata.create_all)

    # Create default settings if needed
    async with AsyncSessionLocal() as session:
        # Check if settings exist
        result = await session.execute(
            "SELECT COUNT(*) FROM settings"
        )
        count = result.scalar()

        if count == 0:
            # Insert default settings
            default_settings = [
                Settings(key="auto_sync_enabled", value={"enabled": False}, category="sync"),
                Settings(key="notification_preferences", value={"email": False, "desktop": True}, category="notifications"),
                Settings(key="ui_preferences", value={"theme": "desktop", "dual_pane": True}, category="ui"),
            ]
            session.add_all(default_settings)
            await session.commit()


async def get_db() -> AsyncSession:
    """Get database session"""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()