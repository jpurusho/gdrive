"""
Scheduler service for automatic synchronization
"""
import asyncio
import logging
from datetime import datetime
from typing import Dict, List, Any

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import select

from app.core.config import get_settings
from app.core.database import SyncProfile, User, SyncHistory
from app.services.sync_engine import SyncEngine
from app.services.google_drive import GoogleDriveService

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

settings = get_settings()

# Database setup
engine = create_async_engine(
    f"sqlite+aiosqlite:///{settings.database_url}",
    echo=False,
    future=True
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False
)


class FileChangeHandler(FileSystemEventHandler):
    """Handler for file system events"""

    def __init__(self, profile_id: int, scheduler: 'SyncScheduler'):
        self.profile_id = profile_id
        self.scheduler = scheduler
        self.pending_sync = False

    def on_modified(self, event):
        if not event.is_directory and not self.pending_sync:
            logger.info(f"File change detected for profile {self.profile_id}: {event.src_path}")
            self.pending_sync = True
            # Debounce: wait 5 seconds before syncing
            asyncio.create_task(self._delayed_sync())

    async def _delayed_sync(self):
        await asyncio.sleep(5)
        await self.scheduler.run_sync(self.profile_id)
        self.pending_sync = False


class SyncScheduler:
    """Main scheduler for sync operations"""

    def __init__(self):
        self.scheduler = AsyncIOScheduler()
        self.observers: Dict[int, Observer] = {}
        self.active_profiles: Dict[int, SyncProfile] = {}

    async def start(self):
        """Start the scheduler"""
        logger.info("Starting sync scheduler...")

        # Load active profiles
        await self.load_active_profiles()

        # Start APScheduler
        self.scheduler.start()

        logger.info("Sync scheduler started")

        # Keep running
        try:
            while True:
                await asyncio.sleep(60)  # Check for updates every minute
                await self.reload_profiles()
        except KeyboardInterrupt:
            await self.stop()

    async def stop(self):
        """Stop the scheduler"""
        logger.info("Stopping sync scheduler...")

        # Stop all file watchers
        for observer in self.observers.values():
            observer.stop()
            observer.join()

        # Stop scheduler
        self.scheduler.shutdown()

        logger.info("Sync scheduler stopped")

    async def load_active_profiles(self):
        """Load all active sync profiles"""
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(SyncProfile).where(SyncProfile.is_active == True)
            )
            profiles = result.scalars().all()

            for profile in profiles:
                await self.add_profile(profile)

    async def reload_profiles(self):
        """Reload profiles to check for changes"""
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(SyncProfile).where(SyncProfile.is_active == True)
            )
            profiles = result.scalars().all()

            current_ids = set(self.active_profiles.keys())
            new_ids = set(p.id for p in profiles)

            # Remove deleted/deactivated profiles
            for profile_id in current_ids - new_ids:
                await self.remove_profile(profile_id)

            # Add new profiles
            for profile in profiles:
                if profile.id not in current_ids:
                    await self.add_profile(profile)
                else:
                    # Check if schedule changed
                    if profile.schedule_config != self.active_profiles[profile.id].schedule_config:
                        await self.remove_profile(profile.id)
                        await self.add_profile(profile)

    async def add_profile(self, profile: SyncProfile):
        """Add a profile to the scheduler"""
        logger.info(f"Adding profile to scheduler: {profile.name} (ID: {profile.id})")

        self.active_profiles[profile.id] = profile

        # Add cron schedule if configured
        if profile.schedule_config and profile.schedule_config.get('cron'):
            cron_expr = profile.schedule_config['cron']
            try:
                trigger = CronTrigger.from_crontab(cron_expr)
                self.scheduler.add_job(
                    self.run_sync,
                    trigger,
                    args=[profile.id],
                    id=f"sync_profile_{profile.id}",
                    replace_existing=True
                )
                logger.info(f"Added cron schedule for profile {profile.id}: {cron_expr}")
            except Exception as e:
                logger.error(f"Failed to add cron schedule: {e}")

        # Add file watcher if configured
        if profile.schedule_config and 'file_watch' in profile.schedule_config.get('event_triggers', []):
            if not profile.source_path.startswith("drive://"):
                # Only watch local paths
                observer = Observer()
                handler = FileChangeHandler(profile.id, self)
                observer.schedule(handler, profile.source_path, recursive=True)
                observer.start()
                self.observers[profile.id] = observer
                logger.info(f"Added file watcher for profile {profile.id}: {profile.source_path}")

    async def remove_profile(self, profile_id: int):
        """Remove a profile from the scheduler"""
        logger.info(f"Removing profile from scheduler: {profile_id}")

        # Remove cron job
        try:
            self.scheduler.remove_job(f"sync_profile_{profile_id}")
        except:
            pass

        # Stop file watcher
        if profile_id in self.observers:
            self.observers[profile_id].stop()
            self.observers[profile_id].join()
            del self.observers[profile_id]

        # Remove from active profiles
        if profile_id in self.active_profiles:
            del self.active_profiles[profile_id]

    async def run_sync(self, profile_id: int):
        """Run synchronization for a profile"""
        logger.info(f"Running scheduled sync for profile {profile_id}")

        async with AsyncSessionLocal() as db:
            # Get profile
            result = await db.execute(
                select(SyncProfile).where(SyncProfile.id == profile_id)
            )
            profile = result.scalar_one_or_none()

            if not profile or not profile.is_active:
                logger.warning(f"Profile {profile_id} not found or inactive")
                return

            # Get user
            user_result = await db.execute(
                select(User).where(User.id == profile.user_id)
            )
            user = user_result.scalar_one_or_none()

            if not user or not user.access_token:
                logger.error(f"User not authenticated for profile {profile_id}")
                return

            # Create sync history entry
            sync_history = SyncHistory(
                profile_id=profile.id,
                started_at=datetime.utcnow(),
                status="in_progress"
            )
            db.add(sync_history)
            await db.commit()

            try:
                # Initialize services
                drive_service = GoogleDriveService(user.access_token, user.refresh_token)
                sync_engine = SyncEngine(drive_service, db)

                # Run sync
                result = await sync_engine.sync(profile=profile)

                # Update sync history
                sync_history.completed_at = datetime.utcnow()
                sync_history.status = "completed" if result.success else "failed"
                sync_history.files_synced = result.files_synced
                sync_history.bytes_transferred = result.bytes_transferred
                sync_history.errors = result.errors
                sync_history.summary = result.summary

                if result.success:
                    profile.last_sync_timestamp = datetime.utcnow()

                await db.commit()

                logger.info(f"Sync completed for profile {profile_id}: {result.files_synced} files synced")

            except Exception as e:
                logger.error(f"Sync failed for profile {profile_id}: {e}")
                sync_history.completed_at = datetime.utcnow()
                sync_history.status = "failed"
                sync_history.errors = [{"error": str(e)}]
                await db.commit()


async def main():
    """Main entry point"""
    scheduler = SyncScheduler()
    await scheduler.start()


if __name__ == "__main__":
    asyncio.run(main())