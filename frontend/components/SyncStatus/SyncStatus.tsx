import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  LinearProgress,
  alpha,
  useTheme,
  IconButton,
  Tooltip,
  keyframes,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import SyncIcon from '@mui/icons-material/Sync';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import type { SyncProfile, SyncSession } from '../../../shared/types';

const spin = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

const directionIcons: Record<string, React.ElementType> = {
  download: CloudDownloadIcon,
  upload: CloudUploadIcon,
  bidirectional: SyncIcon,
};

function formatTime(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000 && d.getDate() === now.getDate()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function SyncStatus() {
  const theme = useTheme();
  const [profiles, setProfiles] = useState<SyncProfile[]>([]);
  const [sessions, setSessions] = useState<Record<number, SyncSession>>({});

  useEffect(() => {
    loadProfiles();
    const unsub = window.api.sync.onSyncProgress((session) => {
      setSessions((prev) => ({ ...prev, [session.profileId]: session }));
      if (session.status === 'completed' || session.status === 'failed') {
        loadProfiles();
      }
    });
    return unsub;
  }, []);

  async function loadProfiles() {
    const result = await window.api.sync.getProfiles();
    setProfiles(result);
  }

  async function handleSync(profileId: number) {
    await window.api.sync.startSync(profileId);
  }

  if (profiles.length === 0) {
    return (
      <Box
        sx={{
          p: 2,
          borderRadius: 2,
          border: (t) => `1px dashed ${alpha(t.palette.divider, 0.3)}`,
          textAlign: 'center',
        }}
      >
        <Typography variant="body2" color="text.secondary">
          No sync profiles yet. Go to Profiles to create one.
        </Typography>
      </Box>
    );
  }

  return (
    <TableContainer
      sx={{
        borderRadius: 2,
        border: (t) => `1px solid ${alpha(t.palette.divider, 0.2)}`,
        bgcolor: 'background.paper',
        overflow: 'hidden',
      }}
    >
      <Table size="small">
        <TableHead>
          <TableRow
            sx={{
              background: (t) => `linear-gradient(135deg, ${alpha(t.palette.primary.main, 0.15)}, ${alpha(t.palette.secondary.main, 0.1)})`,
            }}
          >
            <TableCell sx={{ fontWeight: 700, fontSize: 12, py: 1.25, borderBottom: (t) => `1px solid ${alpha(t.palette.divider, 0.15)}` }}>Profile</TableCell>
            <TableCell sx={{ fontWeight: 700, fontSize: 12, py: 1.25, borderBottom: (t) => `1px solid ${alpha(t.palette.divider, 0.15)}` }}>Status</TableCell>
            <TableCell sx={{ fontWeight: 700, fontSize: 12, py: 1.25, borderBottom: (t) => `1px solid ${alpha(t.palette.divider, 0.15)}` }}>Last Sync</TableCell>
            <TableCell sx={{ fontWeight: 700, fontSize: 12, py: 1.25, borderBottom: (t) => `1px solid ${alpha(t.palette.divider, 0.15)}` }} align="right">Files</TableCell>
            <TableCell sx={{ fontWeight: 700, fontSize: 12, py: 1.25, borderBottom: (t) => `1px solid ${alpha(t.palette.divider, 0.15)}` }}>Schedule</TableCell>
            <TableCell sx={{ fontWeight: 700, fontSize: 12, py: 1.25, borderBottom: (t) => `1px solid ${alpha(t.palette.divider, 0.15)}` }} align="right" width={40}></TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {profiles.map((profile) => {
            const session = sessions[profile.id];
            const isActive = session?.status === 'in_progress';
            const isFailed = session?.status === 'failed';
            const isCompleted = session?.status === 'completed';
            const DirIcon = directionIcons[profile.syncDirection];

            return (
              <TableRow key={profile.id} hover sx={{ position: 'relative' }}>
                <TableCell sx={{ py: 0.75 }}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <DirIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                    <Typography variant="body2" fontWeight={500} noWrap>{profile.name}</Typography>
                  </Box>
                </TableCell>
                <TableCell sx={{ py: 0.75 }}>
                  {isActive ? (
                    <Box display="flex" alignItems="center" gap={0.75}>
                      <SyncIcon sx={{ fontSize: 14, color: 'primary.main', animation: `${spin} 1.5s linear infinite` }} />
                      <Box flex={1} minWidth={60}>
                        <Typography variant="caption" color="primary.main" noWrap display="block" sx={{ maxWidth: 150 }}>
                          {session?.currentFile || 'Syncing...'}
                        </Typography>
                        {session && session.totalFiles > 0 && (
                          <LinearProgress
                            variant="determinate"
                            value={((session.filesSynced + session.filesSkipped + session.filesFailed) / session.totalFiles) * 100}
                            sx={{ mt: 0.25, height: 2, borderRadius: 1 }}
                          />
                        )}
                      </Box>
                    </Box>
                  ) : isFailed ? (
                    <Chip
                      icon={<ErrorOutlineIcon sx={{ fontSize: '14px !important' }} />}
                      label="Failed"
                      size="small"
                      color="error"
                      variant="outlined"
                      sx={{ height: 22, fontSize: 11 }}
                    />
                  ) : isCompleted ? (
                    <Chip
                      icon={<CheckCircleIcon sx={{ fontSize: '14px !important' }} />}
                      label="Synced"
                      size="small"
                      color="success"
                      variant="outlined"
                      sx={{ height: 22, fontSize: 11 }}
                    />
                  ) : (
                    <Chip
                      icon={<HourglassEmptyIcon sx={{ fontSize: '14px !important' }} />}
                      label="Idle"
                      size="small"
                      variant="outlined"
                      sx={{ height: 22, fontSize: 11 }}
                    />
                  )}
                </TableCell>
                <TableCell sx={{ py: 0.75 }}>
                  <Typography variant="caption" color="text.secondary">
                    {formatTime(profile.lastSyncAt)}
                  </Typography>
                </TableCell>
                <TableCell sx={{ py: 0.75 }} align="right">
                  {isCompleted && session ? (
                    <Typography variant="caption" color="text.secondary">
                      {session.filesSynced}/{session.totalFiles}
                    </Typography>
                  ) : isActive && session && session.totalFiles > 0 ? (
                    <Typography variant="caption" color="primary.main">
                      {session.filesSynced + session.filesSkipped + session.filesFailed}/{session.totalFiles}
                    </Typography>
                  ) : (
                    <Typography variant="caption" color="text.secondary">—</Typography>
                  )}
                </TableCell>
                <TableCell sx={{ py: 0.75 }}>
                  <Typography variant="caption" color="text.secondary">
                    {profile.schedule || 'Manual'}
                  </Typography>
                </TableCell>
                <TableCell sx={{ py: 0.75 }} align="right">
                  <Tooltip title="Sync now">
                    <IconButton size="small" onClick={() => handleSync(profile.id)} disabled={isActive} sx={{ color: 'text.secondary' }}>
                      <PlayArrowIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
