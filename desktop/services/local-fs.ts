import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { LocalFile } from '../../shared/types';

export class LocalFsService {
  static getHomeDir(): string {
    return os.homedir();
  }

  static async listDirectory(dirPath: string): Promise<LocalFile[]> {
    const files: LocalFile[] = [];

    try {
      const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.name === '.Trash' || entry.name === 'Library') continue;

        const fullPath = path.join(dirPath, entry.name);

        try {
          const stats = await fs.promises.stat(fullPath);
          files.push({
            name: entry.name,
            path: fullPath,
            isDirectory: entry.isDirectory(),
            size: stats.size,
            modifiedTime: stats.mtime.toISOString(),
            isHidden: entry.name.startsWith('.'),
          });
        } catch {
          files.push({
            name: entry.name,
            path: fullPath,
            isDirectory: entry.isDirectory(),
            size: 0,
            modifiedTime: new Date().toISOString(),
            isHidden: entry.name.startsWith('.'),
          });
        }
      }
    } catch (err) {
      console.error(`Failed to list directory ${dirPath}:`, err);
    }

    files.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    return files;
  }
}
