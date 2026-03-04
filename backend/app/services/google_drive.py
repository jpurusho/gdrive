"""
Google Drive service for API interactions
"""
import os
import io
import asyncio
from typing import List, Dict, Any, Optional, BinaryIO
from datetime import datetime

from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload, MediaIoBaseDownload, MediaIoBaseUpload
from googleapiclient.errors import HttpError

from app.core.config import get_settings
from app.core.logger import setup_logger

logger = setup_logger(__name__)
settings = get_settings()


class GoogleDriveService:
    """Service for interacting with Google Drive API"""

    def __init__(self, access_token: str, refresh_token: Optional[str] = None):
        """Initialize Google Drive service"""
        self.credentials = Credentials(
            token=access_token,
            refresh_token=refresh_token,
            token_uri="https://oauth2.googleapis.com/token",
            client_id=settings.oauth.client_id,
            client_secret=settings.oauth.client_secret,
            scopes=settings.oauth.scopes
        )

        # Refresh token if needed
        if self.credentials.expired and self.credentials.refresh_token:
            self.credentials.refresh(Request())

        self.service = build('drive', 'v3', credentials=self.credentials)

    async def list_files(
        self,
        folder_id: str = "root",
        include_shared: bool = True,
        page_size: int = 100,
        fields: str = "files(id,name,mimeType,size,modifiedTime,parents,shared)"
    ) -> List[Dict[str, Any]]:
        """List files in a folder"""
        try:
            query = f"'{folder_id}' in parents and trashed = false"

            if not include_shared:
                query += " and 'me' in owners"

            result = await asyncio.to_thread(
                self.service.files().list(
                    q=query,
                    pageSize=page_size,
                    fields=f"files({fields})",
                    supportsAllDrives=True,
                    includeItemsFromAllDrives=include_shared
                ).execute()
            )

            return result.get('files', [])

        except HttpError as e:
            logger.error(f"Error listing files: {e}")
            return []

    async def get_file_info(self, file_id: str) -> Optional[Dict[str, Any]]:
        """Get detailed information about a file"""
        try:
            result = await asyncio.to_thread(
                self.service.files().get(
                    fileId=file_id,
                    fields="*",
                    supportsAllDrives=True
                ).execute()
            )
            return result

        except HttpError as e:
            logger.error(f"Error getting file info: {e}")
            return None

    async def download_file(
        self,
        file_id: str,
        local_path: str,
        export_format: Optional[str] = None
    ) -> bool:
        """Download a file from Google Drive"""
        try:
            # Get file metadata
            file_info = await self.get_file_info(file_id)
            if not file_info:
                return False

            mime_type = file_info.get('mimeType', '')

            # Handle Google Workspace files
            if mime_type.startswith('application/vnd.google-apps.'):
                if not export_format:
                    # Default export formats
                    export_formats = {
                        'application/vnd.google-apps.document': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                        'application/vnd.google-apps.spreadsheet': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                        'application/vnd.google-apps.presentation': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                        'application/vnd.google-apps.drawing': 'application/pdf'
                    }
                    export_format = export_formats.get(mime_type, 'application/pdf')

                # Export the file
                request = self.service.files().export_media(
                    fileId=file_id,
                    mimeType=export_format
                )
            else:
                # Download regular file
                request = self.service.files().get_media(fileId=file_id)

            # Download with progress tracking
            fh = io.FileIO(local_path, 'wb')
            downloader = MediaIoBaseDownload(fh, request, chunksize=settings.sync.chunk_size_mb * 1024 * 1024)

            done = False
            while not done:
                status, done = await asyncio.to_thread(downloader.next_chunk)
                if status:
                    logger.debug(f"Download progress: {int(status.progress() * 100)}%")

            fh.close()
            return True

        except HttpError as e:
            logger.error(f"Error downloading file: {e}")
            return False
        except Exception as e:
            logger.error(f"Unexpected error downloading file: {e}")
            return False

    async def upload_file(
        self,
        local_path: str,
        parent_id: str = "root",
        file_name: Optional[str] = None,
        mime_type: Optional[str] = None
    ) -> Optional[str]:
        """Upload a file to Google Drive"""
        try:
            if not file_name:
                file_name = os.path.basename(local_path)

            # Prepare file metadata
            file_metadata = {
                'name': file_name,
                'parents': [parent_id]
            }

            # Create media upload
            media = MediaFileUpload(
                local_path,
                mimetype=mime_type,
                resumable=True,
                chunksize=settings.sync.chunk_size_mb * 1024 * 1024
            )

            # Upload file
            file = await asyncio.to_thread(
                self.service.files().create(
                    body=file_metadata,
                    media_body=media,
                    fields='id',
                    supportsAllDrives=True
                ).execute()
            )

            return file.get('id')

        except HttpError as e:
            logger.error(f"Error uploading file: {e}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error uploading file: {e}")
            return None

    async def update_file(
        self,
        file_id: str,
        local_path: str,
        mime_type: Optional[str] = None
    ) -> bool:
        """Update an existing file in Google Drive"""
        try:
            # Create media upload
            media = MediaFileUpload(
                local_path,
                mimetype=mime_type,
                resumable=True,
                chunksize=settings.sync.chunk_size_mb * 1024 * 1024
            )

            # Update file
            await asyncio.to_thread(
                self.service.files().update(
                    fileId=file_id,
                    media_body=media,
                    supportsAllDrives=True
                ).execute()
            )

            return True

        except HttpError as e:
            logger.error(f"Error updating file: {e}")
            return False
        except Exception as e:
            logger.error(f"Unexpected error updating file: {e}")
            return False

    async def delete_file(self, file_id: str) -> bool:
        """Delete a file from Google Drive (move to trash)"""
        try:
            await asyncio.to_thread(
                self.service.files().update(
                    fileId=file_id,
                    body={'trashed': True},
                    supportsAllDrives=True
                ).execute()
            )
            return True

        except HttpError as e:
            logger.error(f"Error deleting file: {e}")
            return False

    async def create_folder(
        self,
        folder_name: str,
        parent_id: str = "root"
    ) -> Optional[str]:
        """Create a folder in Google Drive"""
        try:
            file_metadata = {
                'name': folder_name,
                'mimeType': 'application/vnd.google-apps.folder',
                'parents': [parent_id]
            }

            folder = await asyncio.to_thread(
                self.service.files().create(
                    body=file_metadata,
                    fields='id',
                    supportsAllDrives=True
                ).execute()
            )

            return folder.get('id')

        except HttpError as e:
            logger.error(f"Error creating folder: {e}")
            return None

    async def list_shared_drives(self) -> List[Dict[str, Any]]:
        """List all shared drives accessible to the user"""
        try:
            result = await asyncio.to_thread(
                self.service.drives().list(
                    pageSize=100
                ).execute()
            )

            return result.get('drives', [])

        except HttpError as e:
            logger.error(f"Error listing shared drives: {e}")
            return []

    async def get_file_by_path(
        self,
        path: str,
        parent_id: str = "root"
    ) -> Optional[Dict[str, Any]]:
        """Get a file by its path relative to a parent"""
        try:
            path_parts = path.strip('/').split('/')
            current_parent = parent_id

            for part in path_parts:
                if not part:
                    continue

                # Search for the part in current parent
                query = f"name = '{part}' and '{current_parent}' in parents and trashed = false"
                result = await asyncio.to_thread(
                    self.service.files().list(
                        q=query,
                        fields="files(id, name, mimeType)",
                        supportsAllDrives=True,
                        includeItemsFromAllDrives=True
                    ).execute()
                )

                files = result.get('files', [])
                if not files:
                    return None

                # Use the first match
                file = files[0]
                current_parent = file['id']

                # If this is the last part, return the file
                if part == path_parts[-1]:
                    return file

            return None

        except HttpError as e:
            logger.error(f"Error getting file by path: {e}")
            return None

    async def get_changes(self, start_token: Optional[str] = None) -> Dict[str, Any]:
        """Get changes since a start token"""
        try:
            if not start_token:
                # Get start token for current state
                response = await asyncio.to_thread(
                    self.service.changes().getStartPageToken(
                        supportsAllDrives=True
                    ).execute()
                )
                return {'startPageToken': response.get('startPageToken')}

            # Get changes
            response = await asyncio.to_thread(
                self.service.changes().list(
                    pageToken=start_token,
                    includeItemsFromAllDrives=True,
                    supportsAllDrives=True
                ).execute()
            )

            return {
                'changes': response.get('changes', []),
                'newStartPageToken': response.get('newStartPageToken'),
                'nextPageToken': response.get('nextPageToken')
            }

        except HttpError as e:
            logger.error(f"Error getting changes: {e}")
            return {}