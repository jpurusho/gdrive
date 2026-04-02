import { ipcMain, app, dialog, BrowserWindow } from 'electron';
import { GoogleAuthService } from './services/google-auth';
import { GoogleDriveService } from './services/google-drive';
import { LocalFsService } from './services/local-fs';
import { getTokens } from './services/database';

let authService: GoogleAuthService;
let driveService: GoogleDriveService | null = null;

function getDriveService(): GoogleDriveService {
  if (!driveService) {
    const tokens = getTokens();
    if (!tokens) throw new Error('Not authenticated');
    driveService = new GoogleDriveService(authService.getOAuth2Client());
  }
  return driveService;
}

export function registerIpcHandlers(): void {
  authService = new GoogleAuthService();

  // ─── Auth ────────────────────────────────────────────────────────────────
  ipcMain.handle('auth:login', async () => {
    const window = BrowserWindow.getFocusedWindow();
    if (!window) throw new Error('No active window');
    const user = await authService.login(window);
    driveService = null;
    return user;
  });

  ipcMain.handle('auth:logout', async () => {
    await authService.logout();
    driveService = null;
  });

  ipcMain.handle('auth:getUser', async () => {
    return authService.getCurrentUser();
  });

  ipcMain.handle('auth:isLoggedIn', async () => {
    return authService.isLoggedIn();
  });

  // ─── Drive ───────────────────────────────────────────────────────────────
  ipcMain.handle('drive:listDrives', async () => {
    return getDriveService().listDrives();
  });

  ipcMain.handle('drive:listFiles', async (_event, driveId: string, folderId: string) => {
    return getDriveService().listFiles(driveId, folderId);
  });

  // ─── Local Filesystem ────────────────────────────────────────────────────
  ipcMain.handle('localFs:listDirectory', async (_event, dirPath: string) => {
    return LocalFsService.listDirectory(dirPath);
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

  // ─── Sync (stubs for Phase 2) ────────────────────────────────────────────
  ipcMain.handle('sync:getProfiles', async () => []);
  ipcMain.handle('sync:createProfile', async () => null);
  ipcMain.handle('sync:deleteProfile', async () => {});
  ipcMain.handle('sync:startSync', async () => {});
  ipcMain.handle('sync:cancelSync', async () => {});
  ipcMain.handle('sync:getSessions', async () => []);

  // ─── App ──────────────────────────────────────────────────────────────────
  ipcMain.handle('app:getVersion', () => app.getVersion());
  ipcMain.handle('app:checkForUpdates', async () => {});
  ipcMain.handle('app:getPlatform', () => process.platform);
}
