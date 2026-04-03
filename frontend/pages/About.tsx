import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Divider,
  alpha,
  Chip,
} from '@mui/material';
import SystemUpdateIcon from '@mui/icons-material/SystemUpdate';
import CloudSyncIcon from '@mui/icons-material/CloudSync';
import SecurityIcon from '@mui/icons-material/Security';
import SpeedIcon from '@mui/icons-material/Speed';
import PauseCircleOutlineIcon from '@mui/icons-material/PauseCircleOutline';
import StorageIcon from '@mui/icons-material/Storage';
import ScheduleIcon from '@mui/icons-material/Schedule';
import PaletteIcon from '@mui/icons-material/Palette';
import BackupIcon from '@mui/icons-material/Backup';
import { useAppSettings } from '../context/AppSettingsContext';

const features = [
  { icon: CloudSyncIcon, title: 'Bidirectional Sync', desc: 'Download, upload, or sync both ways between Google Drive and local folders' },
  { icon: SecurityIcon, title: 'MD5 Checksums', desc: 'Verifies file integrity with hash comparison — only transfers changed files' },
  { icon: SpeedIcon, title: 'Streaming Transfers', desc: 'Efficient streaming downloads and uploads with real-time progress tracking' },
  { icon: PauseCircleOutlineIcon, title: 'Pause & Resume', desc: 'Pause large transfers mid-sync and resume later — partial downloads are saved automatically' },
  { icon: StorageIcon, title: 'Google Workspace Export', desc: 'Auto-exports Docs, Sheets, Slides, and Drawings to DOCX, XLSX, PPTX, PNG' },
  { icon: ScheduleIcon, title: 'Scheduled Auto-Sync', desc: 'Cron-based schedules — every 15 min, hourly, daily, or custom intervals' },
  { icon: PaletteIcon, title: '6 Themes', desc: 'Midnight, GitHub Dark, Dracula, Nord, One Dark Pro, and Light' },
  { icon: BackupIcon, title: 'Database Backup', desc: 'Backup settings and history to Google Drive — restore or merge on any machine' },
];

