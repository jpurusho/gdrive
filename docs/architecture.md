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
            LFS[Local FS Service]
            DB[(SQLite Database)]
            SCHED[Scheduler]
        end

        subgraph Renderer Process
            REACT[React App]
            MUI[MUI Components]
            STATE[App State]
        end

        REACT <-->|contextBridge IPC| IPC
        IPC --> AUTH
        IPC --> DRIVE
        IPC --> LFS
        IPC --> DB
        IPC --> SCHED
    end

    AUTH <-->|OAuth2| GOOGLE[Google OAuth]
    DRIVE <-->|Drive API v3| GDRIVE[Google Drive]
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

    R->>P: window.api.drive.listDrives()
    P->>M: ipcRenderer.invoke('drive:listDrives')
    M->>G: googleapis.drive.drives.list()
    G-->>M: Drive list response
    M-->>P: DriveInfo[]
    P-->>R: Promise<DriveInfo[]>
```

### IPC Channel Map

| Channel | Direction | Description |
|---------|-----------|-------------|
| `auth:login` | Renderer → Main | Triggers OAuth flow in a modal window |
| `auth:logout` | Renderer → Main | Revokes tokens and clears database |
| `auth:getUser` | Renderer → Main | Returns cached user info |
| `auth:isLoggedIn` | Renderer → Main | Checks if valid tokens exist |
| `drive:listDrives` | Renderer → Main | Lists My Drive + shared drives |
| `drive:listFiles` | Renderer → Main | Lists files in a drive/folder |
| `localFs:listDirectory` | Renderer → Main | Lists local directory contents |
| `localFs:getHomeDir` | Renderer → Main | Returns user's home directory path |
| `localFs:selectDirectory` | Renderer → Main | Opens native folder picker dialog |
| `sync:*` | Renderer → Main | Sync profile CRUD and execution |
| `sync:progress` | Main → Renderer | Real-time sync progress updates |

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
        text local_path
        text sync_direction
        text schedule
        int is_active
    }

    sync_history {
        int id PK
        int profile_id FK
        text status
        text started_at
        text completed_at
        int files_synced
        int bytes_transferred
    }

    sync_file_log {
        int id PK
        int history_id FK
        text file_name
        text direction
        text status
        int file_size
        int bytes_transferred
        text local_hash
        text remote_hash
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
│   ├── ipc-handlers.ts   # IPC channel registration
│   └── services/
│       ├── google-auth.ts   # OAuth2 flow & token management
│       ├── google-drive.ts  # Google Drive API wrapper
│       ├── local-fs.ts      # Local filesystem operations
│       └── database.ts      # SQLite init & CRUD helpers
├── frontend/             # React renderer (TypeScript + Vite)
│   ├── index.html        # HTML shell
│   ├── main.tsx          # React entry point
│   ├── App.tsx           # Root component (auth routing)
│   ├── pages/
│   │   ├── Login.tsx     # OAuth login screen
│   │   └── Dashboard.tsx # Main dashboard
│   ├── components/
│   │   ├── Layout/Sidebar.tsx
│   │   ├── DriveTree/DriveTree.tsx
│   │   ├── LocalTree/LocalTree.tsx
│   │   └── SyncCards/SyncCards.tsx
│   └── theme/index.ts   # MUI dark theme
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
| Packaging | electron-builder | DMG/NSIS/AppImage output, auto-update support |
| Auto-update | electron-updater | GitHub Releases integration |
