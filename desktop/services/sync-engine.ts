import * as fs from 'fs';
import * as path from 'path';
import { BrowserWindow } from 'electron';
import { GoogleDriveService, computeLocalMd5, isGoogleWorkspaceFile, getExportInfo } from './google-drive';
import { getProfile, updateProfile, getDb } from './database';
import type { SyncProfile, SyncSession, SyncDirection } from '../../shared/types';

interface SyncContext {
  profile: SyncProfile;
  driveService: GoogleDriveService;
  session: SyncSession;
  cancelled: boolean;
}

const activeSyncs = new Map<number, SyncContext>();

function sendProgress(session: SyncSession): void {
  const windows = BrowserWindow.getAllWindows();
  for (const win of windows) {
    if (!win.isDestroyed()) {
      win.webContents.send('sync:progress', session);
    }
  }
}

function createSession(profileId: number, profileName: string): SyncSession {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO sync_history (profile_id, status, started_at, files_synced, files_failed, bytes_transferred, total_bytes)
    VALUES (?, 'in_progress', datetime('now'), 0, 0, 0, 0)
  `);
  const result = stmt.run(profileId);
  return {
    id: result.lastInsertRowid as number,
    profileId,
    profileName,
    status: 'in_progress',
    startedAt: new Date().toISOString(),
    filesSynced: 0,
    filesFailed: 0,
    bytesTransferred: 0,
    totalBytes: 0,
  };
}

function updateSession(session: SyncSession): void {
  const db = getDb();
  db.prepare(`
    UPDATE sync_history SET status = ?, completed_at = ?, files_synced = ?, files_failed = ?,
    bytes_transferred = ?, total_bytes = ?, current_file = ?, error_message = ?
    WHERE id = ?
  `).run(
    session.status,
    session.completedAt ?? null,
    session.filesSynced,
    session.filesFailed,
    session.bytesTransferred,
    session.totalBytes,
    session.currentFile ?? null,
    session.errorMessage ?? null,
    session.id,
  );
}

function logFile(
  sessionId: number,
  fileName: string,
  filePath: string,
  direction: 'download' | 'upload',
  status: string,
  fileSize: number,
  bytesTransferred: number,
  localHash?: string,
  remoteHash?: string,
  error?: string,
): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO sync_file_log (history_id, file_name, file_path, direction, status, file_size, bytes_transferred, local_hash, remote_hash, error_message, completed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(sessionId, fileName, filePath, direction, status, fileSize, bytesTransferred, localHash ?? null, remoteHash ?? null, error ?? null);
}

/** Recursively list all local files with relative paths */
async function listAllLocalFiles(rootDir: string, relativePath: string = '/'): Promise<{ name: string; path: string; relativePath: string; size: number; modifiedTime: Date }[]> {
  const result: { name: string; path: string; relativePath: string; size: number; modifiedTime: Date }[] = [];

  let entries;
  try {
    entries = await fs.promises.readdir(rootDir, { withFileTypes: true });
  } catch {
    return result;
  }

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue; // skip hidden files
    const fullPath = path.join(rootDir, entry.name);

    try {
      const stat = await fs.promises.stat(fullPath);
      if (entry.isDirectory()) {
        const subFiles = await listAllLocalFiles(fullPath, `${relativePath}${entry.name}/`);
        result.push(...subFiles);
      } else {
        result.push({
          name: entry.name,
          path: fullPath,
          relativePath: `${relativePath}${entry.name}`,
          size: stat.size,
          modifiedTime: stat.mtime,
        });
      }
    } catch {
      // Permission denied or deleted during scan
    }
  }

  return result;
}

async function runDownloadSync(ctx: SyncContext): Promise<void> {
  const { profile, driveService, session } = ctx;

  // List all remote files
  session.currentFile = 'Scanning remote files...';
  sendProgress(session);

  const remoteFiles = await driveService.listAllFiles(profile.driveId, profile.driveFolderId);

  // Filter out unsupported Google Workspace types
  const downloadable = remoteFiles.filter((f) => {
    if (isGoogleWorkspaceFile(f.mimeType)) {
      return !!getExportInfo(f.mimeType);
    }
    return true;
  });

  session.totalBytes = downloadable.reduce((sum, f) => sum + (f.size || 0), 0);
  sendProgress(session);

  for (const file of downloadable) {
    if (ctx.cancelled) break;

    const localPath = path.join(profile.localPath, file.relativePath.slice(1)); // remove leading /
    session.currentFile = file.name;
    sendProgress(session);

    try {
      // Check if local file exists and compare hashes
      let needsDownload = true;
      if (fs.existsSync(localPath) && file.md5Checksum) {
        const localHash = await computeLocalMd5(localPath);
        if (localHash === file.md5Checksum) {
          needsDownload = false;
          logFile(session.id, file.name, file.relativePath, 'download', 'skipped', file.size || 0, 0, localHash, file.md5Checksum);
        }
      }

      if (needsDownload) {
        const hash = await driveService.downloadFile(
          file.id,
          file.mimeType,
          localPath,
          (bytes) => {
            session.bytesTransferred += bytes;
            sendProgress(session);
          },
        );
        logFile(session.id, file.name, file.relativePath, 'download', 'completed', file.size || 0, file.size || 0, hash, file.md5Checksum);
        session.filesSynced++;
      }
    } catch (err: any) {
      logFile(session.id, file.name, file.relativePath, 'download', 'failed', file.size || 0, 0, undefined, undefined, err?.message);
      session.filesFailed++;
    }

    sendProgress(session);
  }
}

async function runUploadSync(ctx: SyncContext): Promise<void> {
  const { profile, driveService, session } = ctx;

  session.currentFile = 'Scanning local files...';
  sendProgress(session);

  const localFiles = await listAllLocalFiles(profile.localPath);

  session.totalBytes = localFiles.reduce((sum, f) => sum + f.size, 0);
  sendProgress(session);

  for (const file of localFiles) {
    if (ctx.cancelled) break;

    session.currentFile = file.name;
    sendProgress(session);

    try {
      // Navigate to the correct remote folder
      const relDir = path.dirname(file.relativePath);
      let parentId = profile.driveFolderId;

      if (relDir !== '/') {
        const parts = relDir.split('/').filter(Boolean);
        for (const part of parts) {
          parentId = await driveService.ensureFolder(parentId, part, profile.driveId);
        }
      }

      // Check if file already exists remotely
      const existing = await driveService.findFile(parentId, file.name, profile.driveId);

      let needsUpload = true;
      if (existing?.md5Checksum) {
        const localHash = await computeLocalMd5(file.path);
        if (localHash === existing.md5Checksum) {
          needsUpload = false;
          logFile(session.id, file.name, file.relativePath, 'upload', 'skipped', file.size, 0, localHash, existing.md5Checksum);
        }
      }

      if (needsUpload) {
        await driveService.uploadFile(
          file.path,
          file.name,
          parentId,
          profile.driveId,
          existing?.id,
          (bytes) => {
            session.bytesTransferred += bytes;
            sendProgress(session);
          },
        );
        logFile(session.id, file.name, file.relativePath, 'upload', 'completed', file.size, file.size);
        session.filesSynced++;
      }
    } catch (err: any) {
      logFile(session.id, file.name, file.relativePath, 'upload', 'failed', file.size, 0, undefined, undefined, err?.message);
      session.filesFailed++;
    }

    sendProgress(session);
  }
}

async function runBidirectionalSync(ctx: SyncContext): Promise<void> {
  const { profile, driveService, session } = ctx;

  // Step 1: Download new/changed remote files
  session.currentFile = 'Scanning remote files...';
  sendProgress(session);
  const remoteFiles = await driveService.listAllFiles(profile.driveId, profile.driveFolderId);
  const downloadable = remoteFiles.filter((f) => {
    if (isGoogleWorkspaceFile(f.mimeType)) return !!getExportInfo(f.mimeType);
    return true;
  });

  // Step 2: Scan local files
  session.currentFile = 'Scanning local files...';
  sendProgress(session);
  const localFiles = await listAllLocalFiles(profile.localPath);

  const remoteByPath = new Map(downloadable.map((f) => [f.relativePath, f]));
  const localByPath = new Map(localFiles.map((f) => [f.relativePath, f]));

  const allPaths = new Set([...remoteByPath.keys(), ...localByPath.keys()]);
  session.totalBytes = downloadable.reduce((s, f) => s + (f.size || 0), 0) + localFiles.reduce((s, f) => s + f.size, 0);
  sendProgress(session);

  for (const relPath of allPaths) {
    if (ctx.cancelled) break;

    const remote = remoteByPath.get(relPath);
    const local = localByPath.get(relPath);
    const fileName = path.basename(relPath);
    session.currentFile = fileName;
    sendProgress(session);

    try {
      if (remote && !local) {
        // Remote-only → download
        const localPath = path.join(profile.localPath, relPath.slice(1));
        await driveService.downloadFile(remote.id, remote.mimeType, localPath, (bytes) => {
          session.bytesTransferred += bytes;
          sendProgress(session);
        });
        logFile(session.id, fileName, relPath, 'download', 'completed', remote.size || 0, remote.size || 0);
        session.filesSynced++;
      } else if (local && !remote) {
        // Local-only → upload
        const relDir = path.dirname(relPath);
        let parentId = profile.driveFolderId;
        if (relDir !== '/') {
          for (const part of relDir.split('/').filter(Boolean)) {
            parentId = await driveService.ensureFolder(parentId, part, profile.driveId);
          }
        }
        await driveService.uploadFile(local.path, local.name, parentId, profile.driveId, undefined, (bytes) => {
          session.bytesTransferred += bytes;
          sendProgress(session);
        });
        logFile(session.id, fileName, relPath, 'upload', 'completed', local.size, local.size);
        session.filesSynced++;
      } else if (remote && local) {
        // Both exist — compare hashes, newer wins
        const localHash = await computeLocalMd5(local.path);
        if (remote.md5Checksum && localHash === remote.md5Checksum) {
          logFile(session.id, fileName, relPath, 'download', 'skipped', 0, 0, localHash, remote.md5Checksum);
          continue;
        }
        // Compare timestamps
        const remoteTime = remote.modifiedTime ? new Date(remote.modifiedTime).getTime() : 0;
        const localTime = local.modifiedTime.getTime();

        if (remoteTime > localTime) {
          // Remote is newer → download
          const localPath = path.join(profile.localPath, relPath.slice(1));
          await driveService.downloadFile(remote.id, remote.mimeType, localPath, (bytes) => {
            session.bytesTransferred += bytes;
            sendProgress(session);
          });
          logFile(session.id, fileName, relPath, 'download', 'completed', remote.size || 0, remote.size || 0, localHash, remote.md5Checksum);
          session.filesSynced++;
        } else {
          // Local is newer → upload
          const relDir = path.dirname(relPath);
          let parentId = profile.driveFolderId;
          if (relDir !== '/') {
            for (const part of relDir.split('/').filter(Boolean)) {
              parentId = await driveService.ensureFolder(parentId, part, profile.driveId);
            }
          }
          const existing = await driveService.findFile(parentId, local.name, profile.driveId);
          await driveService.uploadFile(local.path, local.name, parentId, profile.driveId, existing?.id, (bytes) => {
            session.bytesTransferred += bytes;
            sendProgress(session);
          });
          logFile(session.id, fileName, relPath, 'upload', 'completed', local.size, local.size, localHash);
          session.filesSynced++;
        }
      }
    } catch (err: any) {
      logFile(session.id, fileName, relPath, 'download', 'failed', 0, 0, undefined, undefined, err?.message);
      session.filesFailed++;
    }

    sendProgress(session);
  }
}

export async function startSync(profileId: number, driveService: GoogleDriveService): Promise<void> {
  const profile = getProfile(profileId);
  if (!profile) throw new Error('Profile not found');

  if (activeSyncs.has(profileId)) {
    throw new Error('Sync already in progress for this profile');
  }

  const session = createSession(profileId, profile.name);
  const ctx: SyncContext = { profile, driveService, session, cancelled: false };
  activeSyncs.set(profileId, ctx);

  sendProgress(session);

  try {
    switch (profile.syncDirection) {
      case 'download':
        await runDownloadSync(ctx);
        break;
      case 'upload':
        await runUploadSync(ctx);
        break;
      case 'bidirectional':
        await runBidirectionalSync(ctx);
        break;
    }

    session.status = ctx.cancelled ? 'cancelled' : 'completed';
    session.completedAt = new Date().toISOString();
    session.currentFile = undefined;
  } catch (err: any) {
    session.status = 'failed';
    session.completedAt = new Date().toISOString();
    session.errorMessage = err?.message || 'Sync failed';
    session.currentFile = undefined;
  } finally {
    updateSession(session);
    sendProgress(session);
    activeSyncs.delete(profileId);
    updateProfile(profileId, { lastSyncAt: new Date().toISOString() });
  }
}

export function cancelSync(profileId: number): void {
  const ctx = activeSyncs.get(profileId);
  if (ctx) {
    ctx.cancelled = true;
  }
}

export function getSessions(profileId?: number): SyncSession[] {
  const db = getDb();
  let rows: any[];

  if (profileId) {
    rows = db.prepare(`
      SELECT sh.*, sp.name as profile_name
      FROM sync_history sh
      JOIN sync_profiles sp ON sh.profile_id = sp.id
      WHERE sh.profile_id = ?
      ORDER BY sh.started_at DESC LIMIT 50
    `).all(profileId) as any[];
  } else {
    rows = db.prepare(`
      SELECT sh.*, sp.name as profile_name
      FROM sync_history sh
      JOIN sync_profiles sp ON sh.profile_id = sp.id
      ORDER BY sh.started_at DESC LIMIT 100
    `).all() as any[];
  }

  return rows.map((r) => ({
    id: r.id,
    profileId: r.profile_id,
    profileName: r.profile_name,
    status: r.status,
    startedAt: r.started_at,
    completedAt: r.completed_at ?? undefined,
    filesSynced: r.files_synced,
    filesFailed: r.files_failed,
    bytesTransferred: r.bytes_transferred,
    totalBytes: r.total_bytes,
    currentFile: r.current_file ?? undefined,
    errorMessage: r.error_message ?? undefined,
  }));
}
