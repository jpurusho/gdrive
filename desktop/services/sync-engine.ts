import * as fs from 'fs';
import * as path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { BrowserWindow } from 'electron';
import { GoogleDriveService, computeLocalMd5, isGoogleWorkspaceFile, getExportInfo } from './google-drive';
import { getProfile, updateProfile, getDb } from './database';
import type { SyncProfile, SyncSession, SyncFileEntry } from '../../shared/types';

const execFileAsync = promisify(execFile);

/** Convert HEIC file to JPEG using macOS sips (built-in, no dependencies) */
async function convertHeicFile(heicPath: string): Promise<string> {
  const jpegPath = heicPath.replace(/\.heic$/i, '.jpeg');
  await execFileAsync('sips', ['-s', 'format', 'jpeg', heicPath, '--out', jpegPath]);
  // Remove the original .heic
  try { fs.unlinkSync(heicPath); } catch {}
  return jpegPath;
}

/** Retry a function with exponential backoff for transient errors */
async function retryWithBackoff<T>(fn: () => Promise<T>, maxRetries = 3, baseDelay = 1000): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      const status = err?.code || err?.status || err?.response?.status;
      const isRetryable = status === 'ECONNRESET' || status === 'ETIMEDOUT' || status === 'ENOTFOUND'
        || status === 429 || status === 500 || status === 503
        || err?.message?.includes('ECONNRESET') || err?.message?.includes('socket hang up');

      if (!isRetryable || attempt === maxRetries) throw err;

      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 500;
      console.log(`[Sync] Retrying after ${Math.round(delay)}ms (attempt ${attempt + 1}/${maxRetries}): ${err?.message}`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error('Max retries exceeded');
}

/** Validate that local folder exists; create it if it's a download profile */
async function validateLocalFolder(profile: SyncProfile): Promise<string | null> {
  try {
    await fs.promises.access(profile.localPath);
    return null;
  } catch {
    if (profile.syncDirection === 'download') {
      try {
        await fs.promises.mkdir(profile.localPath, { recursive: true });
        console.log(`[Sync] Created local folder: ${profile.localPath}`);
        return null;
      } catch (err: any) {
        return `Cannot create local folder: ${err.message}`;
      }
    }
    return `Local folder does not exist: ${profile.localPath}`;
  }
}

/** Validate that the remote Drive folder is accessible */
async function validateRemoteFolder(profile: SyncProfile, driveService: GoogleDriveService): Promise<string | null> {
  try {
    await driveService.listFiles(profile.driveId, profile.driveFolderId);
    return null;
  } catch (err: any) {
    const errMsg = err?.message || '';
    const errData = err?.response?.data;
    if (errMsg.includes('invalid_grant') || errData?.error === 'invalid_grant') {
      return 'Session expired — please sign out and sign in again.';
    }
    const status = err?.code || err?.status || err?.response?.status;
    if (status === 404) return `Drive folder not found: ${profile.driveFolderPath}`;
    if (status === 401 || status === 403) return `Access denied to Drive folder: ${profile.driveFolderPath}`;
    return `Cannot access Drive folder: ${errMsg}`;
  }
}

/** Filter files by directory depth. 0 = unlimited, 1 = root only, 2 = one level deep, etc. */
function applyMaxDepth<T extends { relativePath: string }>(files: T[], maxDepth: number): T[] {
  if (!maxDepth || maxDepth <= 0) return files;
  return files.filter((f) => {
    const depth = f.relativePath.split('/').filter(Boolean).length;
    return depth <= maxDepth;
  });
}

/** Apply glob-like file filter patterns (e.g., "*.pdf,*.docx" or "*.jpg,reports/*") */
function applyFileFilter<T extends { name: string; relativePath: string }>(files: T[], filter: string): T[] {
  const patterns = filter.split(',').map((p) => p.trim().toLowerCase()).filter(Boolean);
  if (patterns.length === 0) return files;

  return files.filter((f) => {
    const name = f.name.toLowerCase();
    const relPath = f.relativePath.toLowerCase();
    return patterns.some((pattern) => {
      if (pattern.startsWith('*.')) {
        // Extension match: *.pdf
        return name.endsWith(pattern.slice(1));
      }
      if (pattern.includes('*')) {
        // Simple wildcard: reports/* or *.log
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
        return regex.test(relPath) || regex.test(name);
      }
      // Exact name match
      return name === pattern || relPath.includes(pattern);
    });
  });
}

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
    totalFiles: 0,
    filesSynced: 0,
    filesSkipped: 0,
    filesFailed: 0,
    bytesTransferred: 0,
    totalBytes: 0,
  };
}

