# CLAUDE.md

## Project Overview

**gsync** is a standalone Electron desktop application for bidirectional Google Drive synchronization. It provides a polished, themeable UI for syncing files between Google Drive (personal + shared drives) and the local filesystem. All 5 implementation phases are complete.

## Architecture

- **Electron** main process (`desktop/`) — OAuth (system browser + local HTTP callback), Google Drive API, sync engine, scheduler, SQLite
- **React + MUI** renderer (`frontend/`) — dashboard with swappable panels, profiles page, history, settings, about, 6 themes
- **Shared types** (`shared/`) — TypeScript interfaces used by both processes
- **SQLite** (better-sqlite3) — auth tokens, sync profiles, sync history, file checksums, app settings
- **electron-builder** — packaging for macOS (.dmg + .zip), Windows, Linux
- **electron-updater** — auto-update from GitHub Releases

## Project Structure

```
gdrive/
├── desktop/              # Electron main process (TypeScript → CJS)
│   ├── index.ts          # App entry, window creation, auto-updater
│   ├── preload.ts        # contextBridge API for renderer
│   ├── ipc-handlers.ts   # IPC channel registration (all try-catch wrapped)
│   └── services/
│       ├── google-auth.ts    # OAuth2 via system browser + local HTTP server
│       ├── google-drive.ts   # Drive API: list, download (resumable), upload, export
│       ├── sync-engine.ts    # Core sync: download/upload/bidirectional, retry, pause/resume
│       ├── scheduler.ts      # node-cron based auto-sync
│       ├── db-backup.ts      # DB backup/restore/merge to Google Drive
│       ├── local-fs.ts       # Local filesystem operations
│       └── database.ts       # SQLite init, CRUD, settings, migrations, configurable data dir
├── frontend/             # React renderer (TypeScript → Vite bundle)
│   ├── index.html
│   ├── main.tsx          # Entry: AppThemeProvider + AppSettingsProvider
│   ├── App.tsx           # Auth routing with ErrorBoundary
│   ├── context/
│   │   └── AppSettingsContext.tsx  # Customizable app title
│   ├── pages/
│   │   ├── Login.tsx     # First-run setup + OAuth sign-in (system browser)
│   │   ├── Dashboard.tsx # Swappable file explorers + resizable sync status table
│   │   ├── Profiles.tsx  # Full card-based profile CRUD
│   │   ├── History.tsx   # Sync session history table
│   │   ├── Settings.tsx  # Data dir, OAuth creds, GH token, backup, profiles, title, theme
│   │   └── About.tsx     # Feature cards, tech stack, description
│   ├── components/
│   │   ├── Layout/Sidebar.tsx
│   │   ├── DriveTree/DriveTree.tsx
│   │   ├── LocalTree/LocalTree.tsx
│   │   ├── SyncCards/SyncCards.tsx         # Cards with glow, pause/resume, status
│   │   ├── SyncStatus/SyncStatus.tsx      # Dashboard table with pause/play
│   │   ├── CreateProfileDialog/
│   │   ├── EditProfileDialog/
│   │   ├── ErrorBoundary/ErrorBoundary.tsx
│   │   └── StatusMessage/StatusMessage.tsx # Classified error display
│   └── theme/
│       ├── themes.ts        # 6 theme definitions
│       └── ThemeContext.tsx  # Theme provider + localStorage persistence
├── shared/types.ts       # All TypeScript types + IPC API interface
├── resources/
│   ├── icon.png          # App icon (1024px)
│   └── icon.icns         # macOS icon
├── docs/                 # Architecture, OAuth setup, phases, cost tracking
├── .github/workflows/    # CI: build matrix + release with xattr instructions
├── dist/                 # Build output (gitignored)
└── release/              # Packaged app (gitignored)
```

## Development Commands

```bash
npm run dev          # Start Vite dev server + Electron (hot reload)
npm run build        # Compile main (tsc) + build renderer (vite) + embed OAuth creds
npm run dist         # Build + package macOS .dmg + .zip
npm run dist:all     # Build + package all platforms
```

## Key Design Decisions

- **System browser OAuth** — opens default browser for Google sign-in (standard desktop pattern: VS Code, gcloud, GitHub CLI). Local HTTP server on port 48620-48640 catches callback.
- **Credentials embedded at build time** — `prebuild` script reads `.env` → `dist/oauth-config.json`. Users never see credential setup. Fallback to manual entry if not embedded.
- **Safe sync mode** — never deletes files on either side. Only adds and updates.
- **Pause/resume** — large downloads saved as `.partial` files, resumed via HTTP Range headers.
- **Retry with backoff** — transient errors (network, rate limit, 500) retried 3 times with exponential backoff.
- **Folder validation** — sync validates local + remote folders exist before starting. Auto-creates local folder for downloads. Auto-deactivates profiles with missing folders.
- **Configurable data directory** — `~/.gsync/config.json` stores custom DB path. Users can choose writable location.
- **DB backup to Drive** — backup/restore/merge with last-write-wins strategy.
- **Error classification** — all errors classified into user-friendly categories (offline, expired, denied, rate limit, disk full). No raw traces in UI.

## All Phases Complete

1. **Phase 1**: OAuth + Dashboard + Drive/Local tree browsing
2. **Phase 2**: Sync profile creation, card-based UI with glowing progress borders
3. **Phase 3**: Sync engine with streaming transfers, MD5 checksums, Google Workspace export
4. **Phase 4**: Scheduling (node-cron), activity history, pause/resume
5. **Phase 5**: CI/CD, auto-update, themes, polish, error hardening

## Google OAuth Setup

For **developers** building the app:
1. Create Desktop app OAuth client at console.cloud.google.com
2. Enable Google Drive API
3. Add test users in OAuth consent screen
4. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env`
5. Add same as GitHub repo secrets for CI builds

For **end users**: just download, install, and click "Sign in with Google".

## macOS Installation (unsigned)

```bash
xattr -rc /Applications/gsync.app
```
