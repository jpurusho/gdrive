"""
Settings API endpoints
"""
from typing import Dict, Any, Optional
from datetime import datetime

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from app.core.database import get_db, Settings as SettingsModel
from app.core.config import get_settings
from app.core.logger import setup_logger

router = APIRouter()
logger = setup_logger(__name__)
app_settings = get_settings()


class SettingUpdate(BaseModel):
    """Setting update request"""
    value: Dict[str, Any]


@router.get("/")
async def get_all_settings(
    db: AsyncSession = Depends(get_db)
):
    """Get all application settings"""
    try:
        # Get settings from database
        result = await db.execute(select(SettingsModel))
        db_settings = result.scalars().all()

        # Combine with config settings
        settings = {
            "oauth": {
                "scopes": app_settings.oauth.scopes,
                "redirect_uri": app_settings.oauth.redirect_uri
            },
            "sync": app_settings.sync.dict(),
            "permissions": app_settings.permissions.dict(),
            "security": {
                "credential_storage": app_settings.security.credential_storage,
                "encrypt_tokens": app_settings.security.encrypt_tokens,
                "session_timeout_minutes": app_settings.security.session_timeout_minutes
            },
            "ui": app_settings.ui.dict()
        }

        # Add database settings
        for setting in db_settings:
            if setting.category not in settings:
                settings[setting.category] = {}
            settings[setting.category][setting.key] = setting.value

        return settings

    except Exception as e:
        logger.error(f"Error getting settings: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{category}")
async def get_category_settings(
    category: str,
    db: AsyncSession = Depends(get_db)
):
    """Get settings for a specific category"""
    try:
        # Get settings from database
        result = await db.execute(
            select(SettingsModel).where(SettingsModel.category == category)
        )
        db_settings = result.scalars().all()

        settings = {}

        # Add config settings if applicable
        if category == "oauth":
            settings = {
                "scopes": app_settings.oauth.scopes,
                "redirect_uri": app_settings.oauth.redirect_uri
            }
        elif category == "sync":
            settings = app_settings.sync.dict()
        elif category == "permissions":
            settings = app_settings.permissions.dict()
        elif category == "security":
            settings = {
                "credential_storage": app_settings.security.credential_storage,
                "encrypt_tokens": app_settings.security.encrypt_tokens,
                "session_timeout_minutes": app_settings.security.session_timeout_minutes
            }
        elif category == "ui":
            settings = app_settings.ui.dict()

        # Add/override with database settings
        for setting in db_settings:
            settings[setting.key] = setting.value

        return settings

    except Exception as e:
        logger.error(f"Error getting category settings: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{category}/{key}")
async def get_setting(
    category: str,
    key: str,
    db: AsyncSession = Depends(get_db)
):
    """Get a specific setting"""
    try:
        # Check database first
        result = await db.execute(
            select(SettingsModel).where(
                SettingsModel.category == category,
                SettingsModel.key == key
            )
        )
        setting = result.scalar_one_or_none()

        if setting:
            return {"value": setting.value}

        # Check config settings
        if category == "sync" and hasattr(app_settings.sync, key):
            return {"value": getattr(app_settings.sync, key)}
        elif category == "permissions" and hasattr(app_settings.permissions, key):
            return {"value": getattr(app_settings.permissions, key)}
        elif category == "ui" and hasattr(app_settings.ui, key):
            return {"value": getattr(app_settings.ui, key)}

        raise HTTPException(status_code=404, detail="Setting not found")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting setting: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{category}/{key}")
async def update_setting(
    category: str,
    key: str,
    setting_data: SettingUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Update a setting"""
    try:
        # Check if setting exists
        result = await db.execute(
            select(SettingsModel).where(
                SettingsModel.category == category,
                SettingsModel.key == key
            )
        )
        setting = result.scalar_one_or_none()

        if setting:
            # Update existing setting
            setting.value = setting_data.value
            setting.updated_at = datetime.utcnow()
        else:
            # Create new setting
            setting = SettingsModel(
                category=category,
                key=key,
                value=setting_data.value
            )
            db.add(setting)

        await db.commit()

        return {
            "message": "Setting updated successfully",
            "category": category,
            "key": key,
            "value": setting_data.value
        }

    except Exception as e:
        logger.error(f"Error updating setting: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/reset")
async def reset_settings(
    category: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """Reset settings to defaults"""
    try:
        if category:
            # Reset specific category
            await db.execute(
                "DELETE FROM settings WHERE category = :category",
                {"category": category}
            )
        else:
            # Reset all settings
            await db.execute("DELETE FROM settings")

        await db.commit()

        # Re-insert default settings
        default_settings = [
            SettingsModel(key="auto_sync_enabled", value={"enabled": False}, category="sync"),
            SettingsModel(key="notification_preferences", value={"email": False, "desktop": True}, category="notifications"),
            SettingsModel(key="ui_preferences", value={"theme": "desktop", "dual_pane": True}, category="ui"),
        ]
        for setting in default_settings:
            if not category or setting.category == category:
                db.add(setting)

        await db.commit()

        return {"message": "Settings reset to defaults"}

    except Exception as e:
        logger.error(f"Error resetting settings: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/export/json")
async def export_settings(
    db: AsyncSession = Depends(get_db)
):
    """Export all settings as JSON"""
    try:
        # Get all settings
        settings = await get_all_settings(db)

        return {
            "version": "1.0.0",
            "exported_at": datetime.utcnow().isoformat(),
            "settings": settings
        }

    except Exception as e:
        logger.error(f"Error exporting settings: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/import/json")
async def import_settings(
    settings_data: Dict[str, Any],
    db: AsyncSession = Depends(get_db)
):
    """Import settings from JSON"""
    try:
        if "settings" not in settings_data:
            raise HTTPException(status_code=400, detail="Invalid settings format")

        imported_settings = settings_data["settings"]

        # Clear existing database settings
        await db.execute("DELETE FROM settings")

        # Import new settings
        for category, category_settings in imported_settings.items():
            if isinstance(category_settings, dict):
                for key, value in category_settings.items():
                    # Skip config-only settings
                    if category in ["oauth", "security"] and key in ["client_id", "client_secret", "secret_key"]:
                        continue

                    setting = SettingsModel(
                        category=category,
                        key=key,
                        value=value if isinstance(value, dict) else {"value": value}
                    )
                    db.add(setting)

        await db.commit()

        return {"message": "Settings imported successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error importing settings: {e}")
        raise HTTPException(status_code=500, detail=str(e))