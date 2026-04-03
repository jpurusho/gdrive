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
  const [ghToken, setGhToken] = useState('');
  const [ghTokenSaved, setGhTokenSaved] = useState(false);
  const [googleClientId, setGoogleClientId] = useState('');
  const [googleClientSecret, setGoogleClientSecret] = useState('');
  const [googleCredsSaved, setGoogleCredsSaved] = useState(false);
  const [dataDir, setDataDir] = useState('');
  const [dataDirMessage, setDataDirMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    window.api.app.getVersion().then(setVersion);
    window.api.app.getPlatform().then(setPlatform);
    loadProfiles();
    window.api.backup.getInfo().then(setBackupInfo);
    setTitleInput(appTitle);
    window.api.app.getSetting('github_token').then((val) => { if (val) setGhToken(val); });
    window.api.app.getSetting('google_client_id').then((val) => { if (val) setGoogleClientId(val); });
    window.api.app.getSetting('google_client_secret').then((val) => { if (val) setGoogleClientSecret('••••••••'); });
    window.api.app.getDataDir().then(setDataDir);
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
          sx={{ borderRadius: 2, border: (t) => `1.5px solid ${alpha(t.palette.primary.light, 0.35)}`, mb: 4, overflow: 'hidden' }}
        >
          <Table size="small">
            <TableHead>
              <TableRow
                sx={{
                  background: (t) => `linear-gradient(135deg, ${alpha(t.palette.primary.main, 0.15)}, ${alpha(t.palette.secondary.main, 0.1)})`,
                }}
              >
                <TableCell sx={{ fontWeight: 700, fontSize: 12, py: 1.25, borderBottom: (t) => `1px solid ${alpha(t.palette.divider, 0.15)}` }}>Name</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: 12, py: 1.25, borderBottom: (t) => `1px solid ${alpha(t.palette.divider, 0.15)}` }}>Direction</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: 12, py: 1.25, borderBottom: (t) => `1px solid ${alpha(t.palette.divider, 0.15)}` }}>Drive Folder</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: 12, py: 1.25, borderBottom: (t) => `1px solid ${alpha(t.palette.divider, 0.15)}` }}>Local Path</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: 12, py: 1.25, borderBottom: (t) => `1px solid ${alpha(t.palette.divider, 0.15)}` }}>Schedule</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: 12, py: 1.25, borderBottom: (t) => `1px solid ${alpha(t.palette.divider, 0.15)}` }}>Last Sync</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: 12, py: 1.25, borderBottom: (t) => `1px solid ${alpha(t.palette.divider, 0.15)}` }} align="right">Actions</TableCell>
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

      {/* ── Data Directory ── */}
      <Typography variant="subtitle1" mb={1}>Data Directory</Typography>
      <Typography variant="body2" color="text.secondary" mb={2}>
        Where the database, settings, and sync history are stored. Change this if the default
        location is not writable or to use a custom path.
      </Typography>
      <Box display="flex" gap={1} mb={1} maxWidth={500}>
        <TextField
          size="small"
          fullWidth
          value={dataDir}
          InputProps={{ readOnly: true }}
        />
        <Button
          variant="outlined"
          onClick={async () => {
            const dir = await window.api.localFs.selectDirectory();
            if (dir) {
              setDataDirMessage(null);
              try {
                const result = await window.api.app.setDataDir(dir);
                setDataDir(dir);
                setDataDirMessage({ type: 'success', text: result.message });
              } catch (err: any) {
                setDataDirMessage({ type: 'error', text: err?.message || 'Failed' });
              }
            }
          }}
          sx={{ whiteSpace: 'nowrap' }}
        >
          Change
        </Button>
      </Box>
      {dataDirMessage && (
        <Alert severity={dataDirMessage.type} sx={{ mb: 2, borderRadius: 2, maxWidth: 500 }} onClose={() => setDataDirMessage(null)}>
          {dataDirMessage.text}
        </Alert>
      )}
      <Typography variant="caption" color="text.secondary" mb={2} display="block">
        Config stored at: ~/.gsync/config.json
      </Typography>

      <Divider sx={{ opacity: 0.3, my: 3 }} />

      {/* ── Google OAuth ── */}
      <Typography variant="subtitle1" mb={1}>Google OAuth Credentials</Typography>
      <Typography variant="body2" color="text.secondary" mb={2}>
        Client ID and Secret from your Google Cloud project. Required for login.
      </Typography>
      <Box display="flex" flexDirection="column" gap={1.5} mb={1} maxWidth={500}>
        <TextField
          size="small"
          label="Client ID"
          value={googleClientId}
          onChange={(e) => { setGoogleClientId(e.target.value); setGoogleCredsSaved(false); }}
          fullWidth
        />
        <TextField
          size="small"
          label="Client Secret"
          type="password"
          value={googleClientSecret}
          onChange={(e) => { setGoogleClientSecret(e.target.value); setGoogleCredsSaved(false); }}
          placeholder={googleClientSecret ? undefined : 'Not set'}
          fullWidth
        />
        <Button
          variant="contained"
          onClick={async () => {
            if (googleClientId.trim() && googleClientSecret.trim() && !googleClientSecret.startsWith('••')) {
              await window.api.auth.setCredentials(googleClientId.trim(), googleClientSecret.trim());
              setGoogleCredsSaved(true);
            }
          }}
          sx={{ alignSelf: 'flex-start' }}
        >
          Save Credentials
        </Button>
      </Box>
      {googleCredsSaved && (
        <Typography variant="caption" color="success.main" mb={2} display="block">
          Credentials saved! Sign out and back in to use new credentials.
        </Typography>
      )}

      <Divider sx={{ opacity: 0.3, my: 3 }} />

      {/* ── GitHub Token ── */}
      <Typography variant="subtitle1" mb={1}>GitHub Token</Typography>
      <Typography variant="body2" color="text.secondary" mb={2}>
        Required for auto-updates from GitHub Releases. Create a personal access token with <code>repo</code> scope.
      </Typography>
      <Box display="flex" gap={1} mb={1} maxWidth={500}>
        <TextField
          size="small"
          fullWidth
          type="password"
          value={ghToken}
          onChange={(e) => { setGhToken(e.target.value); setGhTokenSaved(false); }}
          placeholder="ghp_..."
        />
        <Button
          variant="contained"
          onClick={async () => {
            await window.api.app.setSetting('github_token', ghToken.trim());
            setGhTokenSaved(true);
          }}
          sx={{ whiteSpace: 'nowrap' }}
        >
          Save
        </Button>
      </Box>
      {ghTokenSaved && (
        <Typography variant="caption" color="success.main" mb={2} display="block">
          Token saved! Restart the app for auto-update to use it.
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
