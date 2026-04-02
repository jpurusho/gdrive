import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Chip,
  LinearProgress,
  alpha,
  useTheme,
  IconButton,
  Tooltip,
  keyframes,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import SyncIcon from '@mui/icons-material/Sync';
import ScheduleIcon from '@mui/icons-material/Schedule';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import type { SyncProfile, SyncSession } from '../../../shared/types';

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
`;

const directionIcons: Record<string, React.ElementType> = {
  download: CloudDownloadIcon,
  upload: CloudUploadIcon,
  bidirectional: SyncIcon,
};

function StatusRow({ profile, session, onSync }: { profile: SyncProfile; session?: SyncSession; onSync: () => void }) {
  const theme = useTheme();
  const isActive = session?.status === 'in_progress';
  const isFailed = session?.status === 'failed';
  const isCompleted = session?.status === 'completed';
  const DirIcon = directionIcons[profile.syncDirection];

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        px: 2,
        py: 1,
        borderRadius: 2,
        bgcolor: isActive
          ? alpha(theme.palette.primary.main, 0.06)
          : 'transparent',
        borderLeft: `3px solid ${
          isActive
            ? theme.palette.primary.main
            : isFailed
              ? theme.palette.error.main
              : isCompleted
                ? theme.palette.success.main
                : alpha(theme.palette.divider, 0.3)
        }`,
        transition: 'all 0.3s',
      }}
    >
      <DirIcon sx={{ fontSize: 16, color: 'text.secondary', flexShrink: 0 }} />

      <Box flex={1} minWidth={0}>
        <Box display="flex" alignItems="center" gap={1}>
          <Typography variant="body2" fontWeight={600} noWrap>
            {profile.name}
          </Typography>
          {profile.schedule && (
            <ScheduleIcon sx={{ fontSize: 12, color: 'text.secondary' }} />
          )}
        </Box>

        {isActive && session?.currentFile ? (
          <Box>
            <Typography variant="caption" color="primary.main" noWrap display="block">
              {session.currentFile}
            </Typography>
            {session.totalFiles > 0 && (
              <LinearProgress
                variant="determinate"
                value={((session.filesSynced + session.filesSkipped + session.filesFailed) / session.totalFiles) * 100}
                sx={{ mt: 0.5, height: 2, borderRadius: 1 }}
              />
            )}
          </Box>
        ) : (
          <Typography variant="caption" color="text.secondary" noWrap display="block">
            {isFailed
              ? session?.errorMessage || 'Failed'
              : isCompleted
                ? `${session?.filesSynced} synced, ${session?.filesSkipped} unchanged`
                : profile.lastSyncAt
                  ? `Last: ${new Date(profile.lastSyncAt).toLocaleString()}`
                  : 'Not synced yet'}
          </Typography>
        )}
      </Box>

      {/* Status indicator */}
      <Box flexShrink={0} display="flex" alignItems="center" gap={0.5}>
        {isActive && (
          <SyncIcon sx={{ fontSize: 16, color: 'primary.main', animation: `${pulse} 1.5s ease-in-out infinite` }} />
        )}
        {isCompleted && !isActive && (
          <CheckCircleIcon sx={{ fontSize: 16, color: 'success.main' }} />
        )}
        {isFailed && (
          <ErrorOutlineIcon sx={{ fontSize: 16, color: 'error.main' }} />
        )}
        <Tooltip title="Sync now">
          <IconButton size="small" onClick={onSync} disabled={isActive} sx={{ color: 'text.secondary' }}>
            <PlayArrowIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
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
    <Box
      sx={{
        borderRadius: 2,
        border: (t) => `1px solid ${alpha(t.palette.divider, 0.2)}`,
        bgcolor: 'background.paper',
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          px: 2,
          py: 1,
          borderBottom: (t) => `1px solid ${alpha(t.palette.divider, 0.15)}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Typography variant="subtitle2" fontWeight={600}>
          Sync Status
        </Typography>
        <Chip
          label={`${profiles.length} profile${profiles.length !== 1 ? 's' : ''}`}
          size="small"
          sx={{ height: 20, fontSize: 11 }}
        />
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, p: 1 }}>
        {profiles.map((profile) => (
          <StatusRow
            key={profile.id}
            profile={profile}
            session={sessions[profile.id]}
            onSync={() => handleSync(profile.id)}
          />
        ))}
      </Box>
    </Box>
  );
}
