# Architecture

## High-Level Overview

GDrive Sync is an Electron desktop application with a React frontend and Node.js backend running in the same process. The app communicates with Google Drive via the official Google APIs.

```mermaid
graph TB
    subgraph Electron App
        subgraph Main Process
            IPC[IPC Handlers]
            AUTH[Google Auth Service]
            DRIVE[Google Drive Service]
            SYNC[Sync Engine]
            LFS[Local FS Service]
            DB[(SQLite Database)]
            SCHED[Scheduler]
        end

        subgraph Renderer Process
            REACT[React App]
            MUI[MUI Components]
            THEME[Theme System]
            STATE[App State]
        end

        REACT <-->|contextBridge IPC| IPC
        IPC --> AUTH
        IPC --> DRIVE
        IPC --> SYNC
        IPC --> LFS
        IPC --> DB
        SCHED --> SYNC
    end

    AUTH <-->|OAuth2| GOOGLE[Google OAuth]
    DRIVE <-->|Drive API v3| GDRIVE[Google Drive]
    SYNC --> DRIVE
    SYNC --> LFS
    SYNC --> DB
    LFS <-->|fs module| LOCAL[Local Filesystem]
    DB <-->|better-sqlite3| DBFILE[gdrive-sync.db]

    style Main Process fill:#1a1a2e,stroke:#6366f1,color:#e2e8f0
    style Renderer Process fill:#1a1a2e,stroke:#10b981,color:#e2e8f0
```

## IPC Communication

The renderer process cannot access Node.js APIs directly (security). All communication goes through typed IPC channels via Electron's `contextBridge`.

```mermaid
sequenceDiagram
    participant R as Renderer (React)
    participant P as Preload Script
    participant M as Main Process
    participant G as Google APIs

    R->>P: window.api.sync.startSync(profileId)
    P->>M: ipcRenderer.invoke('sync:startSync', profileId)
    M->>M: SyncEngine.startSync()
    M->>G: Drive API (list + download/upload)
    M-->>R: sync:progress events
    Note over R: Live progress updates
```

### IPC Channel Map

| Channel | Direction | Description |
|---------|-----------|-------------|
| `auth:login` | Renderer -> Main | Triggers OAuth flow in a modal window |
| `auth:logout` | Renderer -> Main | Revokes tokens and clears database |
| `auth:getUser` | Renderer -> Main | Returns cached user info |
| `auth:isLoggedIn` | Renderer -> Main | Checks if valid tokens exist |
| `drive:listDrives` | Renderer -> Main | Lists My Drive + shared drives |
| `drive:listFiles` | Renderer -> Main | Lists files in a drive/folder |
| `localFs:listDirectory` | Renderer -> Main | Lists local directory contents |
| `localFs:getHomeDir` | Renderer -> Main | Returns user's home directory path |
| `localFs:selectDirectory` | Renderer -> Main | Opens native folder picker dialog |
| `sync:getProfiles` | Renderer -> Main | List all sync profiles |
| `sync:createProfile` | Renderer -> Main | Create a new sync profile |
| `sync:updateProfile` | Renderer -> Main | Update an existing profile |
| `sync:deleteProfile` | Renderer -> Main | Delete a sync profile |
| `sync:startSync` | Renderer -> Main | Begin/resume sync for a profile |
| `sync:cancelSync` | Renderer -> Main | Pause an active sync (partial files saved) |
| `sync:getSessions` | Renderer -> Main | Get sync history sessions |
| `sync:progress` | Main -> Renderer | Real-time sync progress updates |
| `backup:backup` | Renderer -> Main | Upload database to Google Drive |
| `backup:restore` | Renderer -> Main | Download and replace local database |
| `backup:syncMerge` | Renderer -> Main | Merge remote DB into local (last-write-wins) |
| `backup:getInfo` | Renderer -> Main | Get last backup timestamp |
| `app:getVersion` | Renderer -> Main | Get app version string |
| `app:checkForUpdates` | Renderer -> Main | Trigger auto-update check |
| `app:getPlatform` | Renderer -> Main | Get OS platform string |
| `app:getSetting` | Renderer -> Main | Read app setting from database |
| `app:setSetting` | Renderer -> Main | Write app setting to database |

