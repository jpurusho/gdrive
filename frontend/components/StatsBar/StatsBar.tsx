import React, { useState } from 'react';
import { Box, Typography, alpha, useTheme, Tooltip } from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import SyncIcon from '@mui/icons-material/Sync';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import StorageIcon from '@mui/icons-material/Storage';
import FileLogDialog from '../FileLogDialog/FileLogDialog';
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
  const [fileDialogOpen, setFileDialogOpen] = useState(false);

  const activeCount = Object.values(sessions).filter((s) => s.status === 'in_progress').length;

  const todaySessions = Object.values(sessions)
    .filter((s) => s.completedAt && new Date(s.completedAt).toDateString() === new Date().toDateString());
  const todayFiles = todaySessions.reduce((sum, s) => sum + s.filesSynced, 0);
  const todayBytes = todaySessions.reduce((sum, s) => sum + s.bytesTransferred, 0);
  const todaySessionIds = todaySessions.map((s) => s.id);

  return (
    <>
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
        <Box display="flex" alignItems="center" gap={1}>
          <FolderIcon sx={{ fontSize: 16, color: theme.palette.primary.main, opacity: 0.8 }} />
          <Typography variant="caption" fontWeight={700} color={theme.palette.primary.main}>{profiles.length}</Typography>
          <Typography variant="caption" color="text.secondary">Profiles</Typography>
        </Box>
        <Box display="flex" alignItems="center" gap={1}>
          <SyncIcon sx={{ fontSize: 16, color: activeCount > 0 ? theme.palette.success.main : 'text.secondary', opacity: 0.8 }} />
          <Typography variant="caption" fontWeight={700} color={activeCount > 0 ? theme.palette.success.main : 'text.secondary'}>{activeCount}</Typography>
          <Typography variant="caption" color="text.secondary">Active</Typography>
        </Box>
        <Tooltip title={todayFiles > 0 ? 'Click to see synced files' : ''}>
          <Box
            display="flex"
            alignItems="center"
            gap={1}
            onClick={() => todayFiles > 0 && setFileDialogOpen(true)}
            sx={{ cursor: todayFiles > 0 ? 'pointer' : 'default', '&:hover': todayFiles > 0 ? { opacity: 0.7 } : {} }}
          >
            <InsertDriveFileIcon sx={{ fontSize: 16, color: theme.palette.info?.main || theme.palette.primary.main, opacity: 0.8 }} />
            <Typography variant="caption" fontWeight={700} color={theme.palette.info?.main || theme.palette.primary.main}>{todayFiles}</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ textDecoration: todayFiles > 0 ? 'underline' : 'none' }}>Files today</Typography>
          </Box>
        </Tooltip>
        <Box display="flex" alignItems="center" gap={1}>
          <StorageIcon sx={{ fontSize: 16, color: theme.palette.secondary.main, opacity: 0.8 }} />
          <Typography variant="caption" fontWeight={700} color={theme.palette.secondary.main}>{formatBytes(todayBytes)}</Typography>
          <Typography variant="caption" color="text.secondary">Transferred</Typography>
        </Box>
      </Box>

      <FileLogDialog
        open={fileDialogOpen}
        onClose={() => setFileDialogOpen(false)}
        title="Files Synced Today"
        sessionIds={todaySessionIds}
      />
    </>
  );
}
