"""
Synchronization API endpoints
"""
import asyncio
import os
from datetime import datetime
from typing import List, Optional, Dict, Any
from pathlib import Path

from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, Field

from app.core.database import get_db, SyncProfile, SyncHistory, ActivityLog, User
from app.core.logger import setup_logger
from app.services.sync_engine import SyncEngine
from app.services.google_drive import GoogleDriveService

router = APIRouter()
logger = setup_logger(__name__)


class SyncRequest(BaseModel):
    """Manual sync request"""
    profile_id: int
    dry_run: bool = False
    force: bool = False


class ConflictResolutionRequest(BaseModel):
    """Conflict resolution request"""
    file_path: str
    resolution: str  # keep_local, keep_remote, keep_both, merge


class SyncProgress(BaseModel):
    """Sync progress response"""
    profile_id: int
    status: str
    progress: float
    files_processed: int
    total_files: int
    bytes_transferred: float
    current_file: Optional[str] = None
    errors: List[Dict[str, Any]] = Field(default_factory=list)


@router.post("/start")
async def start_sync(
    user_id: int,
    sync_request: SyncRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    """Start a synchronization for a profile"""
    try:
        # Get profile
        result = await db.execute(
            select(SyncProfile).where(
                SyncProfile.id == sync_request.profile_id,
                SyncProfile.user_id == user_id
            )
        )
        profile = result.scalar_one_or_none()

        if not profile:
            raise HTTPException(status_code=404, detail="Profile not found")

        if not profile.is_active:
            raise HTTPException(status_code=400, detail="Profile is not active")

        # Get user for credentials
        user_result = await db.execute(select(User).where(User.id == user_id))
        user = user_result.scalar_one_or_none()

        if not user or not user.access_token:
            raise HTTPException(status_code=401, detail="User not authenticated")

        # Create sync history entry
        sync_history = SyncHistory(
            profile_id=profile.id,
            started_at=datetime.utcnow(),
            status="in_progress"
        )
        db.add(sync_history)
        await db.commit()
        await db.refresh(sync_history)

        # Start sync in background
        background_tasks.add_task(
            run_sync,
            profile=profile,
            user=user,
            sync_history_id=sync_history.id,
            dry_run=sync_request.dry_run,
            force=sync_request.force
        )

        return {
            "sync_id": sync_history.id,
            "profile_id": profile.id,
            "status": "started",
            "message": "Synchronization started"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error starting sync: {e}")
        raise HTTPException(status_code=500, detail=str(e))


async def run_sync(
    profile: SyncProfile,
    user: User,
    sync_history_id: int,
    dry_run: bool = False,
    force: bool = False
):
    """Run synchronization in background"""
    from app.core.database import AsyncSessionLocal

    try:
        async with AsyncSessionLocal() as db:
            # Initialize services
            drive_service = GoogleDriveService(user.access_token, user.refresh_token)
            sync_engine = SyncEngine(drive_service, db)

            # Run sync
            result = await sync_engine.sync(
                profile=profile,
                dry_run=dry_run,
                force=force
            )

            # Update sync history
            sync_history_result = await db.execute(
                select(SyncHistory).where(SyncHistory.id == sync_history_id)
            )
            sync_history = sync_history_result.scalar_one()

            sync_history.completed_at = datetime.utcnow()
            sync_history.status = "completed" if result.success else "failed"
            sync_history.files_synced = result.files_synced
            sync_history.bytes_transferred = result.bytes_transferred
            sync_history.errors = result.errors
            sync_history.summary = result.summary

            # Update profile last sync
            if result.success:
                profile.last_sync_timestamp = datetime.utcnow()

            await db.commit()

    except Exception as e:
        logger.error(f"Sync error: {e}")
        # Update sync history with error
        async with AsyncSessionLocal() as db:
            sync_history_result = await db.execute(
                select(SyncHistory).where(SyncHistory.id == sync_history_id)
            )
            sync_history = sync_history_result.scalar_one()
            sync_history.completed_at = datetime.utcnow()
            sync_history.status = "failed"
            sync_history.errors = [{"error": str(e)}]
            await db.commit()


@router.get("/progress/{sync_id}")
async def get_sync_progress(
    sync_id: int,
    user_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get progress of a running sync"""
    try:
        # Get sync history with profile
        result = await db.execute(
            select(SyncHistory, SyncProfile).join(SyncProfile).where(
                SyncHistory.id == sync_id,
                SyncProfile.user_id == user_id
            )
        )
        row = result.first()

        if not row:
            raise HTTPException(status_code=404, detail="Sync not found")

        sync_history, profile = row

        # Calculate progress
        progress = 0.0
        if sync_history.status == "completed":
            progress = 100.0
        elif sync_history.status == "in_progress":
            # Get progress from Redis or calculate from files
            progress = 50.0  # Placeholder

        return SyncProgress(
            profile_id=profile.id,
            status=sync_history.status,
            progress=progress,
            files_processed=sync_history.files_synced or 0,
            total_files=0,  # Would be calculated from scan
            bytes_transferred=sync_history.bytes_transferred or 0,
            current_file=None,
            errors=sync_history.errors or []
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting sync progress: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/stop/{sync_id}")
async def stop_sync(
    sync_id: int,
    user_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Stop a running sync"""
    try:
        # Get sync history with profile
        result = await db.execute(
            select(SyncHistory, SyncProfile).join(SyncProfile).where(
                SyncHistory.id == sync_id,
                SyncProfile.user_id == user_id
            )
        )
        row = result.first()

        if not row:
            raise HTTPException(status_code=404, detail="Sync not found")

        sync_history, _ = row

        if sync_history.status != "in_progress":
            raise HTTPException(status_code=400, detail="Sync is not running")

        # Update status
        sync_history.status = "cancelled"
        sync_history.completed_at = datetime.utcnow()
        await db.commit()

        # TODO: Implement actual cancellation logic

        return {"message": "Sync stopped successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error stopping sync: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/history")
async def get_sync_history(
    user_id: int,
    profile_id: Optional[int] = None,
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db)
):
    """Get sync history for user or specific profile"""
    try:
        query = select(SyncHistory, SyncProfile).join(SyncProfile).where(
            SyncProfile.user_id == user_id
        )

        if profile_id:
            query = query.where(SyncHistory.profile_id == profile_id)

        query = query.order_by(SyncHistory.started_at.desc())
        query = query.limit(limit).offset(offset)

        result = await db.execute(query)
        rows = result.all()

        history = []
        for sync_history, profile in rows:
            history.append({
                "id": sync_history.id,
                "profile_id": profile.id,
                "profile_name": profile.name,
                "started_at": sync_history.started_at.isoformat(),
                "completed_at": sync_history.completed_at.isoformat() if sync_history.completed_at else None,
                "status": sync_history.status,
                "files_synced": sync_history.files_synced,
                "bytes_transferred": sync_history.bytes_transferred,
                "errors": sync_history.errors or []
            })

        return history

    except Exception as e:
        logger.error(f"Error getting sync history: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/resolve-conflict")
async def resolve_conflict(
    user_id: int,
    resolution: ConflictResolutionRequest,
    db: AsyncSession = Depends(get_db)
):
    """Resolve a file conflict"""
    try:
        # TODO: Implement conflict resolution logic
        # This would interact with the sync engine to resolve conflicts

        # Log the resolution
        activity = ActivityLog(
            user_id=user_id,
            action="conflict_resolved",
            file_name=Path(resolution.file_path).name,
            status="success",
            metadata={"resolution": resolution.resolution}
        )
        db.add(activity)
        await db.commit()

        return {
            "message": "Conflict resolved successfully",
            "resolution": resolution.resolution
        }

    except Exception as e:
        logger.error(f"Error resolving conflict: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/activity")
async def get_activity_log(
    user_id: int,
    limit: int = 100,
    offset: int = 0,
    db: AsyncSession = Depends(get_db)
):
    """Get activity log for user"""
    try:
        query = select(ActivityLog).where(
            ActivityLog.user_id == user_id
        ).order_by(ActivityLog.created_at.desc())
        query = query.limit(limit).offset(offset)

        result = await db.execute(query)
        activities = result.scalars().all()

        return [
            {
                "id": a.id,
                "action": a.action,
                "source_path": a.source_path,
                "destination_path": a.destination_path,
                "file_name": a.file_name,
                "file_size": a.file_size,
                "status": a.status,
                "error_message": a.error_message,
                "created_at": a.created_at.isoformat() if a.created_at else None
            }
            for a in activities
        ]

    except Exception as e:
        logger.error(f"Error getting activity log: {e}")
        raise HTTPException(status_code=500, detail=str(e))