export default function About() {
  const { appTitle } = useAppSettings();
  const [version, setVersion] = useState('');
  const [platform, setPlatform] = useState('');
  const [checking, setChecking] = useState(false);
  const [updateResult, setUpdateResult] = useState<string | null>(null);
  const [updateUrl, setUpdateUrl] = useState<string | null>(null);
  const [updateVersion, setUpdateVersion] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadedPath, setDownloadedPath] = useState<string | null>(null);

  useEffect(() => {
    window.api.app.getVersion().then(setVersion);
    window.api.app.getPlatform().then(setPlatform);
  }, []);

  async function checkUpdates() {
    setChecking(true);
    setUpdateResult(null);
    setUpdateUrl(null);
    setUpdateVersion(null);
    setDownloadedPath(null);
    try {
      const result = await window.api.app.checkForUpdates();
      if (result.status === 'available') {
        setUpdateResult(`Update available: v${result.version}`);
        setUpdateUrl(result.url || null);
        setUpdateVersion(result.version || null);
      } else if (result.status === 'latest') {
        setUpdateResult(`You're on the latest version (v${result.version}).`);
      } else {
        setUpdateResult(result.message || 'Update check failed');
      }
    } catch (err: any) {
      setUpdateResult(err?.message || 'Update check failed');
    } finally {
      setChecking(false);
    }
  }

  async function handleDownload() {
    if (!updateVersion) return;

    // Ask user for download folder
    const dir = await window.api.localFs.selectDirectory();
    if (!dir) return;

    setDownloading(true);
    setDownloadProgress(0);
    setDownloadedPath(null);

    const unsub = window.api.app.onDownloadProgress((p) => {
      setDownloadProgress(p.percent);
    });

    try {
      // Build the ZIP asset URL from the release
      const zipName = `gsync-${updateVersion}-universal-mac.zip`;
      const downloadUrl = `https://github.com/jpurusho/gdrive/releases/download/v${updateVersion}/${zipName}`;

      const result = await window.api.app.downloadUpdate(downloadUrl, dir);
      if (result.success) {
        // Move from ~/Downloads to chosen folder
        setDownloadedPath(result.path);
        setUpdateResult(`Downloaded to: ${result.path}`);
      }
    } catch (err: any) {
      setUpdateResult(`Download failed: ${err?.message}`);
    } finally {
      unsub();
      setDownloading(false);
    }
  }

  return (
    <Box flex={1} overflow="auto" px={4} py={3}>
      {/* Hero */}
      <Box
        sx={{
          p: 4,
          borderRadius: 3,
          background: (t) => `linear-gradient(135deg, ${alpha(t.palette.primary.main, 0.1)}, ${alpha(t.palette.secondary.main, 0.08)})`,
          border: (t) => `1.5px solid ${alpha(t.palette.primary.light, 0.35)}`,
          mb: 4,
          textAlign: 'center',
        }}
      >
        <Typography
          variant="h4"
          sx={{
            fontWeight: 900,
            mb: 1,
            background: 'linear-gradient(135deg, #00e5ff, #00bfa5, #64ffda)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          {appTitle}
        </Typography>
        <Typography variant="body1" color="text.secondary" mb={2} maxWidth={500} mx="auto" lineHeight={1.7}>
          A standalone desktop application for syncing Google Drive files with your local filesystem.
          Built for speed, reliability, and daily use.
        </Typography>
        <Box display="flex" gap={1.5} justifyContent="center" flexWrap="wrap">
          <Chip
            label={`v${version}`}
            sx={{
              fontWeight: 700,
              bgcolor: (t) => alpha(t.palette.primary.main, 0.12),
              color: 'primary.light',
            }}
          />
          <Chip label={platform} variant="outlined" sx={{ fontSize: 12 }} />
          <Chip label="Electron + React" variant="outlined" sx={{ fontSize: 12 }} />
        </Box>
      </Box>

      {/* What it does */}
      <Typography variant="h6" fontWeight={700} mb={1}>What does this app do?</Typography>
      <Typography variant="body2" color="text.secondary" mb={3} maxWidth={700} lineHeight={1.8}>
        GDrive Sync connects your Google Drive (personal and shared drives) to folders on your local machine.
        You create sync profiles that map a Drive folder to a local folder, choose a direction (download, upload, or bidirectional),
        and the app takes care of the rest — comparing files by MD5 checksum, transferring only what changed,
        exporting Google Workspace files to standard formats, and logging every operation.
        Large transfers can be paused and resumed — partial downloads are saved to disk and continued from where they left off.
        Schedules let you automate syncs, and the database backup feature ensures your settings travel with you.
      </Typography>

      <Divider sx={{ opacity: 0.2, mb: 3 }} />

      {/* Features grid */}
      <Typography variant="h6" fontWeight={700} mb={2}>Features</Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 2,
          mb: 4,
        }}
      >
        {features.map((f) => (
          <Box
            key={f.title}
            sx={{
              p: 2.5,
              borderRadius: 2,
              border: (t) => `1.5px solid ${alpha(t.palette.primary.light, 0.35)}`,
              bgcolor: 'background.paper',
              display: 'flex',
              gap: 2,
              alignItems: 'flex-start',
            }}
          >
            <f.icon sx={{ fontSize: 22, color: 'primary.main', mt: 0.25, flexShrink: 0 }} />
            <Box>
              <Typography variant="subtitle2" fontWeight={600} mb={0.25}>{f.title}</Typography>
              <Typography variant="caption" color="text.secondary" lineHeight={1.5}>{f.desc}</Typography>
            </Box>
          </Box>
        ))}
      </Box>

      <Divider sx={{ opacity: 0.2, mb: 3 }} />

      {/* Tech stack */}
      <Typography variant="h6" fontWeight={700} mb={2}>Tech Stack</Typography>
      <Box
        sx={{
          p: 2.5,
          borderRadius: 2,
          border: (t) => `1.5px solid ${alpha(t.palette.primary.light, 0.35)}`,
          bgcolor: 'background.paper',
          maxWidth: 450,
          mb: 4,
        }}
      >
        {[
          ['Desktop', 'Electron 33'],
          ['UI', 'React 18 + Material UI 5'],
          ['Build', 'Vite 6 + TypeScript 5'],
          ['APIs', 'Google Drive API v3 (googleapis)'],
          ['Database', 'SQLite via better-sqlite3'],
          ['Scheduling', 'node-cron'],
          ['Packaging', 'electron-builder'],
          ['Auto-Update', 'electron-updater + GitHub Releases'],
          ['Author', 'Jerome Purushotham'],
        ].map(([label, value]) => (
          <Box key={label} display="flex" gap={2} py={0.5}>
            <Typography variant="caption" color="text.secondary" sx={{ minWidth: 90 }}>{label}</Typography>
            <Typography variant="caption">{value}</Typography>
          </Box>
        ))}
      </Box>

      {/* Update */}
      <Box display="flex" flexDirection="column" gap={1.5} alignItems="flex-start">
        <Button variant="outlined" startIcon={<SystemUpdateIcon />} onClick={checkUpdates} disabled={checking || downloading}>
          {checking ? 'Checking...' : 'Check for Updates'}
        </Button>

        {updateResult && (
          <Typography variant="caption" color={updateVersion ? 'primary.main' : 'text.secondary'} fontWeight={updateVersion ? 600 : 400}>
            {updateResult}
          </Typography>
        )}

        {updateVersion && !downloading && !downloadedPath && (
          <Box display="flex" gap={1}>
            <Button variant="contained" size="small" onClick={handleDownload}>
              Download v{updateVersion}
            </Button>
            <Button variant="outlined" size="small" onClick={() => updateUrl && window.api.app.openExternal(updateUrl)}>
              View on GitHub
            </Button>
          </Box>
        )}

        {downloading && (
          <Box sx={{ width: '100%', maxWidth: 400 }}>
            <Box display="flex" justifyContent="space-between" mb={0.5}>
              <Typography variant="caption" color="text.secondary">Downloading...</Typography>
              <Typography variant="caption" color="primary.main" fontWeight={600}>{downloadProgress}%</Typography>
            </Box>
            <Box sx={{ width: '100%', height: 6, borderRadius: 3, bgcolor: (t) => alpha(t.palette.primary.main, 0.1) }}>
              <Box sx={{ width: `${downloadProgress}%`, height: '100%', borderRadius: 3, bgcolor: 'primary.main', transition: 'width 0.3s' }} />
            </Box>
          </Box>
        )}

        {downloadedPath && (
          <Box
            sx={{
              p: 2,
              borderRadius: 2,
              bgcolor: (t) => alpha(t.palette.success.main, 0.08),
              border: (t) => `1px solid ${alpha(t.palette.success.main, 0.2)}`,
              maxWidth: 450,
            }}
          >
            <Typography variant="body2" color="success.main" fontWeight={600} mb={1}>
              Download complete
            </Typography>
            <Typography variant="caption" color="text.secondary" component="div" lineHeight={1.9}>
              <strong>To install:</strong>
              <ol style={{ margin: '4px 0 0 0', paddingLeft: 16 }}>
                <li>Quit gsync</li>
                <li>Extract the downloaded ZIP file</li>
                <li>Replace <code>/Applications/gsync.app</code> with the new one</li>
                <li>Run: <code>xattr -rc /Applications/gsync.app</code></li>
                <li>Open gsync</li>
              </ol>
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block', wordBreak: 'break-all' }}>
              Downloaded to: {downloadedPath}
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}
