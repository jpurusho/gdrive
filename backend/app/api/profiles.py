"""
Sync profiles API endpoints
"""
import json
from datetime import datetime
from typing import List, Optional, Dict, Any

from fastapi import APIRouter, HTTPException, Depends, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from pydantic import BaseModel, Field

from app.core.database import get_db, SyncProfile, User
from app.core.logger import setup_logger

router = APIRouter()
logger = setup_logger(__name__)


class FilterRules(BaseModel):
    """Filter rules model"""
    include: List[str] = Field(default_factory=list)
    exclude: List[str] = Field(default_factory=list)


class ScheduleConfig(BaseModel):
    """Schedule configuration model"""
    cron: Optional[str] = None
    event_triggers: List[str] = Field(default_factory=list)


class SyncProfileCreate(BaseModel):
    """Create sync profile request"""
    name: str
    description: Optional[str] = None
    source_path: str
    destination_path: str
    sync_direction: str = "bidirectional"
    allow_deletions: bool = False
    conflict_resolution: str = "prompt"
    filter_rules: FilterRules = Field(default_factory=FilterRules)
    schedule_config: ScheduleConfig = Field(default_factory=ScheduleConfig)
    is_active: bool = True


class SyncProfileUpdate(BaseModel):
    """Update sync profile request"""
    name: Optional[str] = None
    description: Optional[str] = None
    source_path: Optional[str] = None
    destination_path: Optional[str] = None
    sync_direction: Optional[str] = None
    allow_deletions: Optional[bool] = None
    conflict_resolution: Optional[str] = None
    filter_rules: Optional[FilterRules] = None
    schedule_config: Optional[ScheduleConfig] = None
    is_active: Optional[bool] = None


@router.get("/")
async def list_profiles(
    user_id: int,
    active_only: bool = False,
    db: AsyncSession = Depends(get_db)
):
    """List all sync profiles for a user"""
    try:
        query = select(SyncProfile).where(SyncProfile.user_id == user_id)
        if active_only:
            query = query.where(SyncProfile.is_active == True)

        result = await db.execute(query)
        profiles = result.scalars().all()

        return [
            {
                "id": p.id,
                "name": p.name,
                "description": p.description,
                "source_path": p.source_path,
                "destination_path": p.destination_path,
                "sync_direction": p.sync_direction,
                "allow_deletions": p.allow_deletions,
                "conflict_resolution": p.conflict_resolution,
                "filter_rules": p.filter_rules,
                "schedule_config": p.schedule_config,
                "last_sync_timestamp": p.last_sync_timestamp.isoformat() if p.last_sync_timestamp else None,
                "is_active": p.is_active,
                "created_at": p.created_at.isoformat() if p.created_at else None,
                "updated_at": p.updated_at.isoformat() if p.updated_at else None
            }
            for p in profiles
        ]
    except Exception as e:
        logger.error(f"Error listing profiles: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{profile_id}")
async def get_profile(
    profile_id: int,
    user_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get a specific sync profile"""
    try:
        result = await db.execute(
            select(SyncProfile).where(
                SyncProfile.id == profile_id,
                SyncProfile.user_id == user_id
            )
        )
        profile = result.scalar_one_or_none()

        if not profile:
            raise HTTPException(status_code=404, detail="Profile not found")

        return {
            "id": profile.id,
            "name": profile.name,
            "description": profile.description,
            "source_path": profile.source_path,
            "destination_path": profile.destination_path,
            "sync_direction": profile.sync_direction,
            "allow_deletions": profile.allow_deletions,
            "conflict_resolution": profile.conflict_resolution,
            "filter_rules": profile.filter_rules,
            "schedule_config": profile.schedule_config,
            "last_sync_timestamp": profile.last_sync_timestamp.isoformat() if profile.last_sync_timestamp else None,
            "is_active": profile.is_active,
            "created_at": profile.created_at.isoformat() if profile.created_at else None,
            "updated_at": profile.updated_at.isoformat() if profile.updated_at else None
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting profile: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/")
async def create_profile(
    user_id: int,
    profile_data: SyncProfileCreate,
    db: AsyncSession = Depends(get_db)
):
    """Create a new sync profile"""
    try:
        # Verify user exists
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        # Create profile
        profile = SyncProfile(
            user_id=user_id,
            name=profile_data.name,
            description=profile_data.description,
            source_path=profile_data.source_path,
            destination_path=profile_data.destination_path,
            sync_direction=profile_data.sync_direction,
            allow_deletions=profile_data.allow_deletions,
            conflict_resolution=profile_data.conflict_resolution,
            filter_rules=profile_data.filter_rules.dict(),
            schedule_config=profile_data.schedule_config.dict(),
            is_active=profile_data.is_active
        )

        db.add(profile)
        await db.commit()
        await db.refresh(profile)

        return {
            "id": profile.id,
            "name": profile.name,
            "message": "Profile created successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating profile: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{profile_id}")
async def update_profile(
    profile_id: int,
    user_id: int,
    profile_data: SyncProfileUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Update a sync profile"""
    try:
        # Get existing profile
        result = await db.execute(
            select(SyncProfile).where(
                SyncProfile.id == profile_id,
                SyncProfile.user_id == user_id
            )
        )
        profile = result.scalar_one_or_none()

        if not profile:
            raise HTTPException(status_code=404, detail="Profile not found")

        # Update fields
        update_data = profile_data.dict(exclude_unset=True)
        for field, value in update_data.items():
            if field == "filter_rules" and value is not None:
                value = value.dict()
            elif field == "schedule_config" and value is not None:
                value = value.dict()
            setattr(profile, field, value)

        profile.updated_at = datetime.utcnow()

        await db.commit()
        await db.refresh(profile)

        return {
            "id": profile.id,
            "name": profile.name,
            "message": "Profile updated successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating profile: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{profile_id}")
async def delete_profile(
    profile_id: int,
    user_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Delete a sync profile"""
    try:
        # Get profile
        result = await db.execute(
            select(SyncProfile).where(
                SyncProfile.id == profile_id,
                SyncProfile.user_id == user_id
            )
        )
        profile = result.scalar_one_or_none()

        if not profile:
            raise HTTPException(status_code=404, detail="Profile not found")

        # Delete profile
        await db.delete(profile)
        await db.commit()

        return {
            "message": "Profile deleted successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting profile: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{profile_id}/activate")
async def activate_profile(
    profile_id: int,
    user_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Activate a sync profile"""
    try:
        result = await db.execute(
            select(SyncProfile).where(
                SyncProfile.id == profile_id,
                SyncProfile.user_id == user_id
            )
        )
        profile = result.scalar_one_or_none()

        if not profile:
            raise HTTPException(status_code=404, detail="Profile not found")

        profile.is_active = True
        profile.updated_at = datetime.utcnow()

        await db.commit()

        return {"message": "Profile activated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error activating profile: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{profile_id}/deactivate")
async def deactivate_profile(
    profile_id: int,
    user_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Deactivate a sync profile"""
    try:
        result = await db.execute(
            select(SyncProfile).where(
                SyncProfile.id == profile_id,
                SyncProfile.user_id == user_id
            )
        )
        profile = result.scalar_one_or_none()

        if not profile:
            raise HTTPException(status_code=404, detail="Profile not found")

        profile.is_active = False
        profile.updated_at = datetime.utcnow()

        await db.commit()

        return {"message": "Profile deactivated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deactivating profile: {e}")
        raise HTTPException(status_code=500, detail=str(e))