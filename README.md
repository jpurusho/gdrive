# gsync

A standalone Electron desktop app for syncing Google Drive with your local filesystem. Profile-centric design — create sync profiles, monitor status, and let gsync handle the rest.

![Welcome](docs/screenshots/welcome.png)

## Screenshots

| Home — Profile Command Center | Quick Sync — Multi-folder Selection |
|:---:|:---:|
| ![Home](docs/screenshots/home.png) | ![Quick Sync](docs/screenshots/quick-sync.png) |

| Sync History | Settings & Themes |
|:---:|:---:|
| ![History](docs/screenshots/history.png) | ![Settings](docs/screenshots/settings.png) |

## Features

| Feature | Description |
|---------|-------------|
| **Profile Command Center** | Master-detail layout — profile list on the left, live detail on the right |
| **Google OAuth** | System browser sign-in (Safari/Chrome) — passkeys, autofill, 2FA all work |
| **Bidirectional Sync** | Download, upload, or bidirectional per profile |
| **MD5 Checksums** | Only transfers changed files — compares hashes before downloading |
| **Pause & Resume** | Pause large transfers mid-sync; partial files saved as `.partial` for resume |
| **HEIC to JPEG** | Auto-convert iPhone photos to JPEG during sync (per profile toggle) |
| **Google Workspace Export** | Docs→DOCX, Sheets→XLSX, Slides→PPTX, Drawings→PNG |
| **Shared with Me** | Browse files shared to your email, bucketed by This Week / This Month / older |
| **Scheduled Auto-Sync** | Cron schedules: every 15m, 30m, hourly, 6h, daily, weekdays |
| **Active/Inactive Toggle** | Pause a profile's schedule without deleting it |
| **File Filters** | Glob patterns per profile (e.g., `*.pdf, *.docx, reports/*`) |
| **Source Folder Name** | Optionally creates a subfolder in destination named after the Drive folder |
| **Activity History** | Filterable, sortable history with bulk delete — per profile and global |
| **Database Backup** | Backup/restore/merge settings and history to Google Drive |
| **5 Themes** | Midnight, GitHub Dark, Ocean, Sunset, Light |
| **Auto-Update** | In-app update checker with download progress |
| **Collapsible Sidebar** | 4 nav items: Home, History, Settings, About |
| **Customizable Title** | Change the app name in Settings — saved to database |
| **Safe Sync Mode** | Never deletes files on either side — only adds and updates |
| **Error Handling** | Retry with backoff, classified user-friendly errors, no raw traces |

## Download & Install

### From GitHub Releases

