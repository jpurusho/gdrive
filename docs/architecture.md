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
    START[Start Sync] --> DIR{Direction?}
    DIR -->|Download| DL[List remote files recursively]
    DIR -->|Upload| UL[List local files recursively]
    DIR -->|Bidirectional| BI[List both sides]

    DL --> DL_CHECK{Local file exists?}
    DL_CHECK -->|No| DL_DO[Download file]
    DL_CHECK -->|Yes| DL_HASH{MD5 match?}
    DL_HASH -->|Yes| DL_SKIP[Skip]
    DL_HASH -->|No| DL_DO

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

    DL_DO --> LOG[Log to sync_file_log]
    UL_DO --> LOG
    DL_SKIP --> LOG
    UL_SKIP --> LOG
    BI_SKIP --> LOG
    LOG --> PROGRESS[Send progress event]
```

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
        text schedule
        int is_active
        text last_sync_at
    }

    sync_history {
        int id PK
        int profile_id FK
        text status
        text started_at
        text completed_at
        int files_synced
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
│   ├── index.ts          # App entry, window creation
│   ├── preload.ts        # contextBridge API exposure
│   ├── auth-preload.ts   # WebAuthn disabler for auth window
│   ├── ipc-handlers.ts   # IPC channel registration
│   └── services/
│       ├── google-auth.ts   # OAuth2 flow & token management
│       ├── google-drive.ts  # Google Drive API wrapper (list/download/upload)
│       ├── sync-engine.ts   # Core sync logic (download/upload/bidirectional)
│       ├── scheduler.ts     # Cron-based auto-sync scheduler
│       ├── local-fs.ts      # Local filesystem operations
│       └── database.ts      # SQLite init & CRUD helpers
├── frontend/             # React renderer (TypeScript + Vite)
│   ├── index.html        # HTML shell
│   ├── main.tsx          # React entry point
│   ├── App.tsx           # Root component (auth routing)
│   ├── pages/
│   │   ├── Login.tsx     # OAuth login screen
│   │   ├── Dashboard.tsx # Main dashboard with file browsers + sync cards
│   │   ├── History.tsx   # Sync activity history table
│   │   └── Settings.tsx  # Theme selector + version info + updates
│   ├── components/
│   │   ├── Layout/Sidebar.tsx
│   │   ├── DriveTree/DriveTree.tsx
│   │   ├── LocalTree/LocalTree.tsx
│   │   ├── SyncCards/SyncCards.tsx
│   │   └── CreateProfileDialog/CreateProfileDialog.tsx
│   └── theme/
│       ├── index.ts         # Re-exports
│       ├── themes.ts        # 6 theme definitions
│       └── ThemeContext.tsx  # Theme provider + persistence
├── shared/               # Shared TypeScript types
│   └── types.ts          # IPC API types, data models
├── docs/                 # Architecture & setup documentation
├── scripts/              # Utility & test scripts
├── dist/                 # Build output (gitignored)
├── release/              # Packaged app (gitignored)
└── .github/workflows/    # CI/CD
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
| Scheduling | node-cron | Standard cron expression support |
| Packaging | electron-builder | DMG/NSIS/AppImage output, auto-update support |
| Auto-update | electron-updater | GitHub Releases integration |
| Themes | Custom MUI ThemeProvider | 6 themes with localStorage persistence |
