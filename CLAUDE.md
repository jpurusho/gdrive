# CLAUDE.md

## Project Overview

GDrive Sync is a standalone Electron desktop application for bidirectional Google Drive synchronization. It provides an intuitive, polished dark-theme UI for syncing files between Google Drive (personal + shared drives) and the local filesystem.

## Architecture

- **Electron** main process (`desktop/`) — handles OAuth, Google Drive API, local filesystem, SQLite
- **React + MUI** renderer (`frontend/`) — dashboard UI with drive trees, sync cards, activity history
- **Shared types** (`shared/`) — TypeScript interfaces used by both processes
- **SQLite** (better-sqlite3) — stores auth tokens, sync profiles, sync history, file checksums
- **electron-builder** — packaging for macOS, Windows, Linux
- **electron-updater** — auto-update from GitHub Releases

## Project Structure

```
gdrive/
├── desktop/              # Electron main process (TypeScript → CJS)
│   ├── index.ts          # App entry, window creation
│   ├── preload.ts        # contextBridge API for renderer
│   ├── ipc-handlers.ts   # IPC channel registration
│   └── services/
│       ├── google-auth.ts
│       ├── google-drive.ts
│       ├── local-fs.ts
│       └── database.ts
├── frontend/             # React renderer (TypeScript → Vite bundle)
│   ├── index.html
│   ├── main.tsx / App.tsx
│   ├── pages/
│   ├── components/
│   └── theme/
├── shared/types.ts       # Shared TypeScript types + IPC API interface
├── docs/                 # Architecture docs (Mermaid diagrams)
├── scripts/              # Test and utility scripts
├── .github/workflows/    # CI/CD
├── dist/                 # Build output (gitignored)
└── release/              # Packaged app (gitignored)
```

## Development Commands

```bash
npm run dev          # Start Vite dev server + Electron
npm run build        # Compile main (tsc) + build renderer (vite)
npm run dist         # Build + package macOS .dmg
npm run dist:all     # Build + package all platforms
```

## Key Design Decisions

- **Full Node.js stack** — no Python backend; Google Drive API via `googleapis` npm package
- **IPC bridge** — renderer communicates with main process via typed IPC channels (contextBridge)
- **macOS-first** — hidden inset titlebar, traffic light positioning, dark mode
- **No Docker** — standalone desktop app distributed as .dmg/.exe/.AppImage
- **Single CI job per platform** — one job produces artifacts; no multi-stage builds

## Phased Implementation

1. **Phase 1** (complete): OAuth + Dashboard + Drive/Local tree browsing
2. **Phase 2**: Sync profile creation, card-based UI with glowing progress indicators
3. **Phase 3**: Sync engine with chunked transfers, hash checksums, resumable ops
4. **Phase 4**: Scheduling (cron), activity history, conflict resolution
5. **Phase 5**: CI/CD pipeline, auto-update, polish

## Google OAuth Setup

See [docs/oauth-setup.md](docs/oauth-setup.md) for full instructions.

Quick: Create a Desktop app OAuth client at console.cloud.google.com, copy Client ID and Secret to `.env`.
