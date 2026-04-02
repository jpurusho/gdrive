import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  alpha,
  Card,
  CardActionArea,
  Chip,
  Button,
  Divider,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SystemUpdateIcon from '@mui/icons-material/SystemUpdate';
import BackupIcon from '@mui/icons-material/Backup';
import RestoreIcon from '@mui/icons-material/Restore';
import SyncProblemIcon from '@mui/icons-material/SyncProblem';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import SyncIcon from '@mui/icons-material/Sync';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import { useThemeContext } from '../theme/ThemeContext';
import { useAppSettings } from '../context/AppSettingsContext';
import EditProfileDialog from '../components/EditProfileDialog/EditProfileDialog';
import type { ThemeDefinition } from '../theme/themes';
import type { SyncProfile, BackupInfo } from '../../shared/types';

const directionIcons: Record<string, React.ElementType> = {
  download: CloudDownloadIcon,
  upload: CloudUploadIcon,
  bidirectional: SyncIcon,
};

function ThemeCard({ def, selected, onSelect }: { def: ThemeDefinition; selected: boolean; onSelect: () => void }) {
  const { colors, mode } = def;
  return (
    <Card
      variant="outlined"
      sx={{
        width: 200,
        overflow: 'hidden',
        border: selected ? `2px solid ${colors.primary}` : undefined,
        boxShadow: selected ? `0 0 16px ${alpha(colors.primary, 0.3)}` : undefined,
        transition: 'all 0.2s ease',
      }}
    >
      <CardActionArea onClick={onSelect} sx={{ p: 0 }}>
        <Box sx={{ background: colors.background, p: 1.5, position: 'relative' }}>
          {selected && (
            <CheckCircleIcon sx={{ position: 'absolute', top: 6, right: 6, fontSize: 18, color: colors.primary }} />
          )}
          <Box display="flex" gap={0.75} mb={1}>
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#ff5f57' }} />
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#febc2e' }} />
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#28c840' }} />
          </Box>
          <Box display="flex" gap={1} height={50}>
            <Box sx={{ width: 40, bgcolor: colors.paper, borderRadius: 0.75, p: 0.5 }}>
              <Box sx={{ width: '100%', height: 4, bgcolor: colors.primary, borderRadius: 0.5, mb: 0.5 }} />
              <Box sx={{ width: '100%', height: 3, bgcolor: alpha(colors.textSecondary, 0.3), borderRadius: 0.5, mb: 0.5 }} />
              <Box sx={{ width: '100%', height: 3, bgcolor: alpha(colors.textSecondary, 0.3), borderRadius: 0.5 }} />
            </Box>
            <Box sx={{ flex: 1, bgcolor: colors.paper, borderRadius: 0.75, p: 0.5 }}>
              <Box sx={{ width: '60%', height: 4, bgcolor: colors.text, borderRadius: 0.5, mb: 0.5, opacity: 0.7 }} />
              <Box sx={{ width: '80%', height: 3, bgcolor: alpha(colors.textSecondary, 0.4), borderRadius: 0.5, mb: 0.5 }} />
              <Box display="flex" gap={0.5} mt={0.75}>
                <Box sx={{ flex: 1, height: 14, bgcolor: colors.primary, borderRadius: 0.5, opacity: 0.8 }} />
                <Box sx={{ flex: 1, height: 14, bgcolor: colors.secondary, borderRadius: 0.5, opacity: 0.6 }} />
              </Box>
            </Box>
          </Box>
        </Box>
        <Box sx={{ bgcolor: colors.paper, px: 1.5, py: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography sx={{ fontSize: 13, fontWeight: 600, color: colors.text }}>{def.name}</Typography>
          <Chip
            label={mode}
            size="small"
            sx={{
              height: 18, fontSize: 10, ml: 'auto',
              bgcolor: mode === 'dark' ? alpha(colors.textSecondary, 0.15) : alpha(colors.primary, 0.1),
              color: mode === 'dark' ? colors.textSecondary : colors.primary,
            }}
          />
        </Box>
      </CardActionArea>
    </Card>
  );
}

export default function Settings() {
  const { themeId, setThemeId, availableThemes } = useThemeContext();
  const { appTitle, setAppTitle } = useAppSettings();
  const [titleInput, setTitleInput] = useState('');
  const [version, setVersion] = useState('');
  const [platform, setPlatform] = useState('');
  const [checking, setChecking] = useState(false);
  const [profiles, setProfiles] = useState<SyncProfile[]>([]);
  const [editProfile, setEditProfile] = useState<SyncProfile | null>(null);
  const [backupInfo, setBackupInfo] = useState<BackupInfo>({ lastBackup: null, folderId: null });
  const [backupLoading, setBackupLoading] = useState('');
  const [backupMessage, setBackupMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [titleSaved, setTitleSaved] = useState(false);

  useEffect(() => {
    window.api.app.getVersion().then(setVersion);
    window.api.app.getPlatform().then(setPlatform);
    loadProfiles();
    window.api.backup.getInfo().then(setBackupInfo);
    setTitleInput(appTitle);
  }, [appTitle]);

  async function handleBackup() {
    setBackupLoading('backup');
    setBackupMessage(null);
    try {
      const result = await window.api.backup.backup();
      if (result.success) {
        setBackupMessage({ type: 'success', text: `Database backed up to Google Drive (${(result.size / 1024).toFixed(0)} KB)` });
        window.api.backup.getInfo().then(setBackupInfo);
      } else {
        setBackupMessage({ type: 'error', text: result.error || 'Backup failed' });
      }
    } catch (err: any) {
      setBackupMessage({ type: 'error', text: err?.message || 'Backup failed' });
    } finally {
      setBackupLoading('');
    }
  }

  async function handleRestore() {
    setBackupLoading('restore');
    setBackupMessage(null);
    try {
      const result = await window.api.backup.restore();
      if (result.success) {
        setBackupMessage({ type: 'success', text: `Restored: ${result.profilesRestored} profiles, ${result.historyRestored} history records. Restart the app to apply.` });
      } else {
        setBackupMessage({ type: 'error', text: result.error || 'Restore failed' });
      }
    } catch (err: any) {
      setBackupMessage({ type: 'error', text: err?.message || 'Restore failed' });
    } finally {
      setBackupLoading('');
    }
  }

  async function handleSyncMerge() {
    setBackupLoading('merge');
    setBackupMessage(null);
    try {
      const result = await window.api.backup.syncMerge();
      if (result.success) {
        const parts = [];
        if (result.profilesAdded) parts.push(`${result.profilesAdded} profiles added`);
        if (result.profilesUpdated) parts.push(`${result.profilesUpdated} profiles updated`);
        if (result.historyAdded) parts.push(`${result.historyAdded} history records added`);
        if (result.fileLogAdded) parts.push(`${result.fileLogAdded} file logs added`);
        const msg = parts.length > 0 ? `Merged: ${parts.join(', ')}. Uploaded merged DB.` : 'Already in sync. No changes needed.';
        setBackupMessage({ type: 'success', text: msg });
        loadProfiles();
        window.api.backup.getInfo().then(setBackupInfo);
      } else {
        setBackupMessage({ type: 'error', text: result.error || 'Merge failed' });
      }
    } catch (err: any) {
      setBackupMessage({ type: 'error', text: err?.message || 'Merge failed' });
    } finally {
      setBackupLoading('');
    }
  }

  async function loadProfiles() {
    const result = await window.api.sync.getProfiles();
    setProfiles(result);
  }

  async function handleDelete(id: number) {
    await window.api.sync.deleteProfile(id);
    setProfiles((prev) => prev.filter((p) => p.id !== id));
    setEditProfile(null);
  }

  async function handleSync(id: number) {
    await window.api.sync.startSync(id);
    setEditProfile(null);
  }

  function handleSaved(updated: SyncProfile) {
    setProfiles((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  }

  async function checkUpdates() {
    setChecking(true);
    try { await window.api.app.checkForUpdates(); } finally { setChecking(false); }
  }

  return (
    <Box flex={1} overflow="auto" px={4} py={3}>
      <Typography variant="h5" mb={0.5}>Settings</Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        Customize your GDrive Sync experience.
      </Typography>

      {/* ── Sync Profiles ── */}
      <Typography variant="subtitle1" mb={2}>Sync Profiles</Typography>
      {profiles.length === 0 ? (
        <Typography variant="body2" color="text.secondary" mb={3}>
          No profiles yet. Create one from the Dashboard.
        </Typography>
      ) : (
        <TableContainer
          sx={{ borderRadius: 2, border: (t) => `1px solid ${alpha(t.palette.divider, 0.3)}`, mb: 4 }}
        >
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Direction</TableCell>
                <TableCell>Drive Folder</TableCell>
                <TableCell>Local Path</TableCell>
                <TableCell>Schedule</TableCell>
                <TableCell>Last Sync</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {profiles.map((p) => {
                const DirIcon = directionIcons[p.syncDirection];
                return (
                  <TableRow key={p.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={500}>{p.name}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        icon={<DirIcon sx={{ fontSize: '14px !important' }} />}
                        label={p.syncDirection}
                        size="small"
                        sx={{ height: 22, fontSize: 11 }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: 150, display: 'block' }}>
                        {p.driveName}: {p.driveFolderPath}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: 150, display: 'block' }}>
                        {p.localPath}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">
                        {p.schedule || 'Manual'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">
                        {p.lastSyncAt ? new Date(p.lastSyncAt).toLocaleString() : 'Never'}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Box display="flex" gap={0.25} justifyContent="flex-end">
                        <Tooltip title="Sync now">
                          <IconButton size="small" onClick={() => handleSync(p.id)}>
                            <PlayArrowIcon sx={{ fontSize: 18 }} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Edit">
                          <IconButton size="small" onClick={() => setEditProfile(p)}>
                            <EditIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton size="small" onClick={() => handleDelete(p.id)} sx={{ color: 'text.secondary' }}>
                            <DeleteOutlineIcon sx={{ fontSize: 18 }} />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Divider sx={{ opacity: 0.3, mb: 3 }} />

      {/* ── Application Title ── */}
      <Typography variant="subtitle1" mb={1}>Application Title</Typography>
      <Typography variant="body2" color="text.secondary" mb={2}>
        Customize the title shown in the top bar. Saved to database.
      </Typography>
      <Box display="flex" gap={1} mb={1} maxWidth={500}>
        <TextField
          size="small"
          fullWidth
          value={titleInput}
          onChange={(e) => { setTitleInput(e.target.value); setTitleSaved(false); }}
          placeholder="GDrive Sync App"
        />
        <Button
          variant="contained"
          onClick={async () => { await setAppTitle(titleInput); setTitleSaved(true); }}
          disabled={titleInput === appTitle}
          sx={{ whiteSpace: 'nowrap' }}
        >
          Save
        </Button>
      </Box>
      {titleSaved && (
        <Typography variant="caption" color="success.main" mb={2} display="block">
          Title saved!
        </Typography>
      )}

      <Divider sx={{ opacity: 0.3, my: 3 }} />

      {/* ── Database Backup ── */}
      <Typography variant="subtitle1" mb={1}>Database Backup & Restore</Typography>
      <Typography variant="body2" color="text.secondary" mb={2}>
        Backup your profiles, sync history, and settings to Google Drive.
        Restore or merge when setting up a new machine or recovering from data loss.
      </Typography>

      {backupMessage && (
        <Alert severity={backupMessage.type} sx={{ mb: 2, borderRadius: 2 }} onClose={() => setBackupMessage(null)}>
          {backupMessage.text}
        </Alert>
      )}

      <Box display="flex" gap={2} flexWrap="wrap" mb={2}>
        <Button
          variant="outlined"
          startIcon={backupLoading === 'backup' ? <CircularProgress size={18} /> : <BackupIcon />}
          onClick={handleBackup}
          disabled={!!backupLoading}
        >
          Backup to Drive
        </Button>
        <Button
          variant="outlined"
          startIcon={backupLoading === 'merge' ? <CircularProgress size={18} /> : <SyncIcon />}
          onClick={handleSyncMerge}
          disabled={!!backupLoading}
        >
          Sync & Merge
        </Button>
        <Button
          variant="outlined"
          color="warning"
          startIcon={backupLoading === 'restore' ? <CircularProgress size={18} /> : <RestoreIcon />}
          onClick={handleRestore}
          disabled={!!backupLoading}
        >
          Restore from Drive
        </Button>
      </Box>

      <Box mb={4}>
        {backupInfo.lastBackup && (
          <Typography variant="caption" color="text.secondary">
            Last backup: {new Date(backupInfo.lastBackup).toLocaleString()}
          </Typography>
        )}
        {!backupInfo.lastBackup && (
          <Typography variant="caption" color="text.secondary">
            No backup yet. Click "Backup to Drive" to create one.
          </Typography>
        )}
      </Box>

      <Divider sx={{ opacity: 0.3, mb: 3 }} />

      {/* ── Theme ── */}
      <Typography variant="subtitle1" mb={2}>Theme</Typography>
      <Box display="flex" flexWrap="wrap" gap={2} mb={4}>
        {availableThemes.map((def) => (
          <ThemeCard key={def.id} def={def} selected={themeId === def.id} onSelect={() => setThemeId(def.id)} />
        ))}
      </Box>

      <Divider sx={{ opacity: 0.3, mb: 3 }} />

      {/* ── About ── */}
      <Typography variant="subtitle1" mb={2}>About</Typography>
      <Box
        sx={{
          p: 3, borderRadius: 3,
          border: (t) => `1px solid ${alpha(t.palette.divider, 0.2)}`,
          background: (t) => `linear-gradient(135deg, ${alpha(t.palette.primary.main, 0.06)}, ${alpha(t.palette.secondary.main, 0.04)})`,
          maxWidth: 500,
        }}
      >
        <Typography
          variant="h6"
          fontWeight={800}
          mb={1}
          sx={{
            background: 'linear-gradient(135deg, #00e5ff, #00bfa5, #64ffda)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          {appTitle}
        </Typography>
        <Box display="flex" flexDirection="column" gap={0.75} mb={2}>
          <Box display="flex" gap={2}>
            <Typography variant="caption" color="text.secondary" sx={{ minWidth: 70 }}>Version</Typography>
            <Typography variant="caption">{version || '...'}</Typography>
          </Box>
          <Box display="flex" gap={2}>
            <Typography variant="caption" color="text.secondary" sx={{ minWidth: 70 }}>Platform</Typography>
            <Typography variant="caption">{platform || '...'}</Typography>
          </Box>
          <Box display="flex" gap={2}>
            <Typography variant="caption" color="text.secondary" sx={{ minWidth: 70 }}>Runtime</Typography>
            <Typography variant="caption">Electron + React + TypeScript</Typography>
          </Box>
          <Box display="flex" gap={2}>
            <Typography variant="caption" color="text.secondary" sx={{ minWidth: 70 }}>UI</Typography>
            <Typography variant="caption">Material UI 5</Typography>
          </Box>
          <Box display="flex" gap={2}>
            <Typography variant="caption" color="text.secondary" sx={{ minWidth: 70 }}>Database</Typography>
            <Typography variant="caption">SQLite (better-sqlite3)</Typography>
          </Box>
          <Box display="flex" gap={2}>
            <Typography variant="caption" color="text.secondary" sx={{ minWidth: 70 }}>APIs</Typography>
            <Typography variant="caption">Google Drive API v3</Typography>
          </Box>
          <Box display="flex" gap={2}>
            <Typography variant="caption" color="text.secondary" sx={{ minWidth: 70 }}>Author</Typography>
            <Typography variant="caption">Jerome Purushotham</Typography>
          </Box>
        </Box>
        <Divider sx={{ opacity: 0.2, mb: 2 }} />
        <Typography variant="caption" color="text.secondary" display="block" mb={2}>
          Sync your Google Drive files with local folders. Supports bidirectional sync,
          scheduled auto-sync, MD5 checksum verification, Google Workspace file export,
          and database backup/restore to Drive.
        </Typography>
        <Button variant="outlined" size="small" startIcon={<SystemUpdateIcon />} onClick={checkUpdates} disabled={checking}>
          {checking ? 'Checking...' : 'Check for Updates'}
        </Button>
      </Box>

      <EditProfileDialog
        open={!!editProfile}
        profile={editProfile}
        onClose={() => setEditProfile(null)}
        onSave={handleSaved}
        onDelete={() => editProfile && handleDelete(editProfile.id)}
        onSync={() => editProfile && handleSync(editProfile.id)}
      />
    </Box>
  );
}
