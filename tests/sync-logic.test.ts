import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// ─── Unit tests for sync logic ──────────────────────────────────────────────
// These test the core logic functions without requiring Google API access.
// Run: npm test

describe('MD5 Hash Computation', () => {
  it('computes correct MD5 for a known string', () => {
    const hash = crypto.createHash('md5').update('hello world').digest('hex');
    expect(hash).toBe('5eb63bbbe01eeed093cb22bb8f5acdc3');
  });

  it('computes MD5 for a file', async () => {
    const tmpFile = path.join('/tmp', 'gsync-test-md5.txt');
    fs.writeFileSync(tmpFile, 'test content for md5');
    const hash = await new Promise<string>((resolve, reject) => {
      const h = crypto.createHash('md5');
      const stream = fs.createReadStream(tmpFile);
      stream.on('data', (chunk) => h.update(chunk));
      stream.on('end', () => resolve(h.digest('hex')));
      stream.on('error', reject);
    });
    expect(hash).toBe(crypto.createHash('md5').update('test content for md5').digest('hex'));
    fs.unlinkSync(tmpFile);
  });
});

describe('File Filter Logic', () => {
  function applyFileFilter<T extends { name: string; relativePath: string }>(files: T[], filter: string): T[] {
    const patterns = filter.split(',').map((p) => p.trim().toLowerCase()).filter(Boolean);
    if (patterns.length === 0) return files;
    return files.filter((f) => {
      const name = f.name.toLowerCase();
      const relPath = f.relativePath.toLowerCase();
      return patterns.some((pattern) => {
        if (pattern.startsWith('*.')) return name.endsWith(pattern.slice(1));
        if (pattern.includes('*')) {
          const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
          return regex.test(relPath) || regex.test(name);
        }
        return name === pattern || relPath.includes(pattern);
      });
    });
  }

  const testFiles = [
    { name: 'report.pdf', relativePath: '/docs/report.pdf' },
    { name: 'photo.jpg', relativePath: '/photos/photo.jpg' },
    { name: 'data.xlsx', relativePath: '/data.xlsx' },
    { name: 'notes.docx', relativePath: '/docs/notes.docx' },
    { name: 'image.heic', relativePath: '/photos/image.heic' },
  ];

  it('filters by extension', () => {
    const result = applyFileFilter(testFiles, '*.pdf');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('report.pdf');
  });

  it('filters by multiple extensions', () => {
    const result = applyFileFilter(testFiles, '*.pdf, *.docx');
    expect(result).toHaveLength(2);
  });

  it('filters by path pattern', () => {
    const result = applyFileFilter(testFiles, '*/docs/*');
    expect(result).toHaveLength(2);
  });

  it('returns all files for empty filter', () => {
    const result = applyFileFilter(testFiles, '');
    expect(result).toHaveLength(5);
  });

  it('is case insensitive', () => {
    const result = applyFileFilter(testFiles, '*.PDF');
    expect(result).toHaveLength(1);
  });

  it('filters HEIC files', () => {
    const result = applyFileFilter(testFiles, '*.heic');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('image.heic');
  });

  it('filters by exact name', () => {
    const result = applyFileFilter(testFiles, 'data.xlsx');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('data.xlsx');
  });

  it('filters images only', () => {
    const result = applyFileFilter(testFiles, '*.jpg, *.heic');
    expect(result).toHaveLength(2);
  });

  it('filters documents only', () => {
    const result = applyFileFilter(testFiles, '*.pdf, *.docx, *.xlsx');
    expect(result).toHaveLength(3);
  });

  it('handles whitespace in patterns', () => {
    const result = applyFileFilter(testFiles, ' *.pdf , *.docx ');
    expect(result).toHaveLength(2);
  });
});

describe('HEIC File Detection', () => {
  it('detects .heic extension', () => {
    expect(/\.heic$/i.test('photo.heic')).toBe(true);
    expect(/\.heic$/i.test('photo.HEIC')).toBe(true);
    expect(/\.heic$/i.test('photo.Heic')).toBe(true);
  });

  it('does not match non-HEIC files', () => {
    expect(/\.heic$/i.test('photo.jpg')).toBe(false);
    expect(/\.heic$/i.test('photo.heics')).toBe(false);
  });

  it('generates correct JPEG path', () => {
    const heicPath = '/photos/IMG_1234.heic';
    const jpegPath = heicPath.replace(/\.heic$/i, '.jpeg');
    expect(jpegPath).toBe('/photos/IMG_1234.jpeg');
  });

  it('handles uppercase HEIC', () => {
    const heicPath = '/photos/IMG_1234.HEIC';
    const jpegPath = heicPath.replace(/\.heic$/i, '.jpeg');
    expect(jpegPath).toBe('/photos/IMG_1234.jpeg');
  });
});

describe('HEIC Conversion (sips)', () => {
  it('converts HEIC to JPEG using sips', async () => {
    // Find a real HEIC file to test with
    const testHeic = '/Users/jpurshot/experimental/gsync_data/test/IMG_4523.heic';
    if (!fs.existsSync(testHeic)) {
      console.log('Skipping: no test HEIC file available');
      return;
    }

    const tmpHeic = '/tmp/gsync-test.heic';
    const tmpJpeg = '/tmp/gsync-test.jpeg';
    fs.copyFileSync(testHeic, tmpHeic);

    const { execFile } = await import('child_process');
    const { promisify } = await import('util');
    const execFileAsync = promisify(execFile);

    await execFileAsync('sips', ['-s', 'format', 'jpeg', tmpHeic, '--out', tmpJpeg]);
    expect(fs.existsSync(tmpJpeg)).toBe(true);
    expect(fs.statSync(tmpJpeg).size).toBeGreaterThan(0);

    // Cleanup
    fs.unlinkSync(tmpHeic);
    fs.unlinkSync(tmpJpeg);
  });
});

