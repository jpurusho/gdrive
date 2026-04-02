import * as cron from 'node-cron';
import { getProfiles } from './database';
import { startSync } from './sync-engine';
import { GoogleDriveService } from './google-drive';
import { GoogleAuthService } from './google-auth';
import type { SyncProfile } from '../../shared/types';

const scheduledTasks = new Map<number, cron.ScheduledTask>();

let authService: GoogleAuthService | null = null;

export function initScheduler(auth: GoogleAuthService): void {
  authService = auth;
  refreshSchedules();
}

export function refreshSchedules(): void {
  // Clear existing
  for (const [, task] of scheduledTasks) {
    task.stop();
  }
  scheduledTasks.clear();

  const profiles = getProfiles();
  for (const profile of profiles) {
    if (profile.isActive && profile.schedule) {
      scheduleProfile(profile);
    }
  }
}

export function scheduleProfile(profile: SyncProfile): void {
  if (!profile.schedule || !cron.validate(profile.schedule)) return;

  // Stop existing schedule for this profile
  const existing = scheduledTasks.get(profile.id);
  if (existing) existing.stop();

  const task = cron.schedule(profile.schedule, async () => {
    if (!authService) return;
    try {
      const driveService = new GoogleDriveService(authService.getOAuth2Client());
      await startSync(profile.id, driveService);
    } catch (err) {
      console.error(`Scheduled sync failed for profile ${profile.id}:`, err);
    }
  });

  scheduledTasks.set(profile.id, task);
}

export function unscheduleProfile(profileId: number): void {
  const task = scheduledTasks.get(profileId);
  if (task) {
    task.stop();
    scheduledTasks.delete(profileId);
  }
}

export function stopAll(): void {
  for (const [, task] of scheduledTasks) {
    task.stop();
  }
  scheduledTasks.clear();
}
