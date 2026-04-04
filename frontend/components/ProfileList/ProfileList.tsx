import React from 'react';
import {
  Box,
  Typography,
  List,
  ListItemButton,
  IconButton,
  Tooltip,
  alpha,
  useTheme,
  keyframes,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import SyncIcon from '@mui/icons-material/Sync';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import PauseCircleOutlineIcon from '@mui/icons-material/PauseCircleOutline';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
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
  if (!iso) return 'Never synced';
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

interface Props {
  profiles: SyncProfile[];
  sessions: Record<number, SyncSession>;
  selectedId: number | null;
  onSelect: (id: number) => void;
  onAdd: () => void;
}

export default function ProfileList({ profiles, sessions, selectedId, onSelect, onAdd }: Props) {
  const theme = useTheme();

  return (
    <Box
      sx={{
        width: 260,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        borderRight: (t) => `1.5px solid ${alpha(t.palette.primary.light, 0.2)}`,
        bgcolor: 'background.paper',
      }}
    >
      {/* Header */}
      <Box
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        px={2}
        py={1.25}
        sx={{
          background: (t) => `linear-gradient(135deg, ${alpha(t.palette.primary.main, 0.15)}, ${alpha(t.palette.secondary.main, 0.1)})`,
          borderBottom: (t) => `1px solid ${alpha(t.palette.divider, 0.15)}`,
        }}
      >
        <Typography variant="subtitle2" fontWeight={700}>Profiles</Typography>
        <Tooltip title="Create new profile">
          <IconButton size="small" onClick={onAdd} sx={{ color: 'primary.main' }}>
            <AddIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Profile list */}
      <Box flex={1} overflow="auto">
        {profiles.length === 0 ? (
          <Box p={3} textAlign="center">
            <Typography variant="caption" color="text.secondary">
              No profiles yet
            </Typography>
          </Box>
        ) : (
          <List disablePadding>
            {profiles.map((profile) => {
              const session = sessions[profile.id];
              const isActive = session?.status === 'in_progress';
              const isPaused = session?.status === 'paused';
              const isFailed = session?.status === 'failed';
              const isCompleted = session?.status === 'completed';
              const isSelected = selectedId === profile.id;
              const DirIcon = directionIcons[profile.syncDirection];

              const isProfileInactive = !profile.isActive;

              const borderColor = isProfileInactive
                ? alpha(theme.palette.text.secondary, 0.3)
                : isActive
                  ? theme.palette.primary.main
                  : isPaused
                    ? theme.palette.warning.main
                    : isFailed
                      ? theme.palette.error.main
                      : isCompleted
                        ? theme.palette.success.main
                        : 'transparent';

              return (
                <ListItemButton
                  key={profile.id}
                  selected={isSelected}
                  onClick={() => onSelect(profile.id)}
                  sx={{
                    px: 2,
                    py: 1.25,
                    borderLeft: `3px solid ${borderColor}`,
                    borderBottom: (t) => `1px solid ${alpha(t.palette.divider, 0.08)}`,
                    '&.Mui-selected': {
                      bgcolor: (t) => alpha(t.palette.primary.main, 0.08),
                    },
                  }}
                >
                  <Box flex={1} minWidth={0} sx={{ opacity: isProfileInactive ? 0.5 : 1 }}>
                    <Box display="flex" alignItems="center" gap={0.75} mb={0.25}>
                      <DirIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                      <Typography variant="body2" fontWeight={isSelected ? 600 : 500} noWrap>
                        {profile.name}
                      </Typography>
                      {isProfileInactive && (
                        <Typography variant="caption" color="warning.main" sx={{ fontSize: 10 }}>OFF</Typography>
                      )}
                    </Box>
                    <Box display="flex" alignItems="center" gap={0.75}>
                      {isActive ? (
                        <>
                          <SyncIcon sx={{ fontSize: 12, color: 'primary.main', animation: `${spin} 1.5s linear infinite` }} />
                          <Typography variant="caption" color="primary.main" noWrap>
                            {session?.currentFile ? `${session.filesSynced + session.filesSkipped}/${session.totalFiles}` : 'Syncing...'}
                          </Typography>
                        </>
                      ) : isPaused ? (
                        <>
                          <PauseCircleOutlineIcon sx={{ fontSize: 12, color: 'warning.main' }} />
                          <Typography variant="caption" color="warning.main">Paused</Typography>
                        </>
                      ) : isFailed ? (
                        <>
                          <ErrorOutlineIcon sx={{ fontSize: 12, color: 'error.main' }} />
                          <Typography variant="caption" color="error.main">Failed</Typography>
                        </>
                      ) : isCompleted ? (
                        <>
                          <CheckCircleIcon sx={{ fontSize: 12, color: 'success.main' }} />
                          <Typography variant="caption" color="text.secondary">
                            {formatTime(profile.lastSyncAt)}
                          </Typography>
                        </>
                      ) : (
                        <>
                          <HourglassEmptyIcon sx={{ fontSize: 12, color: 'text.secondary' }} />
                          <Typography variant="caption" color="text.secondary">
                            {formatTime(profile.lastSyncAt)}
                          </Typography>
                        </>
                      )}
                    </Box>
                  </Box>
                </ListItemButton>
              );
            })}
          </List>
        )}
      </Box>
    </Box>
  );
}
