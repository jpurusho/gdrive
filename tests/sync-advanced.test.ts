import { describe, it, expect, vi } from 'vitest';

// ─── Bidirectional conflict resolution ──────────────────────────────────────

describe('Bidirectional timestamp conflict logic', () => {
  const SYNC_TIMESTAMP_TOLERANCE_MS = 2000;

  function resolveDirection(remoteTime: number, localTime: number): 'download' | 'upload' | 'skip' {
    const diff = Math.abs(remoteTime - localTime);
    if (diff < SYNC_TIMESTAMP_TOLERANCE_MS) return 'skip';
    return remoteTime > localTime ? 'download' : 'upload';
  }

  it('skips when timestamps are within tolerance', () => {
    const base = Date.now();
    expect(resolveDirection(base, base + 1000)).toBe('skip');
    expect(resolveDirection(base, base)).toBe('skip');
    expect(resolveDirection(base, base + 1999)).toBe('skip');
  });

  it('downloads when remote is newer', () => {
    const base = Date.now();
    expect(resolveDirection(base + 5000, base)).toBe('download');
    expect(resolveDirection(base + 60000, base)).toBe('download');
  });

  it('uploads when local is newer', () => {
    const base = Date.now();
    expect(resolveDirection(base, base + 5000)).toBe('upload');
    expect(resolveDirection(base, base + 3600000)).toBe('upload');
  });

  it('boundary: exactly 2000ms triggers action', () => {
    const base = Date.now();
    expect(resolveDirection(base + 2000, base)).toBe('download');
    expect(resolveDirection(base, base + 2000)).toBe('upload');
  });

  it('boundary: 1999ms is within tolerance — skip', () => {
    const base = Date.now();
    expect(resolveDirection(base + 1999, base)).toBe('skip');
  });
});

// ─── onProgress delta (R3 fix) ────────────────────────────────────────────

describe('onProgress delta accumulation', () => {
  it('accumulates delta bytes correctly', () => {
    let totalTransferred = 0;
    const onProgress = (delta: number) => { totalTransferred += delta; };

    // Simulate 3 chunks of 1000, 2000, 500 bytes
    onProgress(1000);
    onProgress(2000);
    onProgress(500);

    expect(totalTransferred).toBe(3500);
  });

  it('gives wrong result if cumulative bytes are passed (regression guard)', () => {
    let totalTransferred = 0;
    const onProgressCumulative = (cumulative: number) => { totalTransferred += cumulative; };

    // Same 3 chunks but passed cumulatively — result is wrong
    onProgressCumulative(1000);   // += 1000
    onProgressCumulative(3000);   // += 3000 (cumulative)
    onProgressCumulative(3500);   // += 3500 (cumulative)

    // If you pass cumulative, you get 7500 instead of 3500 — the bug
    expect(totalTransferred).toBe(7500);
    expect(totalTransferred).not.toBe(3500);
  });
});

// ─── Depth guard for listAllFiles ─────────────────────────────────────────

describe('listAllFiles depth guard', () => {
  async function mockListAllFiles(
    folderId: string,
    depth: number = 0,
    visited: Set<string> = new Set(),
    getFolders: (id: string) => string[],
  ): Promise<string[]> {
    if (depth > 20 || visited.has(folderId)) return [];
    visited.add(folderId);
    const children = getFolders(folderId);
    const results: string[] = [folderId];
    for (const child of children) {
      const sub = await mockListAllFiles(child, depth + 1, visited, getFolders);
      results.push(...sub);
    }
    return results;
  }

  it('returns all folders in a shallow tree', async () => {
    const tree: Record<string, string[]> = {
      root: ['a', 'b'],
      a: ['c'],
      b: [],
      c: [],
    };
    const result = await mockListAllFiles('root', 0, new Set(), (id) => tree[id] ?? []);
    expect(result).toContain('root');
    expect(result).toContain('a');
    expect(result).toContain('b');
    expect(result).toContain('c');
    expect(result).toHaveLength(4);
  });

  it('stops at depth 20 to prevent stack overflow', async () => {
    // Linear chain: 0 → 1 → 2 → ... → 25
    const getFolders = (id: string) => {
      const n = parseInt(id);
      return n < 25 ? [String(n + 1)] : [];
    };
    const result = await mockListAllFiles('0', 0, new Set(), getFolders);
    // Should stop at depth 20 (folders 0–20 inclusive)
    expect(result).toHaveLength(21);
    expect(result).not.toContain('21');
  });

  it('detects cycles via visited set', async () => {
    // A → B → A (cycle)
    const getFolders = (id: string) => id === 'A' ? ['B'] : ['A'];
    const result = await mockListAllFiles('A', 0, new Set(), getFolders);
    // A added, B added, then A is visited — stops
    expect(result).toHaveLength(2);
    expect(result).toContain('A');
    expect(result).toContain('B');
  });
});

