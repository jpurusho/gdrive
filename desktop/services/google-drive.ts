import { google, drive_v3 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import type { DriveInfo, DriveFile, DrivePermission } from '../../shared/types';

export class GoogleDriveService {
  private drive: drive_v3.Drive;

  constructor(auth: OAuth2Client) {
    this.drive = google.drive({ version: 'v3', auth });
  }

  async listDrives(): Promise<DriveInfo[]> {
    const drives: DriveInfo[] = [];

    // Add "My Drive"
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

    // List shared drives
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
}
