import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import Database from 'better-sqlite3';
import { app } from 'electron';
import { GoogleDriveService } from './google-drive';
import { getDb, getDataDir } from './database';

const BACKUP_FILENAME = 'gdrive-sync-backup.db';
const BACKUP_FOLDER_NAME = 'GDrive Sync Backups';

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

/** Find or create the backup folder on Google Drive */
async function ensureBackupFolder(driveService: GoogleDriveService): Promise<string> {
  const db = getDb();

  // 1. Check stored folder ID
  const row = db.prepare("SELECT value FROM app_settings WHERE key = 'backup_folder_id'").get() as any;
  if (row?.value) {
    // Verify the stored folder still exists on Drive
    try {
      await driveService.listFiles('root', row.value);
      return row.value;
    } catch {
      // Stored folder is gone — fall through to search/create
      console.log('[Backup] Stored backup folder no longer accessible, searching...');
    }
  }

  // 2. Search Drive for existing folder by name (prevents duplicates)
  const existing = await driveService.findFile('root', BACKUP_FOLDER_NAME, 'root');
  if (existing?.id) {
    console.log('[Backup] Found existing backup folder:', existing.id);
    db.prepare("INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES ('backup_folder_id', ?, datetime('now'))").run(existing.id);
    return existing.id;
  }

  // 3. Create new folder only if none found
  console.log('[Backup] Creating new backup folder');
  const folderId = await driveService.createFolder(BACKUP_FOLDER_NAME, 'root', 'root');
  db.prepare("INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES ('backup_folder_id', ?, datetime('now'))").run(folderId);

  return folderId;
}

/** Backup the local database to Google Drive */
export async function backupDatabase(driveService: GoogleDriveService): Promise<BackupResult> {
  const dbPath = path.join(getDataDir(), 'gdrive-sync.db');

  if (!fs.existsSync(dbPath)) {
    return { success: false, action: 'created', fileId: '', size: 0, timestamp: '', error: 'Database not found' };
  }

  // Checkpoint WAL to make sure all data is in the main file
  const db = getDb();
  db.pragma('wal_checkpoint(TRUNCATE)');

  const folderId = await ensureBackupFolder(driveService);

  // Check if backup already exists
  const existing = await driveService.findFile(folderId, BACKUP_FILENAME, 'root');

  const fileId = await driveService.uploadFile(
    dbPath,
    BACKUP_FILENAME,
    folderId,
    'root',
    existing?.id,
  );

  const stat = fs.statSync(dbPath);

  return {
    success: true,
    action: existing ? 'updated' : 'created',
    fileId,
    size: stat.size,
    timestamp: new Date().toISOString(),
  };
}

/** Restore database from Google Drive (full replace with safety backup) */
export async function restoreDatabase(driveService: GoogleDriveService): Promise<RestoreResult> {
  const dbPath = path.join(getDataDir(), 'gdrive-sync.db');
  const folderId = await ensureBackupFolder(driveService);

  const remote = await driveService.findFile(folderId, BACKUP_FILENAME, 'root');
  if (!remote) {
    return { success: false, size: 0, profilesRestored: 0, historyRestored: 0, error: 'No backup found on Google Drive' };
  }

  // Create safety backup of current local DB
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const safetyPath = `${dbPath}.pre_restore_${timestamp}`;
  if (fs.existsSync(dbPath)) {
    // Close WAL first
    const db = getDb();
    db.pragma('wal_checkpoint(TRUNCATE)');
    fs.copyFileSync(dbPath, safetyPath);
  }

  // Download to temp file first
  const tmpPath = path.join(os.tmpdir(), `gdrive-sync-restore-${Date.now()}.db`);
  await driveService.downloadFile(remote.id, remote.mimeType, tmpPath);

  // Validate the downloaded DB
  let profilesCount = 0;
  let historyCount = 0;
  try {
    const tmpDb = new Database(tmpPath, { readonly: true });
    profilesCount = (tmpDb.prepare('SELECT COUNT(*) as c FROM sync_profiles').get() as any)?.c || 0;
    historyCount = (tmpDb.prepare('SELECT COUNT(*) as c FROM sync_history').get() as any)?.c || 0;
    tmpDb.close();
  } catch (err: any) {
    fs.unlinkSync(tmpPath);
    return { success: false, size: 0, profilesRestored: 0, historyRestored: 0, error: `Invalid backup DB: ${err.message}` };
  }

  // Replace local DB (app will need restart to pick up the new DB)
  const db = getDb();
  db.pragma('wal_checkpoint(TRUNCATE)');
  db.close();

  fs.copyFileSync(tmpPath, dbPath);
  fs.unlinkSync(tmpPath);

  const stat = fs.statSync(dbPath);

  return {
    success: true,
    size: stat.size,
    profilesRestored: profilesCount,
    historyRestored: historyCount,
  };
}