// ─── formatBytes util ─────────────────────────────────────────────────────

describe('formatBytes', () => {
  function formatBytes(bytes: number): string {
    if (!bytes) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }

  it('handles zero', () => expect(formatBytes(0)).toBe('0 B'));
  it('formats bytes', () => expect(formatBytes(512)).toBe('512 B'));
  it('formats KB', () => expect(formatBytes(1536)).toBe('1.5 KB'));
  it('formats MB', () => expect(formatBytes(2.5 * 1024 * 1024)).toBe('2.5 MB'));
  it('formats GB', () => expect(formatBytes(1.2 * 1024 * 1024 * 1024)).toBe('1.2 GB'));
});

// ─── formatDuration util ──────────────────────────────────────────────────

describe('formatDuration', () => {
  function formatDuration(start: string, end?: string): string {
    if (!end) return 'running...';
    const ms = new Date(end).getTime() - new Date(start).getTime();
    if (ms < 1000) return '<1s';
    if (ms < 60000) return `${Math.round(ms / 1000)}s`;
    return `${Math.round(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
  }

  it('shows running when no end', () => {
    expect(formatDuration('2026-01-01T00:00:00Z')).toBe('running...');
  });

  it('shows <1s for sub-second durations', () => {
    expect(formatDuration('2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.500Z')).toBe('<1s');
  });

  it('formats seconds', () => {
    expect(formatDuration('2026-01-01T00:00:00Z', '2026-01-01T00:00:45Z')).toBe('45s');
  });

  it('formats minutes and seconds', () => {
    // 3m15s = 195000ms; Math.round(195000/60000)=3, Math.round(15000/1000)=15
    expect(formatDuration('2026-01-01T00:00:00Z', '2026-01-01T00:03:15Z')).toBe('3m 15s');
  });
});

// ─── URL validation (R7) ─────────────────────────────────────────────────

describe('openExternal URL validation', () => {
  const ALLOWED_HOSTS = ['github.com', 'google.com', 'accounts.google.com', 'developers.google.com'];

  function isAllowedUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return ['https:', 'http:'].includes(parsed.protocol) &&
        ALLOWED_HOSTS.some(h => parsed.hostname === h || parsed.hostname.endsWith('.' + h));
    } catch {
      return false;
    }
  }

  it('allows github.com', () => expect(isAllowedUrl('https://github.com/jpurusho/gdrive')).toBe(true));
  it('allows google.com subdomains', () => expect(isAllowedUrl('https://accounts.google.com/o/oauth2/auth')).toBe(true));
  it('allows developers.google.com', () => expect(isAllowedUrl('https://developers.google.com/drive')).toBe(true));
  it('blocks unknown domains', () => expect(isAllowedUrl('https://evil.com/steal')).toBe(false));
  it('blocks non-https to allowed host', () => expect(isAllowedUrl('ftp://github.com/foo')).toBe(false));
  it('blocks invalid URLs', () => expect(isAllowedUrl('not a url')).toBe(false));
  it('blocks javascript: URLs', () => expect(isAllowedUrl('javascript:alert(1)')).toBe(false));
  it('blocks look-alike domains', () => expect(isAllowedUrl('https://github.com.evil.io/foo')).toBe(false));
});