function updateSession(session: SyncSession): void {
  const db = getDb();
  db.prepare(`
    UPDATE sync_history SET status = ?, completed_at = ?, total_files = ?, files_synced = ?,
    files_skipped = ?, files_failed = ?, bytes_transferred = ?, total_bytes = ?,
    current_file = ?, error_message = ?
    WHERE id = ?
  `).run(
    session.status,
    session.completedAt ?? null,
    session.totalFiles,
    session.filesSynced,
    session.filesSkipped,
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

/** Recursively list all local files with relative paths. Respects maxDepth and fileFilter for early pruning. */
async function listAllLocalFiles(rootDir: string, relativePath: string = '/', maxDepth: number = 0, currentDepth: number = 1, fileFilter?: string): Promise<{ name: string; path: string; relativePath: string; size: number; modifiedTime: Date }[]> {
  const result: { name: string; path: string; relativePath: string; size: number; modifiedTime: Date }[] = [];

  let entries;
  try {
    entries = await fs.promises.readdir(rootDir, { withFileTypes: true });
  } catch (err: any) {
    console.error(`Cannot read directory ${rootDir}:`, err?.message);
    return result;
  }

  // Parse filter patterns once
  const patterns = fileFilter ? fileFilter.split(',').map((p) => p.trim().toLowerCase()).filter(Boolean) : [];

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const fullPath = path.join(rootDir, entry.name);

    try {
      const stat = await fs.promises.stat(fullPath);
      if (entry.isDirectory()) {
        // Skip subdirectories if maxDepth reached
        if (maxDepth > 0 && currentDepth >= maxDepth) continue;
        const subFiles = await listAllLocalFiles(fullPath, `${relativePath}${entry.name}/`, maxDepth, currentDepth + 1, fileFilter);
        result.push(...subFiles);
      } else {
        // Skip files that don't match filter (early prune)
        if (patterns.length > 0) {
          const nameLower = entry.name.toLowerCase();
          const matched = patterns.some((p) => {
            if (p.startsWith('*.')) return nameLower.endsWith(p.slice(1));
            if (p.includes('*')) return new RegExp('^' + p.replace(/\*/g, '.*') + '$').test(nameLower);
            return nameLower === p;
          });
          if (!matched) continue;
        }
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

  session.currentFile = 'Scanning remote files...';
  sendProgress(session);

  console.log(`[Sync] Download sync for "${profile.name}" — driveId=${profile.driveId}, folderId=${profile.driveFolderId}`);

  const remoteFiles = await driveService.listAllFiles(profile.driveId, profile.driveFolderId);
  console.log(`[Sync] Found ${remoteFiles.length} total remote files`);

  // Filter out unsupported Google Workspace types
  const filtered: string[] = [];
  const downloadable = remoteFiles.filter((f) => {
    if (isGoogleWorkspaceFile(f.mimeType)) {
      if (!getExportInfo(f.mimeType)) {
        filtered.push(`${f.name} (${f.mimeType})`);
        return false;
      }
    }
    return true;
  });

  // Apply profile file filter (glob patterns like *.pdf, *.docx)
  const profileFilter = profile.fileFilter;
  let finalFiles = profileFilter ? applyFileFilter(downloadable, profileFilter) : downloadable;
  finalFiles = applyMaxDepth(finalFiles, profile.maxDepth);

  session.totalFiles = finalFiles.length;
  session.totalBytes = finalFiles.reduce((sum, f) => sum + (f.size || 0), 0);

  if (filtered.length > 0) {
    console.log(`[Sync] Filtered ${filtered.length} unsupported types:`);
    filtered.forEach((f) => console.log(`[Sync]   - ${f}`));
  }
  if (profileFilter && finalFiles.length !== downloadable.length) {
    console.log(`[Sync] Profile filter "${profileFilter}" matched ${finalFiles.length}/${downloadable.length} files`);
  }

  if (finalFiles.length === 0) {
    session.currentFile = remoteFiles.length === 0
      ? 'No files found in source folder'
      : `No downloadable files (${filtered.length} unsupported: ${filtered.map(f => f.split(' (')[0]).join(', ')})`;
    console.log(`[Sync] No downloadable files. ${remoteFiles.length} remote, ${filtered.length} unsupported`);
  } else {
    session.currentFile = `Found ${finalFiles.length} files to check...`;
  }
  sendProgress(session);

  for (const file of finalFiles) {
    if (ctx.cancelled) break;

    const localPath = path.join(profile.localPath, file.relativePath.slice(1));
    session.currentFile = `[${session.filesSynced + session.filesSkipped + session.filesFailed + 1}/${session.totalFiles}] ${file.name}`;
    sendProgress(session);

    try {
      let needsDownload = true;
      // Check if file exists locally (also check .jpeg version for converted HEIC files)
      const localExists = fs.existsSync(localPath);
      const jpegPath = localPath.replace(/\.heic$/i, '.jpeg');
      const jpegExists = profile.convertHeicToJpeg && /\.heic$/i.test(localPath) && fs.existsSync(jpegPath);

      if ((localExists || jpegExists) && file.md5Checksum) {
        // If HEIC was converted, compare by modifiedTime (can't compare MD5 — format changed)
        if (jpegExists && !localExists) {
          const localMtime = fs.statSync(jpegPath).mtime.getTime();
          const remoteMtime = file.modifiedTime ? new Date(file.modifiedTime).getTime() : 0;
          if (remoteMtime > localMtime) {
            // Remote HEIC was updated — re-download and re-convert
            needsDownload = true;
          } else {
            needsDownload = false;
            session.filesSkipped++;
            logFile(session.id, file.name, file.relativePath, 'download', 'skipped', file.size || 0, 0, undefined, file.md5Checksum);
          }
        } else if (localExists) {
          const localHash = await computeLocalMd5(localPath);
          if (localHash === file.md5Checksum) {
            needsDownload = false;
            session.filesSkipped++;
            logFile(session.id, file.name, file.relativePath, 'download', 'skipped', file.size || 0, 0, localHash, file.md5Checksum);
          }
        }
      }

      if (needsDownload) {
        const cancelToken = { get cancelled() { return ctx.cancelled; } };
        const hash = await retryWithBackoff(() => driveService.downloadFile(
          file.id,
          file.mimeType,
          localPath,
          (bytes) => {
            session.bytesTransferred += bytes;
            sendProgress(session);
          },
          cancelToken,
        ));
        if (ctx.cancelled) {
          // Paused — partial file saved for resume
          logFile(session.id, file.name, file.relativePath, 'download', 'paused', file.size || 0, 0);
          break;
        }
        // Convert HEIC to JPEG if enabled
        if (profile.convertHeicToJpeg && /\.heic$/i.test(localPath)) {
          try {
            const jpegPath = await convertHeicFile(localPath);
            console.log(`[Sync] Converted HEIC→JPEG: ${path.basename(jpegPath)}`);
          } catch (convErr: any) {
            console.warn(`[Sync] HEIC conversion failed for ${file.name}: ${convErr?.message}`);
          }
        }
        logFile(session.id, file.name, file.relativePath, 'download', 'completed', file.size || 0, file.size || 0, hash, file.md5Checksum);
        session.filesSynced++;
      }
    } catch (err: any) {
      console.error(`[Sync] Failed to download ${file.name}:`, err?.message);
      logFile(session.id, file.name, file.relativePath, 'download', 'failed', file.size || 0, 0, undefined, undefined, err?.message);
      session.filesFailed++;
    }

    sendProgress(session);
  }

  // Mirror mode: delete local files not present in remote
  if (profile.mirrorMode) {
    session.currentFile = 'Mirror: scanning for extra local files...';
    sendProgress(session);
    const mirrorLocalFiles = await listAllLocalFiles(profile.localPath);

    // Build remote path set from ALL remote files (unfiltered) to avoid deleting filtered-out files
    const allRemote = await driveService.listAllFiles(profile.driveId, profile.driveFolderId);
    const remoteRelPaths = new Set(allRemote.map((f) => f.relativePath));

    // Also add HEIC→JPEG variants so converted files aren't deleted
    if (profile.convertHeicToJpeg) {
      for (const f of allRemote) {
        if (/\.heic$/i.test(f.relativePath)) {
          remoteRelPaths.add(f.relativePath.replace(/\.heic$/i, '.jpeg'));
        }
      }
    }

    for (const localFile of mirrorLocalFiles) {
      if (ctx.cancelled) break;
      if (!remoteRelPaths.has(localFile.relativePath)) {
        try {
          fs.unlinkSync(localFile.path);
          logFile(session.id, localFile.name, localFile.relativePath, 'download', 'deleted', localFile.size, 0);
          session.filesSynced++;
          console.log(`[Mirror] Deleted local: ${localFile.relativePath}`);
        } catch (err: any) {
          console.warn(`[Mirror] Failed to delete local ${localFile.name}:`, err?.message);
          logFile(session.id, localFile.name, localFile.relativePath, 'download', 'failed', localFile.size, 0, undefined, undefined, `Mirror delete failed: ${err?.message}`);
          session.filesFailed++;
        }
        sendProgress(session);
      }
    }
  }
}

async function runUploadSync(ctx: SyncContext): Promise<void> {
  const { profile, driveService, session } = ctx;

  session.currentFile = 'Scanning local files...';
  sendProgress(session);

  console.log(`[Sync] Upload sync for "${profile.name}" — localPath=${profile.localPath}`);

  const localFiles = await listAllLocalFiles(profile.localPath, '/', profile.maxDepth, 1, profile.fileFilter);
  console.log(`[Sync] Found ${localFiles.length} local files (after filter + depth)`);

  session.totalFiles = localFiles.length;
  session.totalBytes = localFiles.reduce((sum, f) => sum + f.size, 0);

  if (localFiles.length === 0) {
    session.currentFile = 'No files found in local folder';
  } else {
    session.currentFile = `Found ${localFiles.length} files to check...`;
  }
  sendProgress(session);

  // For upload with useSourceFolderName, create a subfolder on Drive named after the local folder
  let uploadRootId = profile.driveFolderId;
  if (profile.useSourceFolderName) {
    const localFolderName = path.basename(profile.localPath);
    uploadRootId = await driveService.ensureFolder(profile.driveFolderId, localFolderName, profile.driveId);
    console.log(`[Sync] Created/found source folder on Drive: ${localFolderName}`);
  }

  for (const file of localFiles) {
    if (ctx.cancelled) break;

    session.currentFile = `[${session.filesSynced + session.filesSkipped + session.filesFailed + 1}/${session.totalFiles}] ${file.name}`;
    sendProgress(session);

    try {
      const relDir = path.dirname(file.relativePath);
      let parentId = uploadRootId;

      if (relDir !== '/') {
        const parts = relDir.split('/').filter(Boolean);
        for (const part of parts) {
          parentId = await driveService.ensureFolder(parentId, part, profile.driveId);
        }
      }

      const existing = await driveService.findFile(parentId, file.name, profile.driveId);

      let needsUpload = true;
      if (existing?.md5Checksum) {
        const localHash = await computeLocalMd5(file.path);
        if (localHash === existing.md5Checksum) {
          needsUpload = false;
          session.filesSkipped++;
          logFile(session.id, file.name, file.relativePath, 'upload', 'skipped', file.size, 0, localHash, existing.md5Checksum);
        }
      }

      if (needsUpload) {
        await retryWithBackoff(() => driveService.uploadFile(
          file.path,
          file.name,
          parentId,
          profile.driveId,
          existing?.id,
          (bytes) => {
            session.bytesTransferred += bytes;
            sendProgress(session);
          },
        ));
        logFile(session.id, file.name, file.relativePath, 'upload', 'completed', file.size, file.size);
        session.filesSynced++;
      }
    } catch (err: any) {
      console.error(`[Sync] Failed to upload ${file.name}:`, err?.message);
      logFile(session.id, file.name, file.relativePath, 'upload', 'failed', file.size, 0, undefined, undefined, err?.message);
      session.filesFailed++;
    }

    sendProgress(session);
  }

  // Mirror mode: delete remote files not present locally
  if (profile.mirrorMode) {
    session.currentFile = 'Mirror: scanning for extra remote files...';
    sendProgress(session);
    // Use uploadRootId (subfolder) if useSourceFolderName, otherwise profile root
    const mirrorRemoteFolderId = profile.useSourceFolderName ? uploadRootId : profile.driveFolderId;
    const remoteFiles = await driveService.listAllFiles(profile.driveId, mirrorRemoteFolderId);
    const localRelPaths = new Set(localFiles.map((f) => f.relativePath));

    for (const remoteFile of remoteFiles) {
      if (ctx.cancelled) break;
      if (!localRelPaths.has(remoteFile.relativePath)) {
        // Check if we can delete
        if (remoteFile.capabilities?.canDelete === false) {
          console.warn(`[Mirror] Cannot delete remote ${remoteFile.name}: no delete permission`);
          logFile(session.id, remoteFile.name, remoteFile.relativePath, 'upload', 'failed', remoteFile.size || 0, 0, undefined, undefined, 'No delete permission');
          session.filesFailed++;
          continue;
        }
        try {
          await driveService.deleteFile(remoteFile.id);
          logFile(session.id, remoteFile.name, remoteFile.relativePath, 'upload', 'deleted', remoteFile.size || 0, 0);
          session.filesSynced++;
          console.log(`[Mirror] Deleted remote: ${remoteFile.relativePath}`);
        } catch (err: any) {
          console.warn(`[Mirror] Failed to delete remote ${remoteFile.name}:`, err?.message);
          logFile(session.id, remoteFile.name, remoteFile.relativePath, 'upload', 'failed', remoteFile.size || 0, 0, undefined, undefined, `Mirror delete failed: ${err?.message}`);
          session.filesFailed++;
        }
        sendProgress(session);
      }
    }
  }
}

async function runBidirectionalSync(ctx: SyncContext): Promise<void> {
  const { profile, driveService, session } = ctx;

  session.currentFile = 'Scanning remote files...';
  sendProgress(session);
  const remoteFiles = await driveService.listAllFiles(profile.driveId, profile.driveFolderId);
  const downloadable = remoteFiles.filter((f) => {
    if (isGoogleWorkspaceFile(f.mimeType)) return !!getExportInfo(f.mimeType);
    return true;
  });

  session.currentFile = 'Scanning local files...';
  sendProgress(session);
  const localFiles = await listAllLocalFiles(profile.localPath, '/', profile.maxDepth, 1, profile.fileFilter);

  // Apply file filter and depth to remote side
  const profileFilter = profile.fileFilter;
  let filteredRemote = profileFilter ? applyFileFilter(downloadable, profileFilter) : downloadable;
  filteredRemote = applyMaxDepth(filteredRemote, profile.maxDepth);

  console.log(`[Sync] Bidirectional: ${filteredRemote.length} remote, ${localFiles.length} local (after filter + depth)`);

  const remoteByPath = new Map(filteredRemote.map((f) => [f.relativePath, f]));
  const localByPath = new Map(localFiles.map((f) => [f.relativePath, f]));

  const allPaths = new Set([...remoteByPath.keys(), ...localByPath.keys()]);
  session.totalFiles = allPaths.size;
  session.totalBytes = filteredRemote.reduce((s, f) => s + (f.size || 0), 0) + localFiles.reduce((s, f) => s + f.size, 0);

  console.log(`[Sync] Bidirectional for "${profile.name}" — ${filteredRemote.length} remote, ${localFiles.length} local, ${allPaths.size} unique paths`);

  if (allPaths.size === 0) {
    session.currentFile = 'No files found on either side';
  } else {
    session.currentFile = `Found ${allPaths.size} files to check...`;
  }
  sendProgress(session);

  let idx = 0;
  for (const relPath of allPaths) {
    if (ctx.cancelled) break;
    idx++;

    const remote = remoteByPath.get(relPath);
    const local = localByPath.get(relPath);
    const fileName = path.basename(relPath);
    session.currentFile = `[${idx}/${session.totalFiles}] ${fileName}`;
    sendProgress(session);

    try {
      if (remote && !local) {
        const localPath = path.join(profile.localPath, relPath.slice(1));
        await retryWithBackoff(() => driveService.downloadFile(remote.id, remote.mimeType, localPath, (bytes) => {
          session.bytesTransferred += bytes;
          sendProgress(session);
        }));
        logFile(session.id, fileName, relPath, 'download', 'completed', remote.size || 0, remote.size || 0);
        session.filesSynced++;
      } else if (local && !remote) {
        const relDir = path.dirname(relPath);
        let parentId = profile.driveFolderId;
        if (relDir !== '/') {
          for (const part of relDir.split('/').filter(Boolean)) {
            parentId = await driveService.ensureFolder(parentId, part, profile.driveId);
          }
        }
        await retryWithBackoff(() => driveService.uploadFile(local.path, local.name, parentId, profile.driveId, undefined, (bytes) => {
          session.bytesTransferred += bytes;
          sendProgress(session);
        }));
        logFile(session.id, fileName, relPath, 'upload', 'completed', local.size, local.size);
        session.filesSynced++;
      } else if (remote && local) {
        const localHash = await computeLocalMd5(local.path);
        if (remote.md5Checksum && localHash === remote.md5Checksum) {
          session.filesSkipped++;
          logFile(session.id, fileName, relPath, 'download', 'skipped', 0, 0, localHash, remote.md5Checksum);
          continue;
        }
        const remoteTime = remote.modifiedTime ? new Date(remote.modifiedTime).getTime() : 0;
        const localTime = local.modifiedTime.getTime();

        if (remoteTime > localTime) {
          const localPath = path.join(profile.localPath, relPath.slice(1));
          await retryWithBackoff(() => driveService.downloadFile(remote.id, remote.mimeType, localPath, (bytes) => {
            session.bytesTransferred += bytes;
            sendProgress(session);
          }));
          logFile(session.id, fileName, relPath, 'download', 'completed', remote.size || 0, remote.size || 0, localHash, remote.md5Checksum);
          session.filesSynced++;
        } else {
          const relDir = path.dirname(relPath);
          let parentId = profile.driveFolderId;
          if (relDir !== '/') {
            for (const part of relDir.split('/').filter(Boolean)) {
              parentId = await driveService.ensureFolder(parentId, part, profile.driveId);
            }
          }
          const existing = await driveService.findFile(parentId, local.name, profile.driveId);
          await retryWithBackoff(() => driveService.uploadFile(local.path, local.name, parentId, profile.driveId, existing?.id, (bytes) => {
            session.bytesTransferred += bytes;
            sendProgress(session);
          }));
          logFile(session.id, fileName, relPath, 'upload', 'completed', local.size, local.size, localHash);
          session.filesSynced++;
        }
      }
    } catch (err: any) {
      console.error(`[Sync] Failed to process ${fileName}:`, err?.message);
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

  // Mark any previous paused sessions for this profile as cancelled
  const db = getDb();
  db.prepare(`
    UPDATE sync_history SET status = 'cancelled', completed_at = datetime('now')
    WHERE profile_id = ? AND status = 'paused'
  `).run(profileId);

  // useSourceFolderName: create subfolder to keep source/dest aligned
  let effectiveProfile = profile;
  if (profile.useSourceFolderName) {
    if (profile.syncDirection === 'download' || profile.syncDirection === 'bidirectional') {
      // Append drive folder name to local path so sync happens in a subfolder
      const folderName = profile.driveFolderPath.split('/').filter(Boolean).pop() || profile.driveName;
      effectiveProfile = { ...profile, localPath: path.join(profile.localPath, folderName) };
    }
    // For upload, the Drive subfolder is created during sync (ensureFolder)
  }

  const session = createSession(profileId, effectiveProfile.name);
  const ctx: SyncContext = { profile: effectiveProfile, driveService, session, cancelled: false };
  activeSyncs.set(profileId, ctx);

  console.log(`[Sync] Starting ${effectiveProfile.syncDirection} sync for "${effectiveProfile.name}"`);
  console.log(`[Sync]   Drive: ${effectiveProfile.driveName} (${effectiveProfile.driveId}), folder: ${effectiveProfile.driveFolderPath} (${effectiveProfile.driveFolderId})`);
  console.log(`[Sync]   Local: ${effectiveProfile.localPath}${profile.useSourceFolderName ? ' (source folder name)' : ''}`);

  sendProgress(session);

  // Validate folders before starting
  const localErr = await validateLocalFolder(profile);
  if (localErr) {
    session.status = 'failed';
    session.completedAt = new Date().toISOString();
    session.errorMessage = localErr;
    updateSession(session);
    sendProgress(session);
    activeSyncs.delete(profileId);
    updateProfile(profileId, { isActive: false });
    console.error(`[Sync] ${localErr} — profile deactivated`);
    return;
  }

  const remoteErr = await validateRemoteFolder(profile, driveService);
  if (remoteErr) {
    session.status = 'failed';
    session.completedAt = new Date().toISOString();
    session.errorMessage = remoteErr;
    updateSession(session);
    sendProgress(session);
    activeSyncs.delete(profileId);
    updateProfile(profileId, { isActive: false });
    console.error(`[Sync] ${remoteErr} — profile deactivated`);
    return;
  }

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

    if (ctx.cancelled) {
      session.status = 'cancelled';
      session.completedAt = new Date().toISOString();
      session.currentFile = undefined;
      session.errorMessage = `Stopped — ${session.filesSynced} synced, ${session.filesSkipped} skipped. Partial files saved.`;
      console.log(`[Sync] Stopped: ${session.filesSynced} synced, ${session.filesSkipped} skipped`);
    } else {
      session.status = 'completed';
      session.completedAt = new Date().toISOString();
      session.currentFile = undefined;
      if (session.totalFiles === 0) {
        session.errorMessage = 'No files found in source folder';
      }
      console.log(`[Sync] Completed: ${session.totalFiles} found, ${session.filesSynced} synced, ${session.filesSkipped} skipped, ${session.filesFailed} failed`);
    }
  } catch (err: any) {
    session.status = 'failed';
    session.completedAt = new Date().toISOString();
    session.currentFile = undefined;

    // Detect expired/revoked tokens
    const errMsg = err?.message || '';
    const errData = err?.response?.data;
    if (errMsg.includes('invalid_grant') || errData?.error === 'invalid_grant') {
      session.errorMessage = 'Session expired — please sign out and sign in again.';
    } else {
      session.errorMessage = errMsg || 'Sync failed';
    }
    console.error(`[Sync] Failed:`, errMsg);
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
  } else {
    // Force-clear stuck entry (sync crashed but wasn't cleaned up)
    activeSyncs.delete(profileId);
  }
}

export function getFileLogs(sessionId: number): SyncFileEntry[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM sync_file_log WHERE history_id = ? ORDER BY completed_at DESC').all(sessionId) as any[];
  return rows.map((r) => ({
    id: r.id,
    sessionId: r.history_id,
    fileName: r.file_name,
    filePath: r.file_path,
    direction: r.direction,
    status: r.status,
    fileSize: r.file_size,
    bytesTransferred: r.bytes_transferred,
    localHash: r.local_hash ?? undefined,
    remoteHash: r.remote_hash ?? undefined,
    errorMessage: r.error_message ?? undefined,
  }));
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
    totalFiles: r.total_files ?? 0,
    filesSynced: r.files_synced,
    filesSkipped: r.files_skipped ?? 0,
    filesFailed: r.files_failed,
    bytesTransferred: r.bytes_transferred,
    totalBytes: r.total_bytes,
    currentFile: r.current_file ?? undefined,
    errorMessage: r.error_message ?? undefined,
  }));
}