/** Merge remote DB into local DB (last-write-wins by updated_at), then upload merged result */
export async function syncMergeDatabase(driveService: GoogleDriveService): Promise<MergeResult> {
  const dbPath = path.join(getDataDir(), 'gdrive-sync.db');
  const folderId = await ensureBackupFolder(driveService);

  const remote = await driveService.findFile(folderId, BACKUP_FILENAME, 'root');

  // If no remote backup exists, just upload local
  if (!remote) {
    await backupDatabase(driveService);
    return { success: true, profilesAdded: 0, profilesUpdated: 0, historyAdded: 0, fileLogAdded: 0, totalChanges: 0 };
  }

  // Download remote to temp file
  const tmpPath = path.join(os.tmpdir(), `gdrive-sync-merge-${Date.now()}.db`);
  await driveService.downloadFile(remote.id, remote.mimeType, tmpPath);

  // Create safety backup
  const db = getDb();
  db.pragma('wal_checkpoint(TRUNCATE)');
  const safetyPath = `${dbPath}.pre_merge`;
  fs.copyFileSync(dbPath, safetyPath);

  let result: MergeResult;
  try {
    result = mergeRemoteIntoLocal(db, tmpPath);
  } catch (err: any) {
    // Rollback on failure
    fs.copyFileSync(safetyPath, dbPath);
    fs.unlinkSync(tmpPath);
    return { success: false, profilesAdded: 0, profilesUpdated: 0, historyAdded: 0, fileLogAdded: 0, totalChanges: 0, error: err.message };
  }

  fs.unlinkSync(tmpPath);

  // Upload merged DB back to Drive
  await backupDatabase(driveService);

  return result;
}

function mergeRemoteIntoLocal(localDb: Database.Database, remotePath: string): MergeResult {
  let remoteDb: Database.Database;
  try {
    remoteDb = new Database(remotePath, { readonly: true });
  } catch (err: any) {
    throw new Error(`Cannot open remote DB: ${err.message}`);
  }

  let profilesAdded = 0;
  let profilesUpdated = 0;
  let historyAdded = 0;
  let fileLogAdded = 0;

  try {
    // ── Merge sync_profiles (last-write-wins by updated_at) ──
    const remoteProfiles = remoteDb.prepare('SELECT * FROM sync_profiles').all() as any[];

    for (const rp of remoteProfiles) {
      const local = localDb.prepare('SELECT * FROM sync_profiles WHERE id = ?').get(rp.id) as any;

      if (!local) {
        // Insert new profile from remote
        localDb.prepare(`
          INSERT INTO sync_profiles (id, name, drive_id, drive_name, drive_type, drive_folder_id, drive_folder_path,
            local_path, sync_direction, schedule, is_active, last_sync_at, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          rp.id, rp.name, rp.drive_id, rp.drive_name, rp.drive_type, rp.drive_folder_id, rp.drive_folder_path,
          rp.local_path, rp.sync_direction, rp.schedule, rp.is_active, rp.last_sync_at, rp.created_at, rp.updated_at,
        );
        profilesAdded++;
      } else if (rp.updated_at && local.updated_at && rp.updated_at > local.updated_at) {
        // Remote is newer — update local
        localDb.prepare(`
          UPDATE sync_profiles SET name = ?, drive_id = ?, drive_name = ?, drive_type = ?, drive_folder_id = ?,
            drive_folder_path = ?, local_path = ?, sync_direction = ?, schedule = ?, is_active = ?,
            last_sync_at = ?, updated_at = ?
          WHERE id = ?
        `).run(
          rp.name, rp.drive_id, rp.drive_name, rp.drive_type, rp.drive_folder_id, rp.drive_folder_path,
          rp.local_path, rp.sync_direction, rp.schedule, rp.is_active, rp.last_sync_at, rp.updated_at, rp.id,
        );
        profilesUpdated++;
      }
    }

    // ── Merge sync_history (append-only, deduplicate by id) ──
    const remoteHistory = remoteDb.prepare('SELECT * FROM sync_history').all() as any[];

    for (const rh of remoteHistory) {
      const exists = localDb.prepare('SELECT id FROM sync_history WHERE id = ?').get(rh.id);
      if (!exists) {
        localDb.prepare(`
          INSERT INTO sync_history (id, profile_id, status, started_at, completed_at, files_synced, files_failed,
            bytes_transferred, total_bytes, current_file, error_message)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          rh.id, rh.profile_id, rh.status, rh.started_at, rh.completed_at, rh.files_synced, rh.files_failed,
          rh.bytes_transferred, rh.total_bytes, rh.current_file, rh.error_message,
        );
        historyAdded++;
      }
    }

    // ── Merge sync_file_log (append-only, deduplicate by id) ──
    const remoteFileLog = remoteDb.prepare('SELECT * FROM sync_file_log').all() as any[];

    for (const rf of remoteFileLog) {
      const exists = localDb.prepare('SELECT id FROM sync_file_log WHERE id = ?').get(rf.id);
      if (!exists) {
        localDb.prepare(`
          INSERT INTO sync_file_log (id, history_id, file_name, file_path, direction, status, file_size,
            bytes_transferred, local_hash, remote_hash, error_message, started_at, completed_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          rf.id, rf.history_id, rf.file_name, rf.file_path, rf.direction, rf.status, rf.file_size,
          rf.bytes_transferred, rf.local_hash, rf.remote_hash, rf.error_message, rf.started_at, rf.completed_at,
        );
        fileLogAdded++;
      }
    }
  } finally {
    remoteDb.close();
  }

  const totalChanges = profilesAdded + profilesUpdated + historyAdded + fileLogAdded;
  return { success: true, profilesAdded, profilesUpdated, historyAdded, fileLogAdded, totalChanges };
}

/** Get info about the last backup */
export function getBackupInfo(): { lastBackup: string | null; folderId: string | null } {
  const db = getDb();
  const folder = db.prepare("SELECT value FROM app_settings WHERE key = 'backup_folder_id'").get() as any;
  const last = db.prepare("SELECT value FROM app_settings WHERE key = 'last_backup_at'").get() as any;
  return { lastBackup: last?.value || null, folderId: folder?.value || null };
}

/** Record last backup timestamp */
export function recordBackup(): void {
  const db = getDb();
  db.prepare("INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES ('last_backup_at', ?, datetime('now'))").run(new Date().toISOString());
}
