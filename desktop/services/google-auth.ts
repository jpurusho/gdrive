import { BrowserWindow, session } from 'electron';
import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import * as path from 'path';
import { saveTokens, getTokens, clearTokens, saveUserInfo, getUserInfo, clearUserInfo } from './database';
import type { UserInfo, AuthTokens } from '../../shared/types';

const SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
];

const REDIRECT_URI = 'http://localhost/oauth2callback';

export class GoogleAuthService {
  private oauth2Client: OAuth2Client;

  constructor() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.warn('Google OAuth credentials not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env');
    }

    this.oauth2Client = new OAuth2Client({
      clientId: clientId || '',
      clientSecret: clientSecret || '',
      redirectUri: REDIRECT_URI,
    });

    // Restore tokens from database
    const tokens = getTokens();
    if (tokens) {
      this.oauth2Client.setCredentials({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_type: tokens.token_type,
        expiry_date: tokens.expiry_date,
        scope: tokens.scope,
      });
    }

    // Auto-refresh tokens
    this.oauth2Client.on('tokens', (newTokens) => {
      const existing = getTokens();
      const merged: AuthTokens = {
        access_token: newTokens.access_token || existing?.access_token || '',
        refresh_token: newTokens.refresh_token || existing?.refresh_token,
        token_type: newTokens.token_type || existing?.token_type,
        expiry_date: newTokens.expiry_date || existing?.expiry_date,
        scope: newTokens.scope || existing?.scope,
      };
      saveTokens(merged);
    });
  }

  getOAuth2Client(): OAuth2Client {
    return this.oauth2Client;
  }

  async login(parentWindow: BrowserWindow): Promise<UserInfo> {
    // Clear the auth session so Google doesn't default to passkey verification
    // (passkeys can't complete inside Electron since we disabled WebAuthentication)
    const authSession = session.fromPartition('persist:google-auth');
    await authSession.clearStorageData();

    const authUrl = this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent',
      redirect_uri: REDIRECT_URI,
    });

    const code = await this.openAuthWindow(parentWindow, authUrl);
    const { tokens } = await this.oauth2Client.getToken({
      code,
      redirect_uri: REDIRECT_URI,
    });

    this.oauth2Client.setCredentials(tokens);

    const authTokens: AuthTokens = {
      access_token: tokens.access_token || '',
      refresh_token: tokens.refresh_token ?? undefined,
      token_type: tokens.token_type ?? undefined,
      expiry_date: tokens.expiry_date ?? undefined,
      scope: tokens.scope ?? undefined,
    };
    saveTokens(authTokens);

    const oauth2 = google.oauth2({ version: 'v2', auth: this.oauth2Client });
    const { data } = await oauth2.userinfo.get();

    const userInfo: UserInfo = {
      email: data.email || '',
      name: data.name || '',
      picture: data.picture || '',
    };
    saveUserInfo(userInfo);

    return userInfo;
  }

  async logout(): Promise<void> {
    try {
      await this.oauth2Client.revokeCredentials();
    } catch {
      // Ignore revoke errors
    }
    this.oauth2Client.setCredentials({});
    clearTokens();
    clearUserInfo();
    // Clear the persistent auth session so next login starts fresh
    const authSession = session.fromPartition('persist:google-auth');
    await authSession.clearStorageData();
  }

  async getCurrentUser(): Promise<UserInfo | null> {
    const tokens = getTokens();
    if (!tokens) return null;

    const cached = getUserInfo();
    if (cached) return cached;

    try {
      this.oauth2Client.setCredentials({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
      });
      const oauth2 = google.oauth2({ version: 'v2', auth: this.oauth2Client });
      const { data } = await oauth2.userinfo.get();
      const userInfo: UserInfo = {
        email: data.email || '',
        name: data.name || '',
        picture: data.picture || '',
      };
      saveUserInfo(userInfo);
      return userInfo;
    } catch {
      return null;
    }
  }

  isLoggedIn(): boolean {
    const tokens = getTokens();
    return tokens !== null;
  }

  private openAuthWindow(parent: BrowserWindow, authUrl: string): Promise<string> {
    return new Promise((resolve, reject) => {
      let resolved = false;

      // Use a persistent partition so Google remembers the device across logins
      // (avoids repeated "verify it's you" challenges)
      const authSession = session.fromPartition('persist:google-auth');

      // Preload that disables WebAuthn/Passkey APIs so Google falls back
      // to password + standard 2FA (phone prompt, authenticator app, SMS).
      // contextIsolation must be false so the preload modifies the PAGE's
      // navigator object, not an isolated copy.
      const authPreload = path.join(__dirname, 'auth-preload.js');

      const authWindow = new BrowserWindow({
        width: 500,
        height: 700,
        parent,
        modal: true,
        show: false,
        title: 'Sign in with Google',
        webPreferences: {
          session: authSession,
          preload: authPreload,
          nodeIntegration: false,
          contextIsolation: false,
          sandbox: false,
        },
      });

      authWindow.setMenuBarVisibility(false);
      authWindow.once('ready-to-show', () => authWindow.show());

      // Allow Google to open popup windows for 2FA, security prompts, etc.
      authWindow.webContents.setWindowOpenHandler(({ url }) => {
        return {
          action: 'allow',
          overrideBrowserWindowOptions: {
            width: 500,
            height: 600,
            parent: authWindow,
            modal: true,
            webPreferences: {
              session: authSession,
              preload: authPreload,
              nodeIntegration: false,
              contextIsolation: false,
              sandbox: false,
            },
          },
        };
      });

      // When a child popup is created, wire up the same redirect interception
      authWindow.webContents.on('did-create-window', (childWindow) => {
        wireRedirectCapture(childWindow);
      });

      // Capture the OAuth redirect on the main auth window
      wireRedirectCapture(authWindow);

      authWindow.on('closed', () => {
        if (!resolved) {
          resolved = true;
          reject(new Error('Authentication window was closed'));
        }
      });

      authWindow.loadURL(authUrl);

      // --- helpers scoped to this login attempt ---

      function wireRedirectCapture(win: BrowserWindow): void {
        // Intercept any navigation to the redirect URI
        win.webContents.on('will-navigate', (_event, url) => {
          checkForCode(url, win);
        });

        win.webContents.on('will-redirect', (_event, url) => {
          checkForCode(url, win);
        });
      }

      function checkForCode(url: string, win: BrowserWindow): void {
        if (resolved) return;
        if (!url.startsWith(REDIRECT_URI)) return;

        try {
          const parsed = new URL(url);
          const code = parsed.searchParams.get('code');
          const error = parsed.searchParams.get('error');

          if (code) {
            resolved = true;
            // Close all auth windows
            if (!authWindow.isDestroyed()) authWindow.close();
            resolve(code);
          } else if (error) {
            resolved = true;
            if (!authWindow.isDestroyed()) authWindow.close();
            reject(new Error(`OAuth error: ${error}`));
          }
        } catch {
          // Malformed URL, ignore
        }
      }
    });
  }
}
