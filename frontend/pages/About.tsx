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
import StorageIcon from '@mui/icons-material/Storage';
import ScheduleIcon from '@mui/icons-material/Schedule';
import PaletteIcon from '@mui/icons-material/Palette';
import BackupIcon from '@mui/icons-material/Backup';
import { useAppSettings } from '../context/AppSettingsContext';

const features = [
  { icon: CloudSyncIcon, title: 'Bidirectional Sync', desc: 'Download, upload, or sync both ways between Google Drive and local folders' },
  { icon: SecurityIcon, title: 'MD5 Checksums', desc: 'Verifies file integrity with hash comparison — only transfers changed files' },
  { icon: SpeedIcon, title: 'Streaming Transfers', desc: 'Efficient streaming downloads and uploads with real-time progress tracking' },
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

  useEffect(() => {
    window.api.app.getVersion().then(setVersion);
    window.api.app.getPlatform().then(setPlatform);
  }, []);

  async function checkUpdates() {
    setChecking(true);
    try { await window.api.app.checkForUpdates(); } finally { setChecking(false); }
  }

  return (
    <Box flex={1} overflow="auto" px={4} py={3}>
      {/* Hero */}
      <Box
        sx={{
          p: 4,
          borderRadius: 3,
          background: (t) => `linear-gradient(135deg, ${alpha(t.palette.primary.main, 0.1)}, ${alpha(t.palette.secondary.main, 0.08)})`,
          border: (t) => `1px solid ${alpha(t.palette.divider, 0.15)}`,
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
              border: (t) => `1px solid ${alpha(t.palette.divider, 0.15)}`,
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
          border: (t) => `1px solid ${alpha(t.palette.divider, 0.15)}`,
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
      <Button variant="outlined" startIcon={<SystemUpdateIcon />} onClick={checkUpdates} disabled={checking}>
        {checking ? 'Checking...' : 'Check for Updates'}
      </Button>
    </Box>
  );
}