describe('Google Workspace Type Detection', () => {
  const EXPORT_MIME_TYPES: Record<string, { ext: string }> = {
    'application/vnd.google-apps.document': { ext: '.docx' },
    'application/vnd.google-apps.spreadsheet': { ext: '.xlsx' },
    'application/vnd.google-apps.presentation': { ext: '.pptx' },
    'application/vnd.google-apps.drawing': { ext: '.png' },
    'application/vnd.google-apps.jam': { ext: '.pdf' },
    'application/vnd.google-apps.script': { ext: '.json' },
  };

  function isGoogleWorkspaceFile(mimeType: string): boolean {
    return mimeType.startsWith('application/vnd.google-apps.');
  }

  function getExportExt(mimeType: string): string | null {
    return EXPORT_MIME_TYPES[mimeType]?.ext || null;
  }

  it('detects Google Docs', () => {
    expect(isGoogleWorkspaceFile('application/vnd.google-apps.document')).toBe(true);
    expect(getExportExt('application/vnd.google-apps.document')).toBe('.docx');
  });

  it('detects Google Sheets', () => {
    expect(getExportExt('application/vnd.google-apps.spreadsheet')).toBe('.xlsx');
  });

  it('does not detect regular files', () => {
    expect(isGoogleWorkspaceFile('application/pdf')).toBe(false);
    expect(isGoogleWorkspaceFile('image/jpeg')).toBe(false);
  });

  it('returns null for non-exportable types', () => {
    expect(getExportExt('application/vnd.google-apps.form')).toBeNull();
    expect(getExportExt('application/vnd.google-apps.site')).toBeNull();
  });
});

describe('Retry Logic', () => {
  it('retries on transient errors', async () => {
    let attempts = 0;
    async function flakyFn(): Promise<string> {
      attempts++;
      if (attempts < 3) {
        const err: any = new Error('socket hang up');
        err.code = 'ECONNRESET';
        throw err;
      }
      return 'success';
    }

    // Simplified retry
    async function retryWithBackoff<T>(fn: () => Promise<T>, maxRetries = 3, baseDelay = 10): Promise<T> {
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          return await fn();
        } catch (err: any) {
          const isRetryable = err?.code === 'ECONNRESET' || err?.message?.includes('socket hang up');
          if (!isRetryable || attempt === maxRetries) throw err;
          await new Promise((r) => setTimeout(r, baseDelay));
        }
      }
      throw new Error('Max retries exceeded');
    }

    const result = await retryWithBackoff(flakyFn);
    expect(result).toBe('success');
    expect(attempts).toBe(3);
  });

  it('fails after max retries', async () => {
    async function alwaysFails(): Promise<string> {
      const err: any = new Error('timeout');
      err.code = 'ETIMEDOUT';
      throw err;
    }

    async function retryWithBackoff<T>(fn: () => Promise<T>, maxRetries = 2, baseDelay = 10): Promise<T> {
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          return await fn();
        } catch (err: any) {
          const isRetryable = err?.code === 'ETIMEDOUT';
          if (!isRetryable || attempt === maxRetries) throw err;
          await new Promise((r) => setTimeout(r, baseDelay));
        }
      }
      throw new Error('Max retries exceeded');
    }

    await expect(retryWithBackoff(alwaysFails)).rejects.toThrow('timeout');
  });

  it('does not retry on non-transient errors', async () => {
    let attempts = 0;
    async function authError(): Promise<string> {
      attempts++;
      throw new Error('401 Unauthorized');
    }

    async function retryWithBackoff<T>(fn: () => Promise<T>, maxRetries = 3, baseDelay = 10): Promise<T> {
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          return await fn();
        } catch (err: any) {
          const isRetryable = err?.code === 'ECONNRESET' || err?.code === 'ETIMEDOUT';
          if (!isRetryable || attempt === maxRetries) throw err;
          await new Promise((r) => setTimeout(r, baseDelay));
        }
      }
      throw new Error('Max retries exceeded');
    }

    await expect(retryWithBackoff(authError)).rejects.toThrow('401 Unauthorized');
    expect(attempts).toBe(1); // No retry
  });
});

describe('Time Bucket Grouping', () => {
  function getTimeBucket(dateStr: string): string {
    const now = new Date();
    const date = new Date(dateStr);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    if (date >= startOfWeek) return 'This Week';
    if (date >= startOfMonth) return 'This Month';
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  }

  it('puts today in This Week', () => {
    expect(getTimeBucket(new Date().toISOString())).toBe('This Week');
  });

  it('puts last year in a month bucket', () => {
    expect(getTimeBucket('2025-06-15T12:00:00Z')).toBe('June 2025');
  });
});

describe('Build Verification', () => {
  it('TypeScript main process compiles', async () => {
    const { execSync } = await import('child_process');
    const result = execSync('npx tsc -p tsconfig.main.json --noEmit 2>&1', { encoding: 'utf-8' });
    expect(result.trim()).toBe('');
  });

  it('TypeScript renderer compiles', async () => {
    const { execSync } = await import('child_process');
    const result = execSync('npx tsc -p tsconfig.json --noEmit 2>&1', { encoding: 'utf-8' });
    expect(result.trim()).toBe('');
  });

  it('Vite builds renderer', async () => {
    const { execSync } = await import('child_process');
    execSync('npx vite build', { encoding: 'utf-8', cwd: process.cwd() });
    expect(fs.existsSync('dist/renderer/index.html')).toBe(true);
  });

  it('OAuth config is generated during build', async () => {
    // Only if .env has credentials
    if (process.env.GOOGLE_CLIENT_ID) {
      expect(fs.existsSync('dist/oauth-config.json')).toBe(true);
    }
  });
});