1. Download the `.zip` from the [latest release](https://github.com/jpurusho/gdrive/releases/latest)
2. Extract (double-click)
3. Move `gsync.app` to `/Applications`
4. Run once: `xattr -rc /Applications/gsync.app`
5. Open gsync → Sign in with Google → done

### From Source

```bash
git clone https://github.com/jpurusho/gdrive.git
cd gdrive
npm install
cp .env.example .env  # Add your Google OAuth credentials
npm run dev
```

## Screenshots

### Home — Profile Command Center

```
+--------+------------------+--------------------------------------+
| gsync  | STATS BAR: 3 profiles, 1 active, 847 files, 2.1 GB     |
|--------|------------------+--------------------------------------|
| Home   | PROFILES   [+]  |  WORK DOCUMENTS              [toggle]|
| Hist   |                  |                                      |
| Sett   | ● Work Docs      |  [====75%====] report.docx           |
| About  |   Syncing 14/20  |  12 synced, 2 skipped, 0 failed     |
|        |                  |                                      |
|        | ○ Photos         |  ☁ My Drive/Docs/ → 📁 ~/Documents/ |
|        |   ✓ 2h ago       |  ⬇ Download · ⏰ Every hour         |
|        |                  |                                      |
|        | ○ Team Docs      |  RECENT ACTIVITY                     |
|        |   ✓ 8m ago       |  12:34  14 synced    0.8 MB   12s   |
|--------|                  |  11:30  1,203 checked  --     3s    |
| [user] |                  |  [Pause] [Edit] [Sync Now] [Delete]  |
+--------+------------------+--------------------------------------+
```

## Architecture

```mermaid
graph TB
    subgraph Electron
        direction TB
        MAIN[Main Process<br/>OAuth · Drive API · Sync Engine · Scheduler · SQLite]
        RENDER[Renderer<br/>React + MUI · Profile Command Center]
    end

    MAIN <-->|IPC Bridge| RENDER
    MAIN --> GAPI[Google Drive API v3]
    MAIN --> FS[Local Filesystem]
    MAIN --> DB[(SQLite via better-sqlite3)]
    MAIN --> SIPS[macOS sips — HEIC→JPEG]

    style MAIN fill:#1a1a2e,stroke:#6366f1,color:#e2e8f0
    style RENDER fill:#1a1a2e,stroke:#10b981,color:#e2e8f0
```

### Change Detection

| File Type | Method | Re-download When |
|-----------|--------|-----------------|
| Regular files | **MD5 hash** (from Google API vs local) | Hash mismatch |
| HEIC → JPEG | **modifiedTime** comparison | Remote newer than local JPEG |
| Google Workspace | **Always re-export** | Every sync (no hash available) |
| Deleted local files | **exists check** | File missing → re-downloaded |

See [docs/architecture.md](docs/architecture.md) for the full architecture, sync engine flow diagrams, database schema, and IPC channel map.

## Project Structure

```
gdrive/
├── desktop/         # Electron main process (OAuth, Drive API, sync engine, scheduler)
├── frontend/        # React renderer (Profile Command Center, dialogs, themes)
├── shared/          # TypeScript types shared between processes
├── tests/           # Unit tests (vitest — 25 tests)
├── docs/            # Architecture, OAuth setup, phases, cost tracking
├── scripts/         # release.sh, prerelease-check.sh
├── resources/       # App icons (PNG + ICNS)
├── .github/         # CI/CD workflow (build + test + release)
└── dist/            # Build output (gitignored)
```

## Documentation

| Document | Description |
|----------|-------------|
| [Architecture](docs/architecture.md) | System design, sync engine flow, database schema, data storage |
| [OAuth Setup](docs/oauth-setup.md) | Auth flow diagrams, security model, developer + user setup |
| [Phases](docs/phases.md) | Implementation roadmap (all 5 phases complete) |
| [Cost Tracking](docs/cost-tracking.md) | Token usage and estimated costs per session |

## Testing

```bash
npm test                        # Run all 25 unit tests
npm run test:watch              # Watch mode
./scripts/prerelease-check.sh   # Full pre-release verification (5 steps)
```

| Category | Tests | What's Verified |
|----------|-------|-----------------|
| MD5 Hash | 2 | File and string hash computation |
| File Filters | 5 | Extension, multi-pattern, path glob, case |
| HEIC Detection | 4 | Extension matching, JPEG path generation |
| HEIC Conversion | 1 | macOS sips converts HEIC to JPEG |
| Workspace Types | 4 | Google Docs/Sheets detection, export map |
| Retry Logic | 3 | Transient retry, max attempts, non-retryable |
| Time Buckets | 2 | Shared-with-me grouping |
| Build Verification | 4 | TypeScript, Vite build, OAuth config |

## Development

```bash
npm run dev           # Vite dev server + Electron (hot reload)
npm run build         # Compile TypeScript + bundle renderer
npm run dist          # Build + package macOS .zip
npm test              # Run unit tests
```

| Script | Description |
|--------|-------------|
| `test` | Run unit tests (vitest) |
| `test:watch` | Tests in watch mode |
| `dev` | Vite + Electron concurrently |
| `build` | Production build (tsc + vite + embed credentials) |
| `dist` | Package macOS .zip |
| `dist:all` | Package all platforms |

### Data Directory

By default: `~/Library/Application Support/gsync/`. Configurable in Settings or pre-configure:

```bash
mkdir -p ~/.gsync
echo '{"dataDir":"/your/preferred/path"}' > ~/.gsync/config.json
```

### macOS Installation (unsigned)

```bash
xattr -rc /Applications/gsync.app
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop | Electron 33 |
| UI | React 18 + Material UI 5 |
| Build | Vite 6 + TypeScript 5 |
| APIs | googleapis (Google Drive API v3) |
| Database | SQLite via better-sqlite3 |
| Image | macOS sips (HEIC→JPEG) |
| Scheduling | node-cron |
| Testing | Vitest |
| Auth | System browser + local HTTP callback |
| Packaging | electron-builder |
| CI/CD | GitHub Actions (test → build → release) |

## License

MIT
