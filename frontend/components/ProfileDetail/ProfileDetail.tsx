import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Button,
  Chip,
  LinearProgress,
  Divider,
  Switch,
  Tooltip,
  Collapse,
  TextField,
  IconButton,
  alpha,
  useTheme,
  keyframes,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import SortIcon from '@mui/icons-material/Sort';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import SyncIcon from '@mui/icons-material/Sync';
import CloudIcon from '@mui/icons-material/Cloud';
import FolderIcon from '@mui/icons-material/Folder';
import ScheduleIcon from '@mui/icons-material/Schedule';
import FilterListIcon from '@mui/icons-material/FilterList';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import PauseCircleOutlineIcon from '@mui/icons-material/PauseCircleOutline';
import EditProfileDialog from '../EditProfileDialog/EditProfileDialog';
import FileLogDialog from '../FileLogDialog/FileLogDialog';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import type { SyncProfile, SyncSession, SyncFileEntry } from '../../../shared/types';

const directionLabels: Record<string, string> = { download: 'Download', upload: 'Upload', bidirectional: 'Bidirectional' };
const directionIcons: Record<string, React.ElementType> = { download: CloudDownloadIcon, upload: CloudUploadIcon, bidirectional: SyncIcon };

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatDuration(start: string, end?: string): string {
  if (!end) return 'running...';
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 1000) return '<1s';
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  return `${Math.round(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

interface Props {
  profile: SyncProfile;
  session?: SyncSession;
  onSync: () => void;
  onPause: () => void;
  onDelete: () => void;
  onToggleActive: (active: boolean) => void;
  onUpdated: (updated: SyncProfile) => void;
}

export default function ProfileDetail({ profile, session, onSync, onPause, onDelete, onToggleActive, onUpdated }: Props) {
  const theme = useTheme();
  const DirIcon = directionIcons[profile.syncDirection];
  const isActive = session?.status === 'in_progress';
  const isCancelled = session?.status === 'cancelled';
  const isFailed = session?.status === 'failed';
  const isCompleted = session?.status === 'completed';
  const [editOpen, setEditOpen] = useState(false);
  const [recentSessions, setRecentSessions] = useState<SyncSession[]>([]);
  const [fileLogSessionId, setFileLogSessionId] = useState<number | null>(null);
  const [syncedFiles, setSyncedFiles] = useState<SyncFileEntry[]>([]);
  const [filesExpanded, setFilesExpanded] = useState(true);
  const [filesFilter, setFilesFilter] = useState('');
  const [filesSort, setFilesSort] = useState<'name' | 'size' | 'status'>('name');
  const [filesSortDir, setFilesSortDir] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    window.api.sync.getSessions(profile.id).then((sessions) => {
      setRecentSessions(sessions);
      // Load file logs from latest completed session
      const latest = sessions.find((s) => s.status === 'completed');
      if (latest) {
        window.api.sync.getFileLogs(latest.id).then(setSyncedFiles);
      } else {
        setSyncedFiles([]);
      }
    });
  }, [profile.id, session?.status]);

  const progress = session && session.totalFiles > 0
    ? ((session.filesSynced + session.filesSkipped + session.filesFailed) / session.totalFiles) * 100
    : 0;

  return (
    <Box flex={1} display="flex" flexDirection="column" overflow="hidden">
      {/* Header */}
      <Box
        px={3}
        py={1.5}
        sx={{
          background: (t) => `linear-gradient(135deg, ${alpha(t.palette.primary.main, 0.12)}, ${alpha(t.palette.secondary.main, 0.08)})`,
          borderBottom: (t) => `1px solid ${alpha(t.palette.divider, 0.15)}`,
        }}
      >
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center" gap={1.5}>
            <DirIcon sx={{ fontSize: 22, color: profile.isActive ? 'primary.main' : 'text.secondary' }} />
            <Box>
              <Box display="flex" alignItems="center" gap={1}>
                <Typography variant="h6" fontWeight={700} lineHeight={1.2} sx={{ opacity: profile.isActive ? 1 : 0.5 }}>
                  {profile.name}
                </Typography>
                {!profile.isActive && (
                  <Chip label="Paused" size="small" color="warning" variant="outlined" sx={{ height: 20, fontSize: 10 }} />
                )}
              </Box>
              <Typography variant="caption" color="text.secondary">
                {directionLabels[profile.syncDirection]} {profile.schedule ? `· ${profile.schedule}` : '· Manual'}
              </Typography>
            </Box>
            <Tooltip title={profile.isActive ? 'Pause auto-sync' : 'Resume auto-sync'}>
              <Switch
                size="small"
                checked={profile.isActive}
                onChange={(e) => onToggleActive(e.target.checked)}
              />
            </Tooltip>
          </Box>
          <Box display="flex" gap={1}>
            {isActive ? (
              <Button size="small" variant="outlined" color="error" startIcon={<PauseIcon />} onClick={onPause}>
                Stop
              </Button>
            ) : (
              <Button size="small" variant="contained" startIcon={<PlayArrowIcon />} onClick={onSync} disabled={!profile.isActive}>
                Sync Now
              </Button>
            )}
            <Button size="small" variant="outlined" startIcon={<EditIcon />} onClick={() => setEditOpen(true)}>
              Edit
            </Button>
            <Button size="small" variant="outlined" color="error" startIcon={<DeleteOutlineIcon />} onClick={onDelete} disabled={isActive}>
              Delete
            </Button>
          </Box>
        </Box>
      </Box>

      {/* Content */}
      <Box flex={1} overflow="auto" px={3} py={2}>
        {/* Status section */}
        {isActive && session && (
          <Box mb={3}>
            <Typography variant="subtitle2" fontWeight={600} mb={1}>Sync Progress</Typography>
            <Box
              sx={{
                p: 2,
                borderRadius: 2,
                bgcolor: alpha(theme.palette.primary.main, 0.05),
                border: `1.5px solid ${alpha(theme.palette.primary.light, 0.3)}`,
              }}
            >
              <Box display="flex" justifyContent="space-between" mb={0.5}>
                <Typography variant="caption" color="primary.main" fontWeight={600}>
                  {session.currentFile || 'Scanning...'}
                </Typography>
                <Typography variant="caption" color="primary.main" fontWeight={700}>
                  {Math.round(progress)}%
                </Typography>
              </Box>
              <LinearProgress variant="determinate" value={progress} sx={{ height: 6, borderRadius: 3, mb: 1 }} />
              <Typography variant="caption" color="text.secondary">
                {session.filesSynced} synced · {session.filesSkipped} skipped · {session.filesFailed} failed · {formatBytes(session.bytesTransferred)}
              </Typography>
            </Box>
          </Box>
        )}

        {isCancelled && session && (
          <Box mb={3}>
            <Box
              sx={{
                p: 2, borderRadius: 2,
                bgcolor: alpha(theme.palette.warning.main, 0.05),
                border: `1.5px solid ${alpha(theme.palette.warning.main, 0.3)}`,
                display: 'flex', alignItems: 'center', gap: 1,
              }}
            >
              <PauseCircleOutlineIcon sx={{ color: 'warning.main' }} />
              <Box>
                <Typography variant="body2" fontWeight={600} color="warning.main">Stopped</Typography>
                <Typography variant="caption" color="text.secondary">
                  {session.filesSynced} synced, {session.filesSkipped} skipped. Click Sync Now to restart.
                </Typography>
              </Box>
            </Box>
          </Box>
        )}

        {isFailed && session && (
          <Box mb={3}>
            <Box
              sx={{
                p: 2, borderRadius: 2,
                bgcolor: alpha(theme.palette.error.main, 0.05),
                border: `1.5px solid ${alpha(theme.palette.error.main, 0.3)}`,
                display: 'flex', alignItems: 'center', gap: 1,
              }}
            >
              <ErrorOutlineIcon sx={{ color: 'error.main' }} />
              <Box>
                <Typography variant="body2" fontWeight={600} color="error.main">Sync Failed</Typography>
                <Typography variant="caption" color="text.secondary">{session.errorMessage || 'Unknown error'}</Typography>
              </Box>
            </Box>
          </Box>
        )}

        {isCompleted && session && !isActive && (
          <Box mb={3}>
            <Box
              sx={{
                p: 2, borderRadius: 2,
                bgcolor: alpha(theme.palette.success.main, 0.05),
                border: `1.5px solid ${alpha(theme.palette.success.main, 0.2)}`,
                display: 'flex', alignItems: 'center', gap: 1,
              }}
            >
              <CheckCircleIcon sx={{ color: 'success.main' }} />
              <Box>
                <Typography variant="body2" fontWeight={600} color="success.main">Last sync completed</Typography>
                <Typography variant="caption" color="text.secondary">
                  {session.totalFiles} found · {session.filesSynced} synced · {session.filesSkipped} unchanged · {formatBytes(session.bytesTransferred)}
                </Typography>
              </Box>
            </Box>
          </Box>
        )}

        {/* Configuration */}
        <Typography variant="subtitle2" fontWeight={600} mb={1.5}>Configuration</Typography>
        <Box
          sx={{
            p: 2, borderRadius: 2, mb: 3,
            border: (t) => `1.5px solid ${alpha(t.palette.primary.light, 0.2)}`,
            display: 'flex', flexDirection: 'column', gap: 1,
          }}
        >
          <Box display="flex" alignItems="center" gap={1.5}>
            <CloudIcon sx={{ fontSize: 16, color: 'primary.main' }} />
            <Typography variant="body2" color="text.secondary">{profile.driveName}: {profile.driveFolderPath}</Typography>
          </Box>
          <Box display="flex" alignItems="center" gap={1.5}>
            <FolderIcon sx={{ fontSize: 16, color: 'warning.main' }} />
            <Typography variant="body2" color="text.secondary">{profile.localPath}</Typography>
          </Box>
          <Box display="flex" alignItems="center" gap={1.5}>
            <DirIcon sx={{ fontSize: 16, color: 'secondary.main' }} />
            <Typography variant="body2" color="text.secondary">{directionLabels[profile.syncDirection]}</Typography>
            {profile.useSourceFolderName && (
              <Chip label="Source folder" size="small" variant="outlined" sx={{ height: 20, fontSize: 10 }} />
            )}
            {profile.convertHeicToJpeg && (
              <Chip label="HEIC→JPEG" size="small" variant="outlined" sx={{ height: 20, fontSize: 10 }} />
            )}
            {profile.mirrorMode && (
              <Chip label="Mirror" size="small" color="warning" variant="outlined" sx={{ height: 20, fontSize: 10 }} />
            )}
          </Box>
          {profile.schedule && (
            <Box display="flex" alignItems="center" gap={1.5}>
              <ScheduleIcon sx={{ fontSize: 16, color: 'info.main' }} />
              <Typography variant="body2" color="text.secondary">{profile.schedule}</Typography>
            </Box>
          )}
          {profile.fileFilter && (
            <Box display="flex" alignItems="center" gap={1.5}>
              <FilterListIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
              <Typography variant="body2" color="text.secondary">{profile.fileFilter}</Typography>
            </Box>
          )}
        </Box>

        {/* Synced files list */}
        {syncedFiles.length > 0 && (
          <Box mb={3}>
            <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
              <Box display="flex" alignItems="center" gap={1} sx={{ cursor: 'pointer' }} onClick={() => setFilesExpanded(!filesExpanded)}>
                {filesExpanded ? <ExpandLessIcon sx={{ fontSize: 18, color: 'text.secondary' }} /> : <ExpandMoreIcon sx={{ fontSize: 18, color: 'text.secondary' }} />}
                <Typography variant="subtitle2" fontWeight={600}>Synced Files</Typography>
                <Chip label={syncedFiles.length} size="small" sx={{ height: 20, fontSize: 10 }} />
              </Box>
              {filesExpanded && (
                <Box display="flex" gap={0.5}>
                  <Tooltip title={`Sort by ${filesSort === 'name' ? 'size' : filesSort === 'size' ? 'status' : 'name'}`}>
                    <IconButton size="small" onClick={() => {
                      if (filesSort === 'name') { setFilesSort('size'); setFilesSortDir('desc'); }
                      else if (filesSort === 'size') { setFilesSort('status'); setFilesSortDir('asc'); }
                      else { setFilesSort('name'); setFilesSortDir('asc'); }
                    }}>
                      <SortIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                    </IconButton>
                  </Tooltip>
                </Box>
              )}
            </Box>
            <Collapse in={filesExpanded}>
              <TextField
                size="small"
                placeholder="Filter files..."
                value={filesFilter}
                onChange={(e) => setFilesFilter(e.target.value)}
                fullWidth
                sx={{ mb: 1, '& .MuiInputBase-input': { fontSize: 12, py: 0.75 } }}
              />
              <Box
                sx={{
                  maxHeight: 200,
                  overflow: 'auto',
                  borderRadius: 2,
                  border: (t) => `1.5px solid ${alpha(t.palette.primary.light, 0.2)}`,
                }}
              >
                {syncedFiles
                  .filter((f) => !filesFilter || f.fileName.toLowerCase().includes(filesFilter.toLowerCase()) || f.filePath.toLowerCase().includes(filesFilter.toLowerCase()))
                  .sort((a, b) => {
                    let cmp = 0;
                    if (filesSort === 'name') cmp = a.fileName.localeCompare(b.fileName);
                    else if (filesSort === 'size') cmp = a.fileSize - b.fileSize;
                    else cmp = a.status.localeCompare(b.status);
                    return filesSortDir === 'asc' ? cmp : -cmp;
                  })
                  .map((f) => (
                    <Box
                      key={f.id}
                      display="flex"
                      alignItems="center"
                      gap={1}
                      px={1.5}
                      py={0.5}
                      sx={{ borderBottom: (t: any) => `1px solid ${alpha(t.palette.divider, 0.06)}`, '&:last-child': { borderBottom: 'none' } }}
                    >
                      {f.direction === 'download' ? <CloudDownloadIcon sx={{ fontSize: 12, color: 'primary.main' }} /> : <CloudUploadIcon sx={{ fontSize: 12, color: 'secondary.main' }} />}
                      <Typography variant="caption" flex={1} noWrap title={f.filePath}>{f.fileName}</Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ minWidth: 50, textAlign: 'right' }}>{formatBytes(f.fileSize)}</Typography>
                      {f.status === 'completed' ? (
                        <CheckCircleIcon sx={{ fontSize: 12, color: 'success.main' }} />
                      ) : f.status === 'skipped' ? (
                        <SkipNextIcon sx={{ fontSize: 12, color: 'text.secondary' }} />
                      ) : (
                        <ErrorOutlineIcon sx={{ fontSize: 12, color: 'error.main' }} />
                      )}
                    </Box>
                  ))}
              </Box>
              <Typography variant="caption" color="text.secondary" mt={0.5} display="block">
                Sort: {filesSort} ({filesSortDir}) · Click header to collapse
              </Typography>
            </Collapse>
          </Box>
        )}

        {/* Recent activity for this profile */}
        <Typography variant="subtitle2" fontWeight={600} mb={1.5}>Recent Activity</Typography>
        {recentSessions.length === 0 ? (
          <Typography variant="caption" color="text.secondary">No sync history yet.</Typography>
        ) : (
          <Box
            sx={{
              borderRadius: 2,
              border: (t) => `1.5px solid ${alpha(t.palette.primary.light, 0.2)}`,
              overflow: 'hidden',
            }}
          >
            {recentSessions.slice(0, 8).map((s, i) => (
              <Box
                key={s.id}
                display="flex"
                alignItems="center"
                gap={2}
                px={2}
                py={0.75}
                onClick={() => setFileLogSessionId(s.id)}
                sx={{
                  cursor: 'pointer',
                  '&:hover': { bgcolor: (t: any) => alpha(t.palette.primary.main, 0.04) },
                  borderBottom: i < Math.min(recentSessions.length, 8) - 1
                    ? (t: any) => `1px solid ${alpha(t.palette.divider, 0.08)}`
                    : 'none',
                }}
              >
                {s.status === 'completed' ? (
                  <CheckCircleIcon sx={{ fontSize: 14, color: 'success.main' }} />
                ) : s.status === 'failed' ? (
                  <ErrorOutlineIcon sx={{ fontSize: 14, color: 'error.main' }} />
                ) : s.status === 'paused' ? (
                  <PauseCircleOutlineIcon sx={{ fontSize: 14, color: 'warning.main' }} />
                ) : (
                  <SyncIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                )}
                <Typography variant="caption" color="text.secondary" sx={{ minWidth: 60 }}>
                  {new Date(s.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Typography>
                <Typography variant="caption" color="text.secondary" flex={1}>
                  {s.filesSynced} synced, {s.filesSkipped} skip{s.filesFailed > 0 ? `, ${s.filesFailed} fail` : ''}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {formatBytes(s.bytesTransferred)}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ minWidth: 40 }}>
                  {formatDuration(s.startedAt, s.completedAt)}
                </Typography>
              </Box>
            ))}
          </Box>
        )}
      </Box>

      <EditProfileDialog
        open={editOpen}
        profile={profile}
        onClose={() => setEditOpen(false)}
        onSave={(updated) => { onUpdated(updated); setEditOpen(false); }}
        onDelete={() => { onDelete(); setEditOpen(false); }}
        onSync={() => { onSync(); setEditOpen(false); }}
      />

      <FileLogDialog
        open={fileLogSessionId !== null}
        onClose={() => setFileLogSessionId(null)}
        title={`Files — ${profile.name}`}
        sessionIds={fileLogSessionId !== null ? [fileLogSessionId] : []}
      />
    </Box>
  );
}
