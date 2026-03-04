"""
File browser API endpoints for local and Google Drive
"""
import os
import mimetypes
from pathlib import Path
from typing import List, Optional, Dict, Any

from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, Field

from app.core.database import get_db, User
from app.core.logger import setup_logger
from app.services.google_drive import GoogleDriveService

router = APIRouter()
logger = setup_logger(__name__)


class FileInfo(BaseModel):
    """File/folder information"""
    name: str
    path: str
    type: str  # file or folder
    size: Optional[int] = None
    modified: Optional[str] = None
    mime_type: Optional[str] = None
    is_google_workspace: bool = False
    google_id: Optional[str] = None


class BrowseResponse(BaseModel):
    """Browse response"""
    current_path: str
    parent_path: Optional[str] = None
    items: List[FileInfo] = Field(default_factory=list)
    total_items: int = 0


@router.get("/local/browse")
async def browse_local(
    path: str = Query("/sync/local", description="Path to browse"),
    show_hidden: bool = Query(False, description="Show hidden files")
):
    """Browse local filesystem"""
    try:
        # Ensure path is within allowed directory
        base_path = Path("/sync/local")
        target_path = Path(path).resolve()

        # Security check - ensure we're within allowed directory
        if not str(target_path).startswith(str(base_path)):
            raise HTTPException(status_code=403, detail="Access denied")

        if not target_path.exists():
            raise HTTPException(status_code=404, detail="Path not found")

        if not target_path.is_dir():
            raise HTTPException(status_code=400, detail="Path is not a directory")

        items = []
        for item in target_path.iterdir():
            # Skip hidden files if requested
            if not show_hidden and item.name.startswith('.'):
                continue

            try:
                stat = item.stat()
                mime_type, _ = mimetypes.guess_type(str(item))

                items.append(FileInfo(
                    name=item.name,
                    path=str(item),
                    type="folder" if item.is_dir() else "file",
                    size=stat.st_size if item.is_file() else None,
                    modified=datetime.fromtimestamp(stat.st_mtime).isoformat(),
                    mime_type=mime_type
                ))
            except Exception as e:
                logger.warning(f"Could not stat {item}: {e}")
                continue

        # Sort folders first, then files
        items.sort(key=lambda x: (x.type != "folder", x.name.lower()))

        # Get parent path
        parent_path = None
        if target_path != base_path:
            parent_path = str(target_path.parent)

        return BrowseResponse(
            current_path=str(target_path),
            parent_path=parent_path,
            items=items,
            total_items=len(items)
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error browsing local: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/drive/browse")
async def browse_drive(
    user_id: int,
    folder_id: str = Query("root", description="Folder ID to browse"),
    include_shared: bool = Query(True, description="Include shared drives"),
    db: AsyncSession = Depends(get_db)
):
    """Browse Google Drive"""
    try:
        # Get user credentials
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()

        if not user or not user.access_token:
            raise HTTPException(status_code=401, detail="User not authenticated")

        # Initialize Drive service
        drive_service = GoogleDriveService(user.access_token, user.refresh_token)

        # Get folder contents
        items = await drive_service.list_files(
            folder_id=folder_id,
            include_shared=include_shared
        )

        # Convert to FileInfo format
        file_items = []
        for item in items:
            is_folder = item.get('mimeType') == 'application/vnd.google-apps.folder'
            is_google_workspace = item.get('mimeType', '').startswith('application/vnd.google-apps.')

            file_items.append(FileInfo(
                name=item.get('name', 'Untitled'),
                path=f"drive://{item.get('id')}",
                type="folder" if is_folder else "file",
                size=int(item.get('size', 0)) if item.get('size') else None,
                modified=item.get('modifiedTime'),
                mime_type=item.get('mimeType'),
                is_google_workspace=is_google_workspace,
                google_id=item.get('id')
            ))

        # Sort folders first, then files
        file_items.sort(key=lambda x: (x.type != "folder", x.name.lower()))

        # Get parent folder info
        parent_path = None
        if folder_id != "root":
            parent_info = await drive_service.get_file_info(folder_id)
            if parent_info and parent_info.get('parents'):
                parent_path = f"drive://{parent_info['parents'][0]}"

        return BrowseResponse(
            current_path=f"drive://{folder_id}",
            parent_path=parent_path,
            items=file_items,
            total_items=len(file_items)
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error browsing Drive: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/drive/shared-drives")
async def list_shared_drives(
    user_id: int,
    db: AsyncSession = Depends(get_db)
):
    """List all shared drives accessible to user"""
    try:
        # Get user credentials
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()

        if not user or not user.access_token:
            raise HTTPException(status_code=401, detail="User not authenticated")

        # Initialize Drive service
        drive_service = GoogleDriveService(user.access_token, user.refresh_token)

        # Get shared drives
        shared_drives = await drive_service.list_shared_drives()

        return [
            {
                "id": drive.get('id'),
                "name": drive.get('name'),
                "kind": drive.get('kind')
            }
            for drive in shared_drives
        ]

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error listing shared drives: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/local/info")
async def get_local_file_info(
    path: str = Query(..., description="File path")
):
    """Get detailed information about a local file"""
    try:
        # Security check
        base_path = Path("/sync/local")
        target_path = Path(path).resolve()

        if not str(target_path).startswith(str(base_path)):
            raise HTTPException(status_code=403, detail="Access denied")

        if not target_path.exists():
            raise HTTPException(status_code=404, detail="File not found")

        stat = target_path.stat()
        mime_type, _ = mimetypes.guess_type(str(target_path))

        return {
            "name": target_path.name,
            "path": str(target_path),
            "type": "folder" if target_path.is_dir() else "file",
            "size": stat.st_size if target_path.is_file() else None,
            "modified": datetime.fromtimestamp(stat.st_mtime).isoformat(),
            "created": datetime.fromtimestamp(stat.st_ctime).isoformat(),
            "mime_type": mime_type,
            "permissions": oct(stat.st_mode)[-3:]
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting file info: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/drive/info")
async def get_drive_file_info(
    user_id: int,
    file_id: str = Query(..., description="Google Drive file ID"),
    db: AsyncSession = Depends(get_db)
):
    """Get detailed information about a Google Drive file"""
    try:
        # Get user credentials
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()

        if not user or not user.access_token:
            raise HTTPException(status_code=401, detail="User not authenticated")

        # Initialize Drive service
        drive_service = GoogleDriveService(user.access_token, user.refresh_token)

        # Get file info
        file_info = await drive_service.get_file_info(file_id)

        if not file_info:
            raise HTTPException(status_code=404, detail="File not found")

        return {
            "id": file_info.get('id'),
            "name": file_info.get('name'),
            "mime_type": file_info.get('mimeType'),
            "size": int(file_info.get('size', 0)) if file_info.get('size') else None,
            "modified": file_info.get('modifiedTime'),
            "created": file_info.get('createdTime'),
            "owners": [owner.get('displayName', owner.get('emailAddress'))
                      for owner in file_info.get('owners', [])],
            "shared": file_info.get('shared', False),
            "web_view_link": file_info.get('webViewLink'),
            "is_google_workspace": file_info.get('mimeType', '').startswith('application/vnd.google-apps.'),
            "export_formats": file_info.get('exportLinks', {}) if file_info.get('exportLinks') else {}
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting Drive file info: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Add missing import
from datetime import datetime