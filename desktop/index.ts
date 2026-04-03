import { app, BrowserWindow, nativeTheme, globalShortcut, Menu } from 'electron';
import * as path from 'path';
import { config } from 'dotenv';
import { registerIpcHandlers } from './ipc-handlers';
import { initDatabase, getSetting } from './services/database';
import { loadEmbeddedConfig } from './services/embedded-config';
import { initScheduler } from './services/scheduler';
import { GoogleAuthService } from './services/google-auth';
import { autoUpdater } from 'electron-updater';

// Load .env from project root
config({ path: path.join(__dirname, '../../.env') });

// Set app name for macOS menu bar, dock, and window title
app.setName('gsync');

const isDev = !app.isPackaged;
let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  nativeTheme.themeSource = 'dark';

  mainWindow = new BrowserWindow({
    title: 'gsync',
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

  // macOS menu — required for Cmd+Q, Cmd+W, fullscreen toggle, etc.
  if (process.platform === 'darwin') {
    const template: Electron.MenuItemConstructorOptions[] = [
      {
        label: app.name,
        submenu: [
          { role: 'about' },
          { type: 'separator' },
          { role: 'hide' },
          { role: 'hideOthers' },
          { role: 'unhide' },
          { type: 'separator' },
          { role: 'quit' },
        ],
      },
      {
        label: 'Edit',
        submenu: [
          { role: 'undo' },
          { role: 'redo' },
          { type: 'separator' },
          { role: 'cut' },
          { role: 'copy' },
          { role: 'paste' },
          { role: 'selectAll' },
        ],
      },
      {
        label: 'View',
        submenu: [
          { role: 'togglefullscreen' },
          {
            label: 'Exit Full Screen',
            accelerator: 'Escape',
            click: () => {
              const win = BrowserWindow.getFocusedWindow();
              if (win?.isFullScreen()) win.setFullScreen(false);
            },
          },
          { type: 'separator' },
          { role: 'resetZoom' },
          { role: 'zoomIn' },
          { role: 'zoomOut' },
          ...(isDev ? [{ type: 'separator' as const }, { role: 'toggleDevTools' as const }] : []),
        ],
      },
      {
        label: 'Window',
        submenu: [
          { role: 'minimize' },
          { role: 'zoom' },
          { role: 'close' },
          { type: 'separator' },
          { role: 'front' },
        ],
      },
    ];
    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // Also detect maximize/unmaximize for layout adjustments
  mainWindow.on('maximize', () => {
    mainWindow?.webContents.send('app:fullscreenChange', true);
  });
  mainWindow.on('unmaximize', () => {
    mainWindow?.webContents.send('app:fullscreenChange', false);
  });

  // Send fullscreen state to renderer for layout adjustments
  mainWindow.on('enter-full-screen', () => {
    mainWindow?.webContents.send('app:fullscreenChange', true);
  });
  mainWindow.on('leave-full-screen', () => {
    mainWindow?.webContents.send('app:fullscreenChange', false);
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
  const embedded = loadEmbeddedConfig();
  const ghToken = getSetting('github_token') || embedded.githubToken || process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
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
