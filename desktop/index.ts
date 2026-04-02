import { app, BrowserWindow, nativeTheme } from 'electron';
import * as path from 'path';
import { config } from 'dotenv';
import { registerIpcHandlers } from './ipc-handlers';
import { initDatabase } from './services/database';
import { initScheduler } from './services/scheduler';
import { GoogleAuthService } from './services/google-auth';
import { autoUpdater } from 'electron-updater';

// Load .env from project root
config({ path: path.join(__dirname, '../../.env') });

// Disable WebAuthn/FIDO at the Chromium level.
// Google will fall back to password + standard 2FA (phone prompt, SMS, authenticator).
// Without this, macOS blocks FIDO when Electron is not launched from Finder/.app bundle.
app.commandLine.appendSwitch('disable-features', 'WebAuthentication,WebAuthenticationConditionalUI');

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

app.whenReady().then(() => {
  // Set dock icon (needed for dev mode — packaged app uses resources/icon.icns)
  if (process.platform === 'darwin') {
    const iconPath = isDev
      ? path.join(__dirname, '../resources/icon.png')
      : path.join(__dirname, '../resources/icon.png');
    try { app.dock.setIcon(iconPath); } catch {}
  }

  initDatabase();
  registerIpcHandlers();
  initScheduler(new GoogleAuthService());
  createWindow();

  if (!isDev) {
    autoUpdater.checkForUpdatesAndNotify();
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
