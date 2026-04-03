// ─── Auth ────────────────────────────────────────────────────────────────────

export interface UserInfo {
  email: string;
  name: string;
  picture: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token?: string;
  token_type?: string;
  expiry_date?: number;
  scope?: string;
}

// ─── Google Drive ────────────────────────────────────────────────────────────

export type DriveType = 'my_drive' | 'shared_drive';

export interface DriveInfo {
  id: string;
  name: string;
  type: DriveType;
  permission: DrivePermission;
  colorRgb?: string;
}

export type DrivePermission = 'owner' | 'writer' | 'reader';

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: number;
  modifiedTime?: string;
  parents?: string[];
  shared?: boolean;
  isFolder: boolean;
  md5Checksum?: string;
  capabilities?: {
    canEdit: boolean;
    canDelete: boolean;
    canDownload: boolean;
  };
}

// ─── Local Filesystem ────────────────────────────────────────────────────────

export interface LocalFile {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modifiedTime: string;
  isHidden: boolean;
}

// ─── Sync ────────────────────────────────────────────────────────────────────

export type SyncDirection = 'download' | 'upload' | 'bidirectional';
export type SyncStatus = 'idle' | 'in_progress' | 'paused' | 'completed' | 'failed' | 'cancelled';

export interface SyncProfile {
  id: number;
  name: string;
  driveId: string;
  driveName: string;
  driveType: DriveType;
  driveFolderId: string;
  driveFolderPath: string;
  localPath: string;
  syncDirection: SyncDirection;
  fileFilter?: string;
  schedule?: string;
  isActive: boolean;
  lastSyncAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SyncSession {
  id: number;
  profileId: number;
  profileName: string;
  status: SyncStatus;
  startedAt: string;
  completedAt?: string;
  totalFiles: number;
  filesSynced: number;
  filesSkipped: number;
  filesFailed: number;
  bytesTransferred: number;
  totalBytes: number;
  currentFile?: string;
  errorMessage?: string;
}

export interface SyncFileEntry {
  id: number;
  sessionId: number;
  fileName: string;
  filePath: string;
  direction: 'download' | 'upload';
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  fileSize: number;
  bytesTransferred: number;
  localHash?: string;
  remoteHash?: string;
  errorMessage?: string;
}

// ─── DB Backup ──────────────────────────────────────────────────────────────

export interface BackupResult {
  success: boolean;
  action: 'created' | 'updated';
  fileId: string;
  size: number;
  timestamp: string;
  error?: string;
}

export interface RestoreResult {
  success: boolean;
  size: number;
  profilesRestored: number;
  historyRestored: number;
  error?: string;
}

export interface MergeResult {
  success: boolean;
  profilesAdded: number;
  profilesUpdated: number;
  historyAdded: number;
  fileLogAdded: number;
  totalChanges: number;
  error?: string;
}

export interface BackupInfo {
  lastBackup: string | null;
  folderId: string | null;
}

// ─── IPC API ─────────────────────────────────────────────────────────────────

export interface ElectronAPI {
  auth: {
    hasCredentials: () => Promise<boolean>;
    setCredentials: (clientId: string, clientSecret: string) => Promise<void>;
    login: () => Promise<UserInfo>;
    logout: () => Promise<void>;
    getUser: () => Promise<UserInfo | null>;
    isLoggedIn: () => Promise<boolean>;
  };
  drive: {
    listDrives: () => Promise<DriveInfo[]>;
    listFiles: (driveId: string, folderId: string) => Promise<DriveFile[]>;
  };
  localFs: {
    listDirectory: (dirPath: string) => Promise<LocalFile[]>;
    getHomeDir: () => Promise<string>;
    selectDirectory: () => Promise<string | null>;
  };
  sync: {
    getProfiles: () => Promise<SyncProfile[]>;
    createProfile: (profile: Omit<SyncProfile, 'id' | 'createdAt' | 'updatedAt'>) => Promise<SyncProfile>;
    updateProfile: (id: number, updates: Partial<SyncProfile>) => Promise<SyncProfile>;
    deleteProfile: (id: number) => Promise<void>;
    startSync: (profileId: number) => Promise<void>;
    cancelSync: (sessionId: number) => Promise<void>;
    getSessions: (profileId?: number) => Promise<SyncSession[]>;
    onSyncProgress: (callback: (session: SyncSession) => void) => () => void;
  };
  backup: {
    backup: () => Promise<BackupResult>;
    restore: () => Promise<RestoreResult>;
    syncMerge: () => Promise<MergeResult>;
    getInfo: () => Promise<BackupInfo>;
  };
  app: {
    getDataDir: () => Promise<string>;
    setDataDir: (dir: string) => Promise<{ success: boolean; message: string }>;
    getVersion: () => Promise<string>;
    checkForUpdates: () => Promise<string | null>;
    getPlatform: () => Promise<string>;
    getSetting: (key: string) => Promise<string | null>;
    setSetting: (key: string, value: string) => Promise<void>;
  };
}

declare global {
  interface Window {
    api: ElectronAPI;
  }
}
