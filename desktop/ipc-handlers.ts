import { ipcMain, app, dialog, BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { GoogleAuthService } from './services/google-auth';
import { GoogleDriveService } from './services/google-drive';
import { LocalFsService } from './services/local-fs';
import { getTokens, getProfiles, createProfile, deleteProfile, updateProfile, getSetting, setSetting, getDataDir, setDataDir } from './services/database';
import { startSync, cancelSync, getSessions, getFileLogs } from './services/sync-engine';
import { refreshSchedules, scheduleProfile, unscheduleProfile } from './services/scheduler';
import { backupDatabase, restoreDatabase, syncMergeDatabase, getBackupInfo, recordBackup } from './services/db-backup';
import type { SyncProfile } from '../shared/types';

let authService: GoogleAuthService;
let driveService: GoogleDriveService | null = null;

const UPDATE_CHECK_INTERVAL = 60 * 60 * 1000; // 1 hour

function getCachedUpdateCheck(): { result: any; timestamp: number } | null {
  try {
    const cached = getSetting('update_check_cache');
    if (cached) return JSON.parse(cached);
  } catch {}
  return null;
}

function setCachedUpdateCheck(result: any): void {
  try {
    setSetting('update_check_cache', JSON.stringify({ result, timestamp: Date.now() }));
  } catch {}
}

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
  ipcMain.handle('auth:hasCredentials', () => {
    return authService.hasCredentials();
  });

  ipcMain.handle('auth:setCredentials', (_event, clientId: string, clientSecret: string) => {
    authService.setCredentials(clientId, clientSecret);
    driveService = null;
  });

  ipcMain.handle('auth:login', async () => {
    try {
      const user = await authService.login();
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

  ipcMain.handle('drive:createFolder', async (_event, name: string, parentFolderId: string, driveId: string) => {
    try {
      return await getDriveService().createFolder(name, parentFolderId, driveId);
    } catch (err: any) {
      console.error('Create folder failed:', err?.message);
      throw new Error(err?.message || 'Failed to create folder');
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

  ipcMain.handle('sync:deleteSessions', async (_event, ids: number[]) => {
    try {
      const db = require('./services/database').getDb();
      const placeholders = ids.map(() => '?').join(',');
      db.prepare(`DELETE FROM sync_file_log WHERE history_id IN (${placeholders})`).run(...ids);
      db.prepare(`DELETE FROM sync_history WHERE id IN (${placeholders})`).run(...ids);
    } catch (err: any) {
      console.error('Delete sessions failed:', err?.message);
      throw new Error(err?.message || 'Failed to delete sessions');
    }
  });

  ipcMain.handle('sync:getFileLogs', async (_event, sessionId: number) => {
    try {
      return getFileLogs(sessionId);
    } catch (err: any) {
      console.error('Get file logs failed:', err?.message);
      return [];
    }
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

  ipcMain.handle('backup:setFolder', async (_event, folderId: string, folderName: string) => {
    try {
      const db = require('./services/database').getDb();
      db.prepare("INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES ('backup_folder_id', ?, datetime('now'))").run(folderId);
      db.prepare("INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES ('backup_folder_name', ?, datetime('now'))").run(folderName);
    } catch (err: any) {
      throw new Error(err?.message || 'Failed to set backup folder');
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
  ipcMain.handle('app:getDataDir', () => getDataDir());

  ipcMain.handle('app:setDataDir', async (_event, newDir: string) => {
    const oldDir = getDataDir();
    const oldDbPath = path.join(oldDir, 'gdrive-sync.db');
    const newDbPath = path.join(newDir, 'gdrive-sync.db');

    // Ensure new directory exists
    if (!fs.existsSync(newDir)) {
      fs.mkdirSync(newDir, { recursive: true });
    }

    // Copy DB to new location if it exists and target doesn't
    if (fs.existsSync(oldDbPath) && !fs.existsSync(newDbPath)) {
      try {
        const db = require('./services/database').getDb();
        db.pragma('wal_checkpoint(TRUNCATE)');
      } catch {}
      fs.copyFileSync(oldDbPath, newDbPath);
      // Copy WAL files if they exist
      for (const ext of ['-shm', '-wal']) {
        if (fs.existsSync(oldDbPath + ext)) {
          fs.copyFileSync(oldDbPath + ext, newDbPath + ext);
        }
      }
    }

    setDataDir(newDir);
    return { success: true, message: 'Data directory changed. Restart the app to apply.' };
  });

  ipcMain.handle('app:openExternal', (_event, url: string) => {
    const { shell } = require('electron');
    shell.openExternal(url);
  });

  ipcMain.handle('app:downloadUpdate', async (_event, downloadUrl: string, destDir?: string) => {
    const https = require('https');
    const os = require('os');
    const dir = destDir || path.join(os.homedir(), 'Downloads');
    const fileName = downloadUrl.split('/').pop() || 'gsync-update.zip';
    const destPath = path.join(dir, fileName);

    return new Promise((resolve, reject) => {
      const follow = (url: string) => {
        https.get(url, { headers: { 'User-Agent': 'gsync-updater' } }, (res: any) => {
          // Follow redirects
          if (res.statusCode === 301 || res.statusCode === 302) {
            return follow(res.headers.location);
          }
          if (res.statusCode !== 200) {
            return reject(new Error(`Download failed: HTTP ${res.statusCode}`));
          }

          const totalBytes = parseInt(res.headers['content-length'] || '0', 10);
          let downloaded = 0;
          const file = fs.createWriteStream(destPath);

          res.on('data', (chunk: Buffer) => {
            downloaded += chunk.length;
            // Send progress to renderer
            for (const win of BrowserWindow.getAllWindows()) {
              if (!win.isDestroyed()) {
                win.webContents.send('app:downloadProgress', {
                  downloaded,
                  total: totalBytes,
                  percent: totalBytes ? Math.round((downloaded / totalBytes) * 100) : 0,
                });
              }
            }
          });

          res.pipe(file);
          file.on('finish', () => {
            file.close();
            resolve({ success: true, path: destPath, size: downloaded });
          });
          file.on('error', (err: any) => {
            fs.unlinkSync(destPath);
            reject(err);
          });
        }).on('error', reject);
      };
      follow(downloadUrl);
    });
  });

  ipcMain.handle('app:getVersion', () => app.getVersion());
  ipcMain.handle('app:checkForUpdates', async () => {
    const currentVersion = app.getVersion();
    const cached = getCachedUpdateCheck();
    if (cached && Date.now() - cached.timestamp < UPDATE_CHECK_INTERVAL) {
      // Invalidate stale "available" cache if user already installed that version
      if (cached.result.status === 'available' && cached.result.version) {
        const cachedVer = cached.result.version.split('.').map(Number);
        const current = currentVersion.split('.').map(Number);
        const stillNewer = cachedVer[0] > current[0]
          || (cachedVer[0] === current[0] && cachedVer[1] > current[1])
          || (cachedVer[0] === current[0] && cachedVer[1] === current[1] && cachedVer[2] > current[2]);
        if (stillNewer) return cached.result;
        // Fall through to re-check since cached version is no longer newer
      } else {
        return cached.result;
      }
    }

    try {
      const https = require('https');

      const release: any = await new Promise((resolve, reject) => {
        const req = https.get({
          hostname: 'api.github.com',
          path: '/repos/jpurusho/gdrive/releases/latest',
          headers: { 'User-Agent': 'gsync-updater' },
          timeout: 10000,
        }, (res: any) => {
          let data = '';
          res.on('data', (chunk: string) => { data += chunk; });
          res.on('end', () => {
            console.log(`[Update] GitHub API: ${res.statusCode}`);
            if (res.statusCode === 200) {
              resolve(JSON.parse(data));
            } else {
              reject(new Error(`HTTP ${res.statusCode}`));
            }
          });
        }).on('error', (err: any) => {
          reject(new Error(err.message));
        }).on('timeout', () => {
          req.destroy();
          reject(new Error('timeout'));
        });
      });

      const latestVersion = release.tag_name?.replace(/^v/, '') || '';
      const downloadUrl = release.html_url || '';
      const releaseNotes = release.body || '';

      if (!latestVersion) return { status: 'latest', version: currentVersion };

      const current = currentVersion.split('.').map(Number);
      const latest = latestVersion.split('.').map(Number);
      const isNewer = latest[0] > current[0]
        || (latest[0] === current[0] && latest[1] > current[1])
        || (latest[0] === current[0] && latest[1] === current[1] && latest[2] > current[2]);

      const result = isNewer
        ? { status: 'available', version: latestVersion, url: downloadUrl, notes: releaseNotes }
        : { status: 'latest', version: currentVersion };
      setCachedUpdateCheck(result);
      return result;
    } catch (err: any) {
      console.error('[Update] Check failed:', err?.message);
      // Return stale cache if available, otherwise silently report "latest"
      if (cached) return cached.result;
      return { status: 'latest', version: currentVersion };
    }
  });
  ipcMain.handle('app:getPlatform', () => process.platform);
  ipcMain.handle('app:getSetting', (_event, key: string) => {
    try { return getSetting(key); } catch { return null; }
  });
  ipcMain.handle('app:setSetting', (_event, key: string, value: string) => {
    try { setSetting(key, value); } catch (err: any) { console.error('Set setting failed:', err?.message); }
  });
}
