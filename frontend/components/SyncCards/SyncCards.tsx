import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardActionArea,
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
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import SyncIcon from '@mui/icons-material/Sync';
import FolderIcon from '@mui/icons-material/Folder';
import CloudIcon from '@mui/icons-material/Cloud';
import ScheduleIcon from '@mui/icons-material/Schedule';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import CreateProfileDialog from '../CreateProfileDialog/CreateProfileDialog';
import EditProfileDialog from '../EditProfileDialog/EditProfileDialog';
import type { SyncProfile, SyncSession } from '../../../shared/types';

const borderGlow = keyframes`
  0%, 100% {
    border-color: var(--glow-color);
    box-shadow: inset 0 0 0 1px var(--glow-color), 0 0 12px var(--glow-color-dim), 0 0 4px var(--glow-color-dim);
  }
  50% {
    border-color: var(--glow-bright);
    box-shadow: inset 0 0 0 1px var(--glow-bright), 0 0 24px var(--glow-color), 0 0 8px var(--glow-color);
  }
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
  onClick,
}: {
  profile: SyncProfile;
  session?: SyncSession;
  onDelete: () => void;
  onSync: () => void;
  onClick: () => void;
}) {
  const theme = useTheme();
  const DirIcon = directionIcons[profile.syncDirection];
  const isActive = session?.status === 'in_progress';
  const isFailed = session?.status === 'failed';
  const isCompleted = session?.status === 'completed';

  // Fluorescent glow color — boosted saturation/lightness from theme primary
  const primary = theme.palette.primary.main;
  const secondary = theme.palette.secondary.main;
  const fluorescent = theme.palette.primary.light;

  return (
    <Card
      sx={{
        width: 280,
        flexShrink: 0,
        position: 'relative',
        overflow: 'visible',
        border: `2px solid ${
          isActive
            ? fluorescent
            : isFailed
              ? alpha(theme.palette.error.main, 0.5)
              : isCompleted
                ? alpha(theme.palette.success.main, 0.3)
                : alpha(theme.palette.divider, 0.2)
        }`,
        borderRadius: 3,
        transition: 'transform 0.2s, border-color 0.3s',
        '&:hover': { transform: 'translateY(-2px)' },
        ...(isActive && {
          '--glow-color': alpha(primary, 0.6),
          '--glow-color-dim': alpha(primary, 0.25),
          '--glow-bright': fluorescent,
          animation: `${borderGlow} 1.8s ease-in-out infinite`,
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
      <CardActionArea onClick={onClick} sx={{ p: 0 }}>
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
            <Box display="flex" gap={0.25} onClick={(e) => e.stopPropagation()}>
              <Tooltip title="Sync now">
                <IconButton size="small" onClick={onSync} disabled={isActive}>
                  <PlayArrowIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Edit profile">
                <IconButton size="small" onClick={onClick} sx={{ color: 'text.secondary' }}>
                  <EditIcon sx={{ fontSize: 16 }} />
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

          {/* Active sync status */}
          {isActive && session?.currentFile && (
            <Box mt={1.5} pt={1} sx={{ borderTop: (t) => `1px solid ${alpha(t.palette.divider, 0.2)}` }}>
              <Typography variant="caption" color="primary.main" noWrap>
                {session.currentFile}
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block">
                {session.totalFiles > 0
                  ? `${session.filesSynced + session.filesSkipped + session.filesFailed}/${session.totalFiles} checked — ${session.filesSynced} synced, ${session.filesSkipped} skipped`
                  : 'Scanning...'}
              </Typography>
            </Box>
          )}

          {/* Completed status */}
          {isCompleted && !isActive && (
            <Box mt={1.5} pt={1} sx={{ borderTop: (t) => `1px solid ${alpha(t.palette.divider, 0.2)}` }}>
              <Box display="flex" alignItems="center" gap={0.5}>
                <CheckCircleIcon sx={{ fontSize: 14, color: 'success.main' }} />
                <Typography variant="caption" color="success.main">
                  {session.totalFiles} found — {session.filesSynced} synced, {session.filesSkipped} unchanged
                  {session.filesFailed > 0 && `, ${session.filesFailed} failed`}
                </Typography>
              </Box>
              {session.errorMessage && (
                <Typography variant="caption" color="warning.main" display="block" sx={{ mt: 0.25 }}>
                  {session.errorMessage}
                </Typography>
              )}
            </Box>
          )}

          {/* Failed status */}
          {isFailed && (
            <Box mt={1.5} pt={1} sx={{ borderTop: (t) => `1px solid ${alpha(t.palette.divider, 0.2)}` }}>
              <Box display="flex" alignItems="center" gap={0.5}>
                <ErrorOutlineIcon sx={{ fontSize: 14, color: 'error.main' }} />
                <Typography variant="caption" color="error.main">Sync failed</Typography>
              </Box>
              {session.totalFiles > 0 && (
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.25 }}>
                  {session.totalFiles} found — {session.filesSynced} synced, {session.filesFailed} failed
                </Typography>
              )}
              {session.errorMessage && (
                <Typography variant="caption" color="text.secondary" display="block" noWrap sx={{ mt: 0.25 }}>
                  {session.errorMessage}
                </Typography>
              )}
            </Box>
          )}
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

export default function SyncCards() {
  const theme = useTheme();
  const [profiles, setProfiles] = useState<SyncProfile[]>([]);
  const [sessions, setSessions] = useState<Record<number, SyncSession>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editProfile, setEditProfile] = useState<SyncProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfiles();
    const unsub = window.api.sync.onSyncProgress((session) => {
      setSessions((prev) => ({ ...prev, [session.profileId]: session }));
      // Refresh profile when sync completes to get updated lastSyncAt
      if (session.status === 'completed' || session.status === 'failed') {
        loadProfiles();
      }
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
    setEditProfile(null);
  }

  async function handleSync(profileId: number) {
    await window.api.sync.startSync(profileId);
  }

  function handleCreate(profile: SyncProfile) {
    setProfiles((prev) => [profile, ...prev]);
    // Auto-trigger first sync immediately
    handleSync(profile.id);
  }

  function handleProfileSaved(updated: SyncProfile) {
    setProfiles((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
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
            onClick={() => setEditProfile(profile)}
          />
        ))}
      </Box>

      <CreateProfileDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreate={handleCreate}
      />

      <EditProfileDialog
        open={!!editProfile}
        profile={editProfile}
        onClose={() => setEditProfile(null)}
        onSave={handleProfileSaved}
        onDelete={() => editProfile && handleDelete(editProfile.id)}
        onSync={() => { if (editProfile) { handleSync(editProfile.id); setEditProfile(null); } }}
      />
    </>
  );
}
