import React from 'react';
import { Box, Typography, alpha, useTheme } from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import SyncIcon from '@mui/icons-material/Sync';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import StorageIcon from '@mui/icons-material/Storage';
import type { SyncProfile, SyncSession } from '../../../shared/types';

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

interface Props {
  profiles: SyncProfile[];
  sessions: Record<number, SyncSession>;
}

export default function StatsBar({ profiles, sessions }: Props) {
  const theme = useTheme();

  const activeCount = Object.values(sessions).filter((s) => s.status === 'in_progress').length;
  const todayFiles = Object.values(sessions)
    .filter((s) => s.completedAt && new Date(s.completedAt).toDateString() === new Date().toDateString())
    .reduce((sum, s) => sum + s.filesSynced, 0);
  const todayBytes = Object.values(sessions)
    .filter((s) => s.completedAt && new Date(s.completedAt).toDateString() === new Date().toDateString())
    .reduce((sum, s) => sum + s.bytesTransferred, 0);

  const stats = [
    { icon: FolderIcon, label: 'Profiles', value: String(profiles.length), color: theme.palette.primary.main },
    { icon: SyncIcon, label: 'Active', value: String(activeCount), color: activeCount > 0 ? theme.palette.success.main : theme.palette.text.secondary },
    { icon: InsertDriveFileIcon, label: 'Files today', value: String(todayFiles), color: theme.palette.info.main || theme.palette.primary.main },
    { icon: StorageIcon, label: 'Transferred', value: formatBytes(todayBytes), color: theme.palette.secondary.main },
  ];

  return (
    <Box
      display="flex"
      gap={3}
      px={2.5}
      py={1}
      sx={{
        background: (t) => `linear-gradient(135deg, ${alpha(t.palette.primary.main, 0.08)}, ${alpha(t.palette.secondary.main, 0.05)})`,
        borderBottom: (t) => `1px solid ${alpha(t.palette.divider, 0.1)}`,
      }}
    >
      {stats.map((s) => (
        <Box key={s.label} display="flex" alignItems="center" gap={1}>
          <s.icon sx={{ fontSize: 16, color: s.color, opacity: 0.8 }} />
          <Typography variant="caption" fontWeight={700} color={s.color}>{s.value}</Typography>
          <Typography variant="caption" color="text.secondary">{s.label}</Typography>
        </Box>
      ))}
    </Box>
  );
}
