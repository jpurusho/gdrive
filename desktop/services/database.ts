import Database from 'better-sqlite3';
import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import type { AuthTokens, UserInfo, SyncProfile } from '../../shared/types';

let db: Database.Database;

function getDbPath(): string {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'gdrive-sync.db');
}

export function initDatabase(): void {
  const dbPath = getDbPath();
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS auth_tokens (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      access_token TEXT NOT NULL,
      refresh_token TEXT,
      token_type TEXT,
      expiry_date INTEGER,
      scope TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS user_info (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      email TEXT NOT NULL,
      name TEXT,
      picture TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sync_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      drive_id TEXT NOT NULL,
      drive_name TEXT NOT NULL,
      drive_type TEXT NOT NULL,
      drive_folder_id TEXT NOT NULL DEFAULT 'root',
      drive_folder_path TEXT NOT NULL DEFAULT '/',
      local_path TEXT NOT NULL,
      sync_direction TEXT NOT NULL,
      schedule TEXT,
      is_active INTEGER DEFAULT 1,
      last_sync_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sync_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id INTEGER NOT NULL,
      status TEXT NOT NULL,
      started_at TEXT NOT NULL,
      completed_at TEXT,
      total_files INTEGER DEFAULT 0,
      files_synced INTEGER DEFAULT 0,
      files_skipped INTEGER DEFAULT 0,
      files_failed INTEGER DEFAULT 0,
      bytes_transferred INTEGER DEFAULT 0,
      total_bytes INTEGER DEFAULT 0,
      current_file TEXT,
      error_message TEXT,
      FOREIGN KEY (profile_id) REFERENCES sync_profiles(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sync_file_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      history_id INTEGER NOT NULL,
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      direction TEXT NOT NULL,
      status TEXT NOT NULL,
      file_size INTEGER DEFAULT 0,
      bytes_transferred INTEGER DEFAULT 0,
      local_hash TEXT,
      remote_hash TEXT,
      error_message TEXT,
      started_at TEXT,
      completed_at TEXT,
      FOREIGN KEY (history_id) REFERENCES sync_history(id) ON DELETE CASCADE
    );
  `);

  // Migrations for existing databases
  const cols = db.pragma('table_info(sync_history)') as any[];
  const colNames = new Set(cols.map((c: any) => c.name));
  if (!colNames.has('total_files')) {
    db.exec('ALTER TABLE sync_history ADD COLUMN total_files INTEGER DEFAULT 0');
  }
  if (!colNames.has('files_skipped')) {
    db.exec('ALTER TABLE sync_history ADD COLUMN files_skipped INTEGER DEFAULT 0');
  }
}

export function getDb(): Database.Database {
  return db;
}

// ─── Token helpers ──────────────────────────────────────────────────────────

export function saveTokens(tokens: AuthTokens): void {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO auth_tokens (id, access_token, refresh_token, token_type, expiry_date, scope, updated_at)
    VALUES (1, ?, ?, ?, ?, ?, datetime('now'))
  `);
  stmt.run(tokens.access_token, tokens.refresh_token ?? null, tokens.token_type ?? null, tokens.expiry_date ?? null, tokens.scope ?? null);
}

export function getTokens(): AuthTokens | null {
  const row = db.prepare('SELECT * FROM auth_tokens WHERE id = 1').get() as any;
  if (!row) return null;
  return {
    access_token: row.access_token,
    refresh_token: row.refresh_token,
    token_type: row.token_type,
    expiry_date: row.expiry_date,
    scope: row.scope,
  };
}

export function clearTokens(): void {
  db.prepare('DELETE FROM auth_tokens').run();
}

// ─── User info helpers ──────────────────────────────────────────────────────

export function saveUserInfo(user: UserInfo): void {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO user_info (id, email, name, picture, updated_at)
    VALUES (1, ?, ?, ?, datetime('now'))
  `);
  stmt.run(user.email, user.name, user.picture);
}

export function getUserInfo(): UserInfo | null {
  const row = db.prepare('SELECT * FROM user_info WHERE id = 1').get() as any;
  if (!row) return null;
  return {
    email: row.email,
    name: row.name,
    picture: row.picture,
  };
}

export function clearUserInfo(): void {
  db.prepare('DELETE FROM user_info').run();
}

// ─── Sync profile helpers ──────────────────────────────────────────────────

function rowToProfile(row: any): SyncProfile {
  return {
    id: row.id,
    name: row.name,
    driveId: row.drive_id,
    driveName: row.drive_name,
    driveType: row.drive_type,
    driveFolderId: row.drive_folder_id,
    driveFolderPath: row.drive_folder_path,
    localPath: row.local_path,
    syncDirection: row.sync_direction,
    schedule: row.schedule ?? undefined,
    isActive: row.is_active === 1,
    lastSyncAt: row.last_sync_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function getProfiles(): SyncProfile[] {
  const rows = db.prepare('SELECT * FROM sync_profiles ORDER BY created_at DESC').all() as any[];
  return rows.map(rowToProfile);
}

export function getProfile(id: number): SyncProfile | null {
  const row = db.prepare('SELECT * FROM sync_profiles WHERE id = ?').get(id) as any;
  return row ? rowToProfile(row) : null;
}

export function createProfile(p: Omit<SyncProfile, 'id' | 'createdAt' | 'updatedAt'>): SyncProfile {
  const stmt = db.prepare(`
    INSERT INTO sync_profiles (name, drive_id, drive_name, drive_type, drive_folder_id, drive_folder_path, local_path, sync_direction, schedule, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    p.name, p.driveId, p.driveName, p.driveType,
    p.driveFolderId, p.driveFolderPath, p.localPath,
    p.syncDirection, p.schedule ?? null, p.isActive ? 1 : 0,
  );
  return getProfile(result.lastInsertRowid as number)!;
}

export function updateProfile(id: number, updates: Partial<SyncProfile>): SyncProfile | null {
  const fields: string[] = [];
  const values: any[] = [];

  if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
  if (updates.syncDirection !== undefined) { fields.push('sync_direction = ?'); values.push(updates.syncDirection); }
  if (updates.schedule !== undefined) { fields.push('schedule = ?'); values.push(updates.schedule ?? null); }
  if (updates.isActive !== undefined) { fields.push('is_active = ?'); values.push(updates.isActive ? 1 : 0); }
  if (updates.lastSyncAt !== undefined) { fields.push('last_sync_at = ?'); values.push(updates.lastSyncAt); }

  if (fields.length === 0) return getProfile(id);

  fields.push("updated_at = datetime('now')");
  values.push(id);

  db.prepare(`UPDATE sync_profiles SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return getProfile(id);
}

export function deleteProfile(id: number): void {
  db.prepare('DELETE FROM sync_profiles WHERE id = ?').run(id);
}