## Sync Engine Flow

```mermaid
flowchart TD
    START[Start Sync] --> VALIDATE[Validate folders exist]
    VALIDATE -->|Local missing + download| CREATE[Auto-create local folder]
    VALIDATE -->|Folder missing + upload/bidir| FAIL[Fail + deactivate profile]
    VALIDATE -->|OK| DIR{Direction?}
    CREATE --> DIR

    DIR -->|Download| DL[List remote files recursively]
    DIR -->|Upload| UL[List local files recursively]
    DIR -->|Bidirectional| BI[List both sides]

    DL --> DL_TYPE{File type?}

    DL_TYPE -->|Regular file| DL_CHECK{Local file exists?}
    DL_CHECK -->|No| DL_DO[Download file]
    DL_CHECK -->|Yes| DL_HASH{MD5 match?}
    DL_HASH -->|Yes| DL_SKIP[Skip — unchanged]
    DL_HASH -->|No| DL_DO

    DL_TYPE -->|HEIC with convert enabled| HEIC_CHECK{Local .jpeg exists?}
    HEIC_CHECK -->|No| DL_HEIC[Download + convert to JPEG]
    HEIC_CHECK -->|Yes| HEIC_TIME{Remote newer than local?}
    HEIC_TIME -->|Yes| DL_HEIC
    HEIC_TIME -->|No| DL_SKIP

    DL_TYPE -->|Google Workspace| DL_EXPORT[Export to DOCX/XLSX/PPTX]

    UL --> UL_CHECK{Remote file exists?}
    UL_CHECK -->|No| UL_DO[Upload file]
    UL_CHECK -->|Yes| UL_HASH{MD5 match?}
    UL_HASH -->|Yes| UL_SKIP[Skip]
    UL_HASH -->|No| UL_DO

    BI --> BI_COMPARE{File exists on both?}
    BI_COMPARE -->|Remote only| DL_DO
    BI_COMPARE -->|Local only| UL_DO
    BI_COMPARE -->|Both| BI_HASH{MD5 match?}
    BI_HASH -->|Yes| BI_SKIP[Skip]
    BI_HASH -->|No| BI_TIME{Compare timestamps}
    BI_TIME -->|Remote newer| DL_DO
    BI_TIME -->|Local newer| UL_DO

    DL_DO --> RETRY[Retry with backoff on failure]
    DL_HEIC --> RETRY
    DL_EXPORT --> RETRY
    UL_DO --> RETRY
    RETRY --> LOG[Log to sync_file_log]
    DL_SKIP --> LOG
    UL_SKIP --> LOG
    BI_SKIP --> LOG
    LOG --> PROGRESS[Send progress event to renderer]
```

### Change Detection Strategy

| File Type | Comparison Method | Re-download When |
|-----------|------------------|-----------------|
| Regular files (PDF, JPG, etc.) | **MD5 hash** — Google provides `md5Checksum` in metadata, compared with locally computed hash | Hash mismatch (file changed on either side) |
| HEIC with conversion enabled | **modifiedTime** — compares remote HEIC timestamp vs local JPEG mtime | Remote HEIC newer than local JPEG |
| Google Workspace (Docs/Sheets/Slides) | **Always re-export** — Google doesn't provide MD5 for native formats | Every sync (exported to DOCX/XLSX/PPTX) |
| Deleted local files | **exists check** — `fs.existsSync()` returns false | File missing locally → re-downloaded |
| Partial downloads (.partial files) | **Resume via HTTP Range header** — continues from last byte | Paused transfer resumed |

### Safe Sync Mode

The sync engine **never deletes files** on either side. It only adds new files and updates existing ones.

- If a file is deleted locally → next sync re-downloads it from Drive
- If a file is deleted on Drive → local copy remains untouched
- No conflict resolution needed — newer version wins (by timestamp or hash)

### Google Workspace Export Map

