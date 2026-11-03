import { app, BrowserWindow, nativeTheme, globalShortcut, Menu, Tray, nativeImage } from 'electron';
import * as path from 'path';
import { config } from 'dotenv';
import { registerIpcHandlers } from './ipc-handlers';
import { initDatabase } from './services/database';
import { initScheduler } from './services/scheduler';
import { GoogleAuthService } from './services/google-auth';

// Load .env from project root
config({ path: path.join(__dirname, '../../.env') });

// Set app name for macOS menu bar, dock, and window title
app.setName('gsync');

const isDev = !app.isPackaged;
let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let appIsQuitting = false;

function createTray(): void {
  const iconPath = path.join(__dirname, '../resources/icon.png');
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  tray = new Tray(icon);
  tray.setToolTip('gsync');

  const rebuild = () => {
    const menu = Menu.buildFromTemplate([
      {
        label: 'Show gsync',
        click: () => { mainWindow?.show(); mainWindow?.focus(); },
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => { appIsQuitting = true; app.quit(); },
      },
    ]);
    tray?.setContextMenu(menu);
  };

  rebuild();
  tray.on('double-click', () => { mainWindow?.show(); mainWindow?.focus(); });
}

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

  // Hide to tray instead of closing (macOS & Windows)
  mainWindow.on('close', (event) => {
    if (!appIsQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  // Set dock icon
  if (process.platform === 'darwin') {
    const iconPath = path.join(__dirname, '../resources/icon.png');
    try { app.dock?.setIcon(iconPath); } catch {}
  }

  initDatabase();
  registerIpcHandlers();
  initScheduler(new GoogleAuthService());
  createTray();
  createWindow();

  app.on('before-quit', () => { appIsQuitting = true; });

  app.on('activate', () => {
    // macOS: clicking dock icon shows window if hidden
    if (mainWindow) {
      mainWindow.show();
    } else {
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
