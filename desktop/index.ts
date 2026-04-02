import { app, BrowserWindow, nativeTheme } from 'electron';
import * as path from 'path';
import { config } from 'dotenv';
import { registerIpcHandlers } from './ipc-handlers';
import { initDatabase, getSetting } from './services/database';
import { initScheduler } from './services/scheduler';
import { GoogleAuthService } from './services/google-auth';
import { autoUpdater } from 'electron-updater';

// Load .env from project root
config({ path: path.join(__dirname, '../../.env') });

const isDev = !app.isPackaged;
let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  nativeTheme.themeSource = 'dark';

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 850,
    minWidth: 960,
    minHeight: 640,
    icon: path.join(__dirname, '../resources/icon.png'),
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 18 },
    backgroundColor: '#0f0f23',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function setupAutoUpdater(): void {
  // Use GH token from settings or env for update checks
  const ghToken = getSetting('github_token') || process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  if (ghToken) {
    autoUpdater.setFeedURL({
      provider: 'github',
      owner: 'jpurusho',
      repo: 'gdrive',
      token: ghToken,
    });
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info) => {
    console.log(`[Update] New version available: ${info.version}`);
    const win = BrowserWindow.getAllWindows()[0];
    if (win && !win.isDestroyed()) {
      win.webContents.send('app:updateAvailable', info.version);
    }
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log(`[Update] Downloaded: ${info.version}`);
    const win = BrowserWindow.getAllWindows()[0];
    if (win && !win.isDestroyed()) {
      win.webContents.send('app:updateReady', info.version);
    }
  });

  autoUpdater.on('error', (err) => {
    console.error('[Update] Error:', err?.message);
  });

  autoUpdater.checkForUpdatesAndNotify().catch((err) => {
    console.error('[Update] Check failed:', err?.message);
  });
}

app.whenReady().then(() => {
  // Set dock icon
  if (process.platform === 'darwin') {
    const iconPath = path.join(__dirname, '../resources/icon.png');
    try { app.dock.setIcon(iconPath); } catch {}
  }

  initDatabase();
  registerIpcHandlers();
  initScheduler(new GoogleAuthService());
  createWindow();

  if (!isDev) {
    setupAutoUpdater();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}