| Google Native Type | Exported Format | Extension |
|-------------------|----------------|-----------|
| Google Docs | Word | .docx |
| Google Sheets | Excel | .xlsx |
| Google Slides | PowerPoint | .pptx |
| Google Drawings | PNG | .png |
| Google Jamboard | PDF | .pdf |
| Google Apps Script | JSON | .json |
| Google Forms | Not exported | Skipped |
| Google Sites | Not exported | Skipped |

### Retry Logic

Transient errors are retried up to 3 times with exponential backoff:
- Attempt 1: wait ~1s
- Attempt 2: wait ~2s
- Attempt 3: wait ~4s

Retryable errors: `ECONNRESET`, `ETIMEDOUT`, `ENOTFOUND`, HTTP 429 (rate limit), 500, 503.

## Database Schema

```mermaid
erDiagram
    auth_tokens {
        int id PK
        text access_token
        text refresh_token
        text token_type
        int expiry_date
        text scope
    }

    user_info {
        int id PK
        text email
        text name
        text picture
    }

    sync_profiles {
        int id PK
        text name
        text drive_id
        text drive_name
        text drive_type
        text drive_folder_id
        text drive_folder_path
        text local_path
        text sync_direction
        int use_source_folder_name
        int convert_heic_to_jpeg
        text file_filter
        text schedule
        int is_active
        text last_sync_at
        text created_at
        text updated_at
    }

    app_settings {
        text key PK
        text value
        text updated_at
    }

    sync_history {
        int id PK
        int profile_id FK
        text status
        text started_at
        text completed_at
        int total_files
        int files_synced
        int files_skipped
        int files_failed
        int bytes_transferred
        int total_bytes
        text current_file
        text error_message
    }

    sync_file_log {
        int id PK
        int history_id FK
        text file_name
        text file_path
        text direction
        text status
        int file_size
        int bytes_transferred
        text local_hash
        text remote_hash
        text error_message
    }

    sync_profiles ||--o{ sync_history : "has"
    sync_history ||--o{ sync_file_log : "contains"
```

## Folder Structure

```
gdrive/
├── desktop/              # Electron main process (TypeScript)
│   ├── index.ts          # App entry, window creation, menu, auto-updater
│   ├── preload.ts        # contextBridge API exposure
│   ├── ipc-handlers.ts   # IPC channel registration (all try-catch wrapped)
│   └── services/
│       ├── google-auth.ts     # OAuth2 via system browser + local HTTP callback
│       ├── google-drive.ts    # Drive API: list, download (resumable), upload, export
│       ├── sync-engine.ts     # Sync: download/upload/bidir, retry, pause/resume, HEIC convert
│       ├── scheduler.ts       # node-cron auto-sync scheduler
│       ├── db-backup.ts       # DB backup/restore/merge to Google Drive
│       ├── embedded-config.ts # Load build-time OAuth + GH token config
│       ├── local-fs.ts        # Local filesystem operations
│       └── database.ts        # SQLite init, CRUD, settings, migrations
├── frontend/             # React renderer (TypeScript + Vite)
│   ├── index.html
│   ├── main.tsx          # Entry: AppThemeProvider + AppSettingsProvider
│   ├── App.tsx           # Auth routing with ErrorBoundary
│   ├── context/
│   │   └── AppSettingsContext.tsx  # Customizable app title
│   ├── pages/
│   │   ├── Login.tsx     # First-run setup + system browser OAuth
│   │   ├── Dashboard.tsx # Profile Command Center (master-detail layout)
│   │   ├── History.tsx   # Filterable, sortable history with bulk delete
│   │   ├── Settings.tsx  # Data dir, OAuth creds, backup, profiles, title, theme
│   │   └── About.tsx     # Feature cards, tech stack, update checker
│   ├── components/
│   │   ├── Layout/Sidebar.tsx          # Collapsible sidebar (4 nav items)
│   │   ├── StatsBar/StatsBar.tsx       # Aggregate sync metrics
│   │   ├── ProfileList/ProfileList.tsx # Master column with status indicators
│   │   ├── ProfileDetail/ProfileDetail.tsx  # Detail panel with config + activity
│   │   ├── EmptyState/EmptyState.tsx   # Onboarding for 0 profiles
│   │   ├── DriveTree/DriveTree.tsx     # Drive explorer (used in dialogs)
│   │   ├── LocalTree/LocalTree.tsx     # Local explorer (used in dialogs)
│   │   ├── CreateProfileDialog/        # Profile creation with embedded Drive picker
│   │   ├── EditProfileDialog/          # Profile editing with recursive folder picker
│   │   ├── ErrorBoundary/              # React error boundary
│   │   ├── StatusMessage/              # Classified error display
│   │   └── WelcomeSplash/              # First-run welcome dialog
│   └── theme/
│       ├── index.ts         # Re-exports
│       ├── themes.ts        # 5 themes (Midnight, GitHub Dark, Ocean, Sunset, Light)
│       └── ThemeContext.tsx  # Theme provider + localStorage persistence
├── shared/types.ts       # All TypeScript types + IPC API interface
├── resources/
│   ├── icon.png          # App icon (1024px)
│   └── icon.icns         # macOS icon
├── docs/                 # Architecture, OAuth setup, phases, cost tracking
├── scripts/
│   ├── release.sh        # Local build + GitHub Release upload
│   └── verify-build.sh
├── dist/                 # Build output (gitignored)
├── release/              # Packaged app (gitignored)
└── .github/workflows/    # CI/CD (GitHub Actions)
```

