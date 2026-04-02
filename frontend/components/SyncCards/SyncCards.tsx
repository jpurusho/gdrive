import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  IconButton,
  Chip,
  Tooltip,
  LinearProgress,
  alpha,
  useTheme,
  keyframes,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import SyncIcon from '@mui/icons-material/Sync';
import FolderIcon from '@mui/icons-material/Folder';
import CloudIcon from '@mui/icons-material/Cloud';
import ScheduleIcon from '@mui/icons-material/Schedule';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import CreateProfileDialog from '../CreateProfileDialog/CreateProfileDialog';
import type { SyncProfile, SyncSession } from '../../../shared/types';

const glowPulse = keyframes`
  0%, 100% { box-shadow: 0 0 8px var(--glow-color), 0 0 20px var(--glow-color); }
  50% { box-shadow: 0 0 16px var(--glow-color), 0 0 40px var(--glow-color); }
`;

const directionIcons = {
  download: CloudDownloadIcon,
  upload: CloudUploadIcon,
  bidirectional: SyncIcon,
};

const directionLabels = {
  download: 'Download',
  upload: 'Upload',
  bidirectional: 'Bidirectional',
};

function ProfileCard({
  profile,
  session,
  onDelete,
  onSync,
}: {
  profile: SyncProfile;
  session?: SyncSession;
  onDelete: () => void;
  onSync: () => void;
}) {
  const theme = useTheme();
  const DirIcon = directionIcons[profile.syncDirection];
  const isActive = session?.status === 'in_progress';
  const glowColor = alpha(theme.palette.primary.main, 0.4);

  return (
    <Card
      sx={{
        width: 280,
        flexShrink: 0,
        position: 'relative',
        overflow: 'visible',
        border: `1px solid ${alpha(theme.palette.divider, 0.3)}`,
        borderRadius: 3,
        transition: 'transform 0.2s, box-shadow 0.2s',
        '&:hover': { transform: 'translateY(-2px)' },
        ...(isActive && {
          '--glow-color': glowColor,
          animation: `${glowPulse} 2s ease-in-out infinite`,
          border: `1px solid ${alpha(theme.palette.primary.main, 0.5)}`,
        } as any),
      }}
    >
      {isActive && (
        <LinearProgress
          variant={session?.totalBytes ? 'determinate' : 'indeterminate'}
          value={session?.totalBytes ? (session.bytesTransferred / session.totalBytes) * 100 : undefined}
          sx={{ position: 'absolute', top: 0, left: 0, right: 0, borderRadius: '12px 12px 0 0', height: 3 }}
        />
      )}
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Box display="flex" alignItems="flex-start" justifyContent="space-between" mb={1.5}>
          <Box>
            <Typography variant="subtitle2" fontWeight={600} noWrap sx={{ maxWidth: 180 }}>
              {profile.name}
            </Typography>
            <Chip
              icon={<DirIcon sx={{ fontSize: '14px !important' }} />}
              label={directionLabels[profile.syncDirection]}
              size="small"
              sx={{ height: 22, fontSize: 11, mt: 0.5 }}
            />
          </Box>
          <Box display="flex" gap={0.25}>
            <Tooltip title="Sync now">
              <IconButton size="small" onClick={onSync} disabled={isActive}>
                <PlayArrowIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Delete">
              <IconButton size="small" onClick={onDelete} disabled={isActive} sx={{ color: 'text.secondary' }}>
                <DeleteOutlineIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        <Box display="flex" flexDirection="column" gap={0.75}>
          <Box display="flex" alignItems="center" gap={0.75}>
            <CloudIcon sx={{ fontSize: 14, color: 'primary.main' }} />
            <Typography variant="caption" color="text.secondary" noWrap title={`${profile.driveName}: ${profile.driveFolderPath}`}>
              {profile.driveName}: {profile.driveFolderPath}
            </Typography>
          </Box>
          <Box display="flex" alignItems="center" gap={0.75}>
            <FolderIcon sx={{ fontSize: 14, color: 'warning.main' }} />
            <Typography variant="caption" color="text.secondary" noWrap title={profile.localPath}>
              {profile.localPath}
            </Typography>
          </Box>
          {profile.schedule && (
            <Box display="flex" alignItems="center" gap={0.75}>
              <ScheduleIcon sx={{ fontSize: 14, color: 'secondary.main' }} />
              <Typography variant="caption" color="text.secondary">
                {profile.schedule}
              </Typography>
            </Box>
          )}
          {profile.lastSyncAt && (
            <Box display="flex" alignItems="center" gap={0.75}>
              <AccessTimeIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
              <Typography variant="caption" color="text.secondary">
                Last: {new Date(profile.lastSyncAt).toLocaleString()}
              </Typography>
            </Box>
          )}
        </Box>

        {isActive && session?.currentFile && (
          <Box mt={1.5} pt={1} sx={{ borderTop: (t) => `1px solid ${alpha(t.palette.divider, 0.2)}` }}>
            <Typography variant="caption" color="primary.main" noWrap>
              Syncing: {session.currentFile}
            </Typography>
            {session.totalBytes > 0 && (
              <Typography variant="caption" color="text.secondary" display="block">
                {Math.round((session.bytesTransferred / session.totalBytes) * 100)}% — {session.filesSynced} files done
              </Typography>
            )}
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

export default function SyncCards() {
  const theme = useTheme();
  const [profiles, setProfiles] = useState<SyncProfile[]>([]);
  const [sessions, setSessions] = useState<Record<number, SyncSession>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfiles();
    const unsub = window.api.sync.onSyncProgress((session) => {
      setSessions((prev) => ({ ...prev, [session.profileId]: session }));
    });
    return unsub;
  }, []);

  async function loadProfiles() {
    try {
      const result = await window.api.sync.getProfiles();
      setProfiles(result);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: number) {
    await window.api.sync.deleteProfile(id);
    setProfiles((prev) => prev.filter((p) => p.id !== id));
  }

  async function handleSync(profileId: number) {
    await window.api.sync.startSync(profileId);
  }

  function handleCreate(profile: SyncProfile) {
    setProfiles((prev) => [profile, ...prev]);
  }

  if (loading) return null;

  return (
    <>
      <Box
        sx={{
          minHeight: 140,
          display: 'flex',
          gap: 2,
          overflowX: 'auto',
          pb: 1,
          alignItems: 'stretch',
        }}
      >
        {/* Add card */}
        <Card
          sx={{
            width: 280,
            flexShrink: 0,
            border: (t) => `1px dashed ${alpha(t.palette.divider, 0.4)}`,
            borderRadius: 3,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s',
            '&:hover': {
              borderColor: theme.palette.primary.main,
              bgcolor: alpha(theme.palette.primary.main, 0.04),
            },
          }}
          onClick={() => setDialogOpen(true)}
        >
          <Box display="flex" flexDirection="column" alignItems="center" gap={1} p={3}>
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: alpha(theme.palette.primary.main, 0.1),
              }}
            >
              <AddIcon sx={{ color: 'primary.main' }} />
            </Box>
            <Typography variant="body2" color="text.secondary" fontWeight={500}>
              New Sync Profile
            </Typography>
          </Box>
        </Card>

        {/* Profile cards */}
        {profiles.map((profile) => (
          <ProfileCard
            key={profile.id}
            profile={profile}
            session={sessions[profile.id]}
            onDelete={() => handleDelete(profile.id)}
            onSync={() => handleSync(profile.id)}
          />
        ))}
      </Box>

      <CreateProfileDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreate={handleCreate}
      />
    </>
  );
}
