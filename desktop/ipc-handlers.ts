import { ipcMain, app, dialog, BrowserWindow } from 'electron';
import { GoogleAuthService } from './services/google-auth';
import { GoogleDriveService } from './services/google-drive';
import { LocalFsService } from './services/local-fs';
import { getTokens, getProfiles, createProfile, deleteProfile, updateProfile, getSetting, setSetting } from './services/database';
import { startSync, cancelSync, getSessions } from './services/sync-engine';
import { refreshSchedules, scheduleProfile, unscheduleProfile } from './services/scheduler';
import { backupDatabase, restoreDatabase, syncMergeDatabase, getBackupInfo, recordBackup } from './services/db-backup';
import type { SyncProfile } from '../shared/types';

let authService: GoogleAuthService;
let driveService: GoogleDriveService | null = null;

function getDriveService(): GoogleDriveService {
  if (!driveService) {
    const tokens = getTokens();
    if (!tokens) throw new Error('Not authenticated. Please sign in again.');
    driveService = new GoogleDriveService(authService.getOAuth2Client());
  }
  return driveService;
}

/** Send sync error event to all renderer windows */
function sendSyncError(profileId: number, error: string): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send('sync:error', { profileId, error });
    }
  }
}

export function registerIpcHandlers(): void {
  authService = new GoogleAuthService();

  // ─── Auth ────────────────────────────────────────────────────────────────
  ipcMain.handle('auth:login', async () => {
    try {
      const window = BrowserWindow.getFocusedWindow();
      if (!window) throw new Error('No active window');
      const user = await authService.login(window);
      driveService = null;
      return user;
    } catch (err: any) {
      console.error('Login failed:', err?.message);
      throw new Error(err?.message || 'Login failed');
    }
  });

  ipcMain.handle('auth:logout', async () => {
    try {
      await authService.logout();
      driveService = null;
    } catch (err: any) {
      console.error('Logout error:', err?.message);
      // Clear local state even if revoke fails
      driveService = null;
    }
  });

  ipcMain.handle('auth:getUser', async () => {
    try {
      return await authService.getCurrentUser();
    } catch (err: any) {
      console.error('Get user failed:', err?.message);
      return null;
    }
  });

  ipcMain.handle('auth:isLoggedIn', async () => {
    try {
      return authService.isLoggedIn();
    } catch {
      return false;
    }
  });

  // ─── Drive ───────────────────────────────────────────────────────────────
  ipcMain.handle('drive:listDrives', async () => {
    try {
      return await getDriveService().listDrives();
    } catch (err: any) {
      console.error('List drives failed:', err?.message);
      throw new Error(err?.message || 'Failed to list drives');
    }
  });

  ipcMain.handle('drive:listFiles', async (_event, driveId: string, folderId: string) => {
    try {
      return await getDriveService().listFiles(driveId, folderId);
    } catch (err: any) {
      console.error('List files failed:', err?.message);
      throw new Error(err?.message || 'Failed to list files');
    }
  });

  // ─── Local Filesystem ────────────────────────────────────────────────────
  ipcMain.handle('localFs:listDirectory', async (_event, dirPath: string) => {
    try {
      return await LocalFsService.listDirectory(dirPath);
    } catch (err: any) {
      console.error('List directory failed:', err?.message);
      throw new Error(err?.message || 'Failed to list directory');
    }
  });

  ipcMain.handle('localFs:getHomeDir', async () => {
    return LocalFsService.getHomeDir();
  });

  ipcMain.handle('localFs:selectDirectory', async () => {
    const window = BrowserWindow.getFocusedWindow();
    if (!window) return null;
    const result = await dialog.showOpenDialog(window, {
      properties: ['openDirectory', 'createDirectory'],
      title: 'Select Folder for Sync',
    });
    return result.canceled ? null : result.filePaths[0];
  });

  // ─── Sync Profiles ───────────────────────────────────────────────────────
  ipcMain.handle('sync:getProfiles', async () => {
    try {
      return getProfiles();
    } catch (err: any) {
      console.error('Get profiles failed:', err?.message);
      return [];
    }
  });

  ipcMain.handle('sync:createProfile', async (_event, profile: Omit<SyncProfile, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const created = createProfile(profile);
      if (created.schedule && created.isActive) scheduleProfile(created);
      return created;
    } catch (err: any) {
      console.error('Create profile failed:', err?.message);
      throw new Error(err?.message || 'Failed to create profile');
    }
  });

  ipcMain.handle('sync:updateProfile', async (_event, id: number, updates: Partial<SyncProfile>) => {
    try {
      const updated = updateProfile(id, updates);
      if (updated) {
        unscheduleProfile(id);
        if (updated.schedule && updated.isActive) scheduleProfile(updated);
      }
      return updated;
    } catch (err: any) {
      console.error('Update profile failed:', err?.message);
      throw new Error(err?.message || 'Failed to update profile');
    }
  });

  ipcMain.handle('sync:deleteProfile', async (_event, id: number) => {
    try {
      unscheduleProfile(id);
      deleteProfile(id);
    } catch (err: any) {
      console.error('Delete profile failed:', err?.message);
      throw new Error(err?.message || 'Failed to delete profile');
    }
  });

  // ─── Sync Engine ────────────────────────────────────────────────────────
  ipcMain.handle('sync:startSync', async (_event, profileId: number) => {
    try {
      const ds = getDriveService();
      startSync(profileId, ds).catch((err) => {
        console.error('Sync failed:', err?.message);
        sendSyncError(profileId, err?.message || 'Sync failed');
      });
    } catch (err: any) {
      throw new Error(err?.message || 'Failed to start sync');
    }
  });

  ipcMain.handle('sync:cancelSync', async (_event, profileId: number) => {
    cancelSync(profileId);
  });

  ipcMain.handle('sync:getSessions', async (_event, profileId?: number) => {
    try {
      return getSessions(profileId);
    } catch (err: any) {
      console.error('Get sessions failed:', err?.message);
      return [];
    }
  });

  // ─── DB Backup ─────────────────────────────────────────────────────────────
  ipcMain.handle('backup:backup', async () => {
    try {
      const ds = getDriveService();
      const result = await backupDatabase(ds);
      if (result.success) recordBackup();
      return result;
    } catch (err: any) {
      return { success: false, action: 'created' as const, fileId: '', size: 0, timestamp: '', error: err?.message || 'Backup failed' };
    }
  });

  ipcMain.handle('backup:restore', async () => {
    try {
      const ds = getDriveService();
      return await restoreDatabase(ds);
    } catch (err: any) {
      return { success: false, size: 0, profilesRestored: 0, historyRestored: 0, error: err?.message || 'Restore failed' };
    }
  });

  ipcMain.handle('backup:syncMerge', async () => {
    try {
      const ds = getDriveService();
      const result = await syncMergeDatabase(ds);
      if (result.success) recordBackup();
      return result;
    } catch (err: any) {
      return { success: false, profilesAdded: 0, profilesUpdated: 0, historyAdded: 0, fileLogAdded: 0, totalChanges: 0, error: err?.message || 'Merge failed' };
    }
  });

  ipcMain.handle('backup:getInfo', async () => {
    try {
      return getBackupInfo();
    } catch {
      return { lastBackup: null, folderId: null };
    }
  });

  // ─── App Settings ──────────────────────────────────────────────────────────
  ipcMain.handle('app:getVersion', () => app.getVersion());
  ipcMain.handle('app:checkForUpdates', async () => {});
  ipcMain.handle('app:getPlatform', () => process.platform);
  ipcMain.handle('app:getSetting', (_event, key: string) => {
    try { return getSetting(key); } catch { return null; }
  });
  ipcMain.handle('app:setSetting', (_event, key: string, value: string) => {
    try { setSetting(key, value); } catch (err: any) { console.error('Set setting failed:', err?.message); }
  });
}
