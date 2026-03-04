"""
Sync engine for bidirectional synchronization
"""
import os
import hashlib
import asyncio
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import SyncProfile, ActivityLog
from app.core.logger import setup_logger
from app.services.google_drive import GoogleDriveService

logger = setup_logger(__name__)


@dataclass
class SyncResult:
    """Result of a sync operation"""
    success: bool
    files_synced: int
    bytes_transferred: float
    errors: List[Dict[str, Any]]
    summary: Dict[str, Any]


@dataclass
class FileComparison:
    """Comparison result between local and remote file"""
    local_path: str
    remote_path: str
    local_exists: bool
    remote_exists: bool
    local_modified: Optional[datetime]
    remote_modified: Optional[datetime]
    local_size: Optional[int]
    remote_size: Optional[int]
    action: str  # upload, download, conflict, skip, delete


class SyncEngine:
    """Engine for synchronizing files between local and Google Drive"""

    def __init__(self, drive_service: GoogleDriveService, db: AsyncSession):
        """Initialize sync engine"""
        self.drive_service = drive_service
        self.db = db
        self.files_synced = 0
        self.bytes_transferred = 0.0
        self.errors = []

    async def sync(
        self,
        profile: SyncProfile,
        dry_run: bool = False,
        force: bool = False
    ) -> SyncResult:
        """Execute synchronization based on profile"""
        try:
            logger.info(f"Starting sync for profile: {profile.name}")

            # Parse paths
            source_is_local = not profile.source_path.startswith("drive://")
            dest_is_local = not profile.destination_path.startswith("drive://")

            if source_is_local and dest_is_local:
                raise ValueError("Both source and destination cannot be local")
            if not source_is_local and not dest_is_local:
                raise ValueError("Both source and destination cannot be Drive")

            # Scan files
            comparisons = await self._scan_files(profile)

            # Apply filters
            comparisons = self._apply_filters(comparisons, profile.filter_rules)

            # Determine actions based on sync direction
            comparisons = self._determine_actions(
                comparisons,
                profile.sync_direction,
                profile.conflict_resolution
            )

            # Execute sync actions
            if not dry_run:
                await self._execute_sync(comparisons, profile)

            # Log activity
            await self._log_activity(profile, comparisons)

            return SyncResult(
                success=len(self.errors) == 0,
                files_synced=self.files_synced,
                bytes_transferred=self.bytes_transferred,
                errors=self.errors,
                summary={
                    "total_files": len(comparisons),
                    "uploaded": sum(1 for c in comparisons if c.action == "upload"),
                    "downloaded": sum(1 for c in comparisons if c.action == "download"),
                    "conflicts": sum(1 for c in comparisons if c.action == "conflict"),
                    "skipped": sum(1 for c in comparisons if c.action == "skip"),
                    "dry_run": dry_run
                }
            )

        except Exception as e:
            logger.error(f"Sync error: {e}")
            self.errors.append({"error": str(e)})
            return SyncResult(
                success=False,
                files_synced=self.files_synced,
                bytes_transferred=self.bytes_transferred,
                errors=self.errors,
                summary={}
            )

    async def _scan_files(self, profile: SyncProfile) -> List[FileComparison]:
        """Scan source and destination for files"""
        comparisons = []

        source_is_local = not profile.source_path.startswith("drive://")

        if source_is_local:
            # Scan local source and Drive destination
            local_files = await self._scan_local(profile.source_path)
            drive_folder_id = profile.destination_path.replace("drive://", "")
            drive_files = await self._scan_drive(drive_folder_id)

            # Compare files
            all_paths = set(local_files.keys()) | set(drive_files.keys())

            for path in all_paths:
                local_file = local_files.get(path)
                drive_file = drive_files.get(path)

                comparison = FileComparison(
                    local_path=os.path.join(profile.source_path, path) if local_file else "",
                    remote_path=path,
                    local_exists=local_file is not None,
                    remote_exists=drive_file is not None,
                    local_modified=local_file['modified'] if local_file else None,
                    remote_modified=drive_file['modified'] if drive_file else None,
                    local_size=local_file['size'] if local_file else None,
                    remote_size=drive_file['size'] if drive_file else None,
                    action="skip"
                )
                comparisons.append(comparison)

        else:
            # Scan Drive source and local destination
            drive_folder_id = profile.source_path.replace("drive://", "")
            drive_files = await self._scan_drive(drive_folder_id)
            local_files = await self._scan_local(profile.destination_path)

            # Compare files
            all_paths = set(local_files.keys()) | set(drive_files.keys())

            for path in all_paths:
                local_file = local_files.get(path)
                drive_file = drive_files.get(path)

                comparison = FileComparison(
                    local_path=os.path.join(profile.destination_path, path) if local_file else "",
                    remote_path=path,
                    local_exists=local_file is not None,
                    remote_exists=drive_file is not None,
                    local_modified=local_file['modified'] if local_file else None,
                    remote_modified=drive_file['modified'] if drive_file else None,
                    local_size=local_file['size'] if local_file else None,
                    remote_size=drive_file['size'] if drive_file else None,
                    action="skip"
                )
                comparisons.append(comparison)

        return comparisons

    async def _scan_local(self, path: str) -> Dict[str, Dict[str, Any]]:
        """Scan local directory for files"""
        files = {}
        base_path = Path(path)

        if not base_path.exists():
            return files

        for file_path in base_path.rglob('*'):
            if file_path.is_file():
                relative_path = str(file_path.relative_to(base_path))
                stat = file_path.stat()
                files[relative_path] = {
                    'path': str(file_path),
                    'size': stat.st_size,
                    'modified': datetime.fromtimestamp(stat.st_mtime)
                }

        return files

    async def _scan_drive(self, folder_id: str) -> Dict[str, Dict[str, Any]]:
        """Scan Google Drive folder for files"""
        files = {}

        # Recursively scan Drive folder
        await self._scan_drive_recursive(folder_id, "", files)

        return files

    async def _scan_drive_recursive(
        self,
        folder_id: str,
        path_prefix: str,
        files: Dict[str, Dict[str, Any]]
    ):
        """Recursively scan Drive folders"""
        items = await self.drive_service.list_files(folder_id)

        for item in items:
            name = item.get('name', '')
            item_path = os.path.join(path_prefix, name) if path_prefix else name

            if item.get('mimeType') == 'application/vnd.google-apps.folder':
                # Recursively scan subfolder
                await self._scan_drive_recursive(item['id'], item_path, files)
            else:
                # Add file
                files[item_path] = {
                    'id': item['id'],
                    'size': int(item.get('size', 0)),
                    'modified': datetime.fromisoformat(
                        item.get('modifiedTime', '').replace('Z', '+00:00')
                    ) if item.get('modifiedTime') else datetime.now()
                }

    def _apply_filters(
        self,
        comparisons: List[FileComparison],
        filter_rules: Dict[str, Any]
    ) -> List[FileComparison]:
        """Apply filter rules to comparisons"""
        if not filter_rules:
            return comparisons

        filtered = []
        include_patterns = filter_rules.get('include', [])
        exclude_patterns = filter_rules.get('exclude', [])

        for comparison in comparisons:
            path = comparison.remote_path

            # Check include patterns
            if include_patterns:
                included = any(self._match_pattern(path, pattern) for pattern in include_patterns)
                if not included:
                    continue

            # Check exclude patterns
            if exclude_patterns:
                excluded = any(self._match_pattern(path, pattern) for pattern in exclude_patterns)
                if excluded:
                    continue

            filtered.append(comparison)

        return filtered

    def _match_pattern(self, path: str, pattern: str) -> bool:
        """Check if path matches pattern"""
        from fnmatch import fnmatch
        return fnmatch(path, pattern)

    def _determine_actions(
        self,
        comparisons: List[FileComparison],
        sync_direction: str,
        conflict_resolution: str
    ) -> List[FileComparison]:
        """Determine sync actions for each file"""
        for comparison in comparisons:
            if sync_direction == "upload_only":
                if comparison.local_exists and not comparison.remote_exists:
                    comparison.action = "upload"
                elif comparison.local_exists and comparison.remote_exists:
                    if comparison.local_modified > comparison.remote_modified:
                        comparison.action = "upload"

            elif sync_direction == "download_only":
                if comparison.remote_exists and not comparison.local_exists:
                    comparison.action = "download"
                elif comparison.remote_exists and comparison.local_exists:
                    if comparison.remote_modified > comparison.local_modified:
                        comparison.action = "download"

            else:  # bidirectional
                if comparison.local_exists and not comparison.remote_exists:
                    comparison.action = "upload"
                elif comparison.remote_exists and not comparison.local_exists:
                    comparison.action = "download"
                elif comparison.local_exists and comparison.remote_exists:
                    # Check for conflicts
                    if comparison.local_modified > comparison.remote_modified:
                        comparison.action = "upload"
                    elif comparison.remote_modified > comparison.local_modified:
                        comparison.action = "download"
                    else:
                        comparison.action = "skip"

                    # Handle conflict resolution
                    if abs((comparison.local_modified - comparison.remote_modified).total_seconds()) < 60:
                        if conflict_resolution == "keep_newer":
                            # Already handled above
                            pass
                        elif conflict_resolution == "keep_local":
                            comparison.action = "upload"
                        elif conflict_resolution == "keep_remote":
                            comparison.action = "download"
                        elif conflict_resolution == "keep_both":
                            comparison.action = "conflict"
                        else:  # prompt
                            comparison.action = "conflict"

        return comparisons

    async def _execute_sync(
        self,
        comparisons: List[FileComparison],
        profile: SyncProfile
    ):
        """Execute sync actions"""
        source_is_local = not profile.source_path.startswith("drive://")
        drive_folder_id = (
            profile.destination_path.replace("drive://", "")
            if source_is_local
            else profile.source_path.replace("drive://", "")
        )

        for comparison in comparisons:
            try:
                if comparison.action == "upload":
                    await self._upload_file(comparison, drive_folder_id)
                elif comparison.action == "download":
                    await self._download_file(comparison, drive_folder_id)
                elif comparison.action == "conflict":
                    # Log conflict for user resolution
                    logger.warning(f"Conflict detected: {comparison.remote_path}")
                    self.errors.append({
                        "type": "conflict",
                        "file": comparison.remote_path,
                        "message": "File has conflicting changes"
                    })

            except Exception as e:
                logger.error(f"Error syncing {comparison.remote_path}: {e}")
                self.errors.append({
                    "file": comparison.remote_path,
                    "error": str(e)
                })

    async def _upload_file(self, comparison: FileComparison, parent_id: str):
        """Upload file to Drive"""
        # TODO: Implement proper parent folder creation and file upload
        file_id = await self.drive_service.upload_file(
            comparison.local_path,
            parent_id,
            os.path.basename(comparison.remote_path)
        )

        if file_id:
            self.files_synced += 1
            self.bytes_transferred += comparison.local_size or 0

    async def _download_file(self, comparison: FileComparison, folder_id: str):
        """Download file from Drive"""
        # TODO: Get file ID from path and download
        # This is simplified - need to maintain mapping of paths to IDs
        pass

    async def _log_activity(
        self,
        profile: SyncProfile,
        comparisons: List[FileComparison]
    ):
        """Log sync activity"""
        for comparison in comparisons:
            if comparison.action in ["upload", "download"]:
                activity = ActivityLog(
                    user_id=profile.user_id,
                    action="sync",
                    source_path=comparison.local_path,
                    destination_path=comparison.remote_path,
                    file_name=os.path.basename(comparison.remote_path),
                    file_size=comparison.local_size or comparison.remote_size,
                    status="success" if comparison.action != "conflict" else "conflict"
                )
                self.db.add(activity)

        await self.db.commit()