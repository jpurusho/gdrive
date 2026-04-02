import { google, drive_v3 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import type { DriveInfo, DriveFile, DrivePermission } from '../../shared/types';

// Google Workspace mimeType → export format mappings
const EXPORT_MIME_TYPES: Record<string, { mime: string; ext: string }> = {
  'application/vnd.google-apps.document': { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', ext: '.docx' },
  'application/vnd.google-apps.spreadsheet': { mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ext: '.xlsx' },
  'application/vnd.google-apps.presentation': { mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', ext: '.pptx' },
  'application/vnd.google-apps.drawing': { mime: 'image/png', ext: '.png' },
  'application/vnd.google-apps.jam': { mime: 'application/pdf', ext: '.pdf' },
  'application/vnd.google-apps.script': { mime: 'application/vnd.google-apps.script+json', ext: '.json' },
};

// Types that cannot be exported (skip silently)
const SKIP_MIME_TYPES = new Set([
  'application/vnd.google-apps.folder',
  'application/vnd.google-apps.shortcut',
  'application/vnd.google-apps.form',
  'application/vnd.google-apps.site',
  'application/vnd.google-apps.map',
  'application/vnd.google-apps.fusiontable',
]);

export function isGoogleWorkspaceFile(mimeType: string): boolean {
  return mimeType.startsWith('application/vnd.google-apps.');
}

export function getExportInfo(mimeType: string): { mime: string; ext: string } | null {
  return EXPORT_MIME_TYPES[mimeType] || null;
}

export class GoogleDriveService {
  private drive: drive_v3.Drive;

  constructor(auth: OAuth2Client) {
    this.drive = google.drive({ version: 'v3', auth });
  }

  async listDrives(): Promise<DriveInfo[]> {
    const drives: DriveInfo[] = [];

    try {
      await this.drive.about.get({ fields: 'user,storageQuota' });
      drives.push({
        id: 'root',
        name: 'My Drive',
        type: 'my_drive',
        permission: 'owner',
      });
    } catch (err) {
      console.error('Failed to get My Drive info:', err);
    }

    try {
      let pageToken: string | undefined;
      do {
        const res = await this.drive.drives.list({
          pageSize: 100,
          pageToken,
          fields: 'nextPageToken,drives(id,name,colorRgb,capabilities)',
        });

        for (const d of res.data.drives || []) {
          const caps = d.capabilities;
          let permission: DrivePermission = 'reader';
          if (caps?.canEdit || caps?.canAddChildren || caps?.canManageMembers) {
            permission = 'writer';
          }

          drives.push({
            id: d.id || '',
            name: d.name || 'Unnamed Drive',
            type: 'shared_drive',
            permission,
            colorRgb: d.colorRgb ?? undefined,
          });
        }

        pageToken = res.data.nextPageToken ?? undefined;
      } while (pageToken);
    } catch (err) {
      console.error('Failed to list shared drives:', err);
    }

    return drives;
  }

  async listFiles(driveId: string, folderId: string): Promise<DriveFile[]> {
    const files: DriveFile[] = [];
    const isSharedDrive = driveId !== 'root';
    const parentId = folderId || (isSharedDrive ? driveId : 'root');

    try {
      let pageToken: string | undefined;
      do {
        const res = await this.drive.files.list({
          q: `'${parentId}' in parents and trashed = false`,
          pageSize: 200,
          pageToken,
          fields: 'nextPageToken,files(id,name,mimeType,size,modifiedTime,parents,shared,md5Checksum,capabilities)',
          supportsAllDrives: true,
          includeItemsFromAllDrives: true,
          ...(isSharedDrive ? { driveId, corpora: 'drive' } : {}),
          orderBy: 'folder,name',
        });

        for (const f of res.data.files || []) {
          files.push({
            id: f.id || '',
            name: f.name || '',
            mimeType: f.mimeType || '',
            size: f.size ? parseInt(f.size, 10) : undefined,
            modifiedTime: f.modifiedTime ?? undefined,
            parents: f.parents ?? undefined,
            shared: f.shared ?? undefined,
            isFolder: f.mimeType === 'application/vnd.google-apps.folder',
            md5Checksum: f.md5Checksum ?? undefined,
            capabilities: f.capabilities
              ? {
                  canEdit: f.capabilities.canEdit ?? false,
                  canDelete: f.capabilities.canDelete ?? false,
                  canDownload: f.capabilities.canDownload ?? false,
                }
              : undefined,
          });
        }

        pageToken = res.data.nextPageToken ?? undefined;
      } while (pageToken);
    } catch (err) {
      console.error('Failed to list files:', err);
    }

    return files;
  }

  /** Recursively list all files under a folder */
  async listAllFiles(driveId: string, folderId: string, basePath: string = '/'): Promise<(DriveFile & { relativePath: string })[]> {
    const result: (DriveFile & { relativePath: string })[] = [];
    const files = await this.listFiles(driveId, folderId);

    for (const file of files) {
      if (file.isFolder) {
        const subFiles = await this.listAllFiles(driveId, file.id, `${basePath}${file.name}/`);
        result.push(...subFiles);
      } else {
        const exportInfo = getExportInfo(file.mimeType);
        const fileName = exportInfo ? `${file.name}${exportInfo.ext}` : file.name;
        result.push({ ...file, relativePath: `${basePath}${fileName}` });
      }
    }

    return result;
  }

  /**
   * Download a file to a local path. Supports resuming from a byte offset.
   * Uses .partial temp file so interrupted downloads can be continued.
   * Returns the MD5 hash of the complete downloaded content.
   */
  async downloadFile(
    fileId: string,
    mimeType: string,
    destPath: string,
    onProgress?: (bytes: number) => void,
    cancelToken?: { cancelled: boolean },
  ): Promise<string> {
    const dir = path.dirname(destPath);
    await fs.promises.mkdir(dir, { recursive: true });

    const partialPath = destPath + '.partial';
    const exportInfo = getExportInfo(mimeType);

    // Check for existing partial download (only for binary files, not exports)
    let startByte = 0;
    if (!exportInfo && fs.existsSync(partialPath)) {
      const stat = fs.statSync(partialPath);
      startByte = stat.size;
    }

    let response;
    if (exportInfo) {
      // Exports don't support Range headers — always start fresh
      response = await this.drive.files.export(
        { fileId, mimeType: exportInfo.mime },
        { responseType: 'stream' },
      );
      startByte = 0;
    } else if (startByte > 0) {
      // Resume download with Range header
      console.log(`[Download] Resuming ${path.basename(destPath)} from byte ${startByte}`);
      response = await this.drive.files.get(
        { fileId, alt: 'media', supportsAllDrives: true },
        {
          responseType: 'stream',
          headers: { Range: `bytes=${startByte}-` },
        },
      );
    } else {
      response = await this.drive.files.get(
        { fileId, alt: 'media', supportsAllDrives: true },
        { responseType: 'stream' },
      );
    }

    return new Promise((resolve, reject) => {
      // Append to partial file if resuming, otherwise create new
      const dest = fs.createWriteStream(partialPath, startByte > 0 ? { flags: 'a' } : undefined);
      let bytesWritten = startByte;

      const stream = response.data as NodeJS.ReadableStream & { destroy?: () => void };

      stream.on('data', (chunk: Buffer) => {
        if (cancelToken?.cancelled) {
          if (stream.destroy) stream.destroy();
          dest.end();
          return;
        }
        bytesWritten += chunk.length;
        if (onProgress) onProgress(bytesWritten);
      });

      stream.on('error', (err) => {
        dest.end();
        reject(err);
      });

      stream.pipe(dest);

      dest.on('finish', () => {
        if (cancelToken?.cancelled) {
          // Leave .partial file for resume on next run
          resolve('');
          return;
        }
        // Move .partial to final destination and compute hash
        try {
          if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
          fs.renameSync(partialPath, destPath);
          // Compute MD5 of completed file
          const hash = crypto.createHash('md5');
          const readStream = fs.createReadStream(destPath);
          readStream.on('data', (chunk) => hash.update(chunk));
          readStream.on('end', () => resolve(hash.digest('hex')));
          readStream.on('error', reject);
        } catch (err) {
          reject(err);
        }
      });

      dest.on('error', reject);
    });
  }

  /** Upload a local file to Google Drive. Returns the file ID. */
  async uploadFile(
    localPath: string,
    fileName: string,
    parentFolderId: string,
    driveId: string,
    existingFileId?: string,
    onProgress?: (bytes: number) => void,
  ): Promise<string> {
    const stat = await fs.promises.stat(localPath);
    const isSharedDrive = driveId !== 'root';

    const media = {
      body: fs.createReadStream(localPath),
    };

    // Track progress
    let bytesUploaded = 0;
    const stream = media.body;
    stream.on('data', (chunk: string | Buffer) => {
      bytesUploaded += chunk.length;
      if (onProgress) onProgress(bytesUploaded);
    });

    if (existingFileId) {
      // Update existing file
      const res = await this.drive.files.update({
        fileId: existingFileId,
        media,
        supportsAllDrives: true,
        fields: 'id',
      });
      return res.data.id || existingFileId;
    } else {
      // Create new file
      const res = await this.drive.files.create({
        requestBody: {
          name: fileName,
          parents: [parentFolderId],
        },
        media,
        supportsAllDrives: true,
        fields: 'id',
      });
      return res.data.id || '';
    }
  }

  /** Create a folder in Google Drive. Returns the folder ID. */
  async createFolder(name: string, parentFolderId: string, driveId: string): Promise<string> {
    const res = await this.drive.files.create({
      requestBody: {
        name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentFolderId],
      },
      supportsAllDrives: true,
      fields: 'id',
    });
    return res.data.id || '';
  }

  /** Get or create a folder by path segments under a parent */
  async ensureFolder(parentId: string, folderName: string, driveId: string): Promise<string> {
    const isSharedDrive = driveId !== 'root';
    const res = await this.drive.files.list({
      q: `'${parentId}' in parents and name = '${folderName.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: 'files(id)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      ...(isSharedDrive ? { driveId, corpora: 'drive' } : {}),
    });

    if (res.data.files && res.data.files.length > 0) {
      return res.data.files[0].id!;
    }
    return this.createFolder(folderName, parentId, driveId);
  }

  /** Find a file by name under a parent folder */
  async findFile(parentId: string, fileName: string, driveId: string): Promise<DriveFile | null> {
    const isSharedDrive = driveId !== 'root';
    const res = await this.drive.files.list({
      q: `'${parentId}' in parents and name = '${fileName.replace(/'/g, "\\'")}' and trashed = false`,
      fields: 'files(id,name,mimeType,size,modifiedTime,md5Checksum)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      ...(isSharedDrive ? { driveId, corpora: 'drive' } : {}),
    });

    const f = res.data.files?.[0];
    if (!f) return null;
    return {
      id: f.id || '',
      name: f.name || '',
      mimeType: f.mimeType || '',
      size: f.size ? parseInt(f.size, 10) : undefined,
      modifiedTime: f.modifiedTime ?? undefined,
      isFolder: f.mimeType === 'application/vnd.google-apps.folder',
      md5Checksum: f.md5Checksum ?? undefined,
    };
  }
}

/** Compute the MD5 hash of a local file */
export async function computeLocalMd5(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('md5');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}