## Technology Choices

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| Desktop shell | Electron 33 | Cross-platform, mature ecosystem, native OS integration |
| UI framework | React 18 + MUI 5 | Component library, consistent design, dark theme |
| Build tool | Vite 6 | Fast HMR for renderer, instant dev server |
| Main process | TypeScript + tsc | Type safety, compiles to CommonJS for Node.js |
| Google APIs | googleapis npm | Official client library, OAuth2 built-in |
| Database | better-sqlite3 | Synchronous, fast, single-file, no server needed |
| Image conversion | sharp | HEIC to JPEG conversion for synced photos |
| Scheduling | node-cron | Standard cron expression support |
| Packaging | electron-builder | ZIP output for macOS, auto-update support |
| Auto-update | GitHub API + in-app download | Version check + download with progress |
| Themes | Custom MUI ThemeProvider | 5 themes with localStorage persistence |
| Auth | System browser + local HTTP server | Standard desktop OAuth (VS Code, gcloud pattern) |

## Data Storage

### Database Location

The app stores its SQLite database in a configurable data directory:

| Platform | Default Path |
|----------|-------------|
| macOS | `~/Library/Application Support/gsync/` |
| Windows | `%APPDATA%/gsync/` |
| Linux | `~/.config/gsync/` |

The config file `~/.gsync/config.json` overrides the default:

```json
{
  "dataDir": "/Users/yourname/your/preferred/path"
}
```

### Database Files

| File | Purpose | Safe to delete? |
|------|---------|----------------|
| `gdrive-sync.db` | Main database — profiles, tokens, settings, sync history | No — all data is here |
| `gdrive-sync.db-wal` | Write-ahead log — buffered writes for performance | No while app is running. Merges into .db on clean shutdown |
| `gdrive-sync.db-shm` | Shared memory — coordinates WAL access | No while app is running. Auto-recreated on next launch |

### Pre-configure on New Machine

Before first launch, set the data directory so the app creates its database in the right place:

```bash
mkdir -p ~/.gsync
echo '{"dataDir":"/your/preferred/path"}' > ~/.gsync/config.json
```

Then restore a database backup (from Settings > Database Backup > Restore from Drive) to recover all profiles, history, and settings.

### Backup & Restore

The database can be backed up to Google Drive and restored on any machine:
- **Backup**: uploads `gdrive-sync-backup.db` to `GDrive Sync Backups/` folder on Drive
- **Restore**: downloads backup, creates safety copy (`.pre_restore_*`), replaces local DB
- **Sync-Merge**: merges remote and local DBs using last-write-wins by `updated_at` timestamp
