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
  Tabs,
  Tab,
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
import SystemUpdateIcon from '@mui/icons-material/SystemUpdate';
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
  const [backupInfo, setBackupInfo] = useState<BackupInfo>({ lastBackup: null, folderId: null, folderName: null });
  const [showBackupPicker, setShowBackupPicker] = useState(false);
  const [backupDrives, setBackupDrives] = useState<any[]>([]);
  const [backupDriveFiles, setBackupDriveFiles] = useState<Record<string, any[]>>({});
  const [backupExpandedDrives, setBackupExpandedDrives] = useState<Set<string>>(new Set());
  const [loadingBackupDrives, setLoadingBackupDrives] = useState(false);
  const [backupLoading, setBackupLoading] = useState('');
  const [backupMessage, setBackupMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [titleSaved, setTitleSaved] = useState(false);
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

  const [settingsTab, setSettingsTab] = useState(0);
  const thStyle = { fontWeight: 700, fontSize: 12, py: 1.25, borderBottom: (t: any) => `1px solid ${alpha(t.palette.divider, 0.15)}` };

  return (
    <Box flex={1} display="flex" flexDirection="column" overflow="hidden">
      <Box sx={{ borderBottom: (t) => `1px solid ${alpha(t.palette.divider, 0.15)}`, px: 2, flexShrink: 0 }}>
        <Tabs value={settingsTab} onChange={(_e, v) => setSettingsTab(v)} variant="scrollable" scrollButtons="auto"
          sx={{ minHeight: 40, '& .MuiTab-root': { minHeight: 40, textTransform: 'none', fontSize: 13, fontWeight: 600, py: 0 } }}>
          <Tab label="General" />
          <Tab label="Profiles" />
          <Tab label="Storage" />
          <Tab label="Credentials" />
          <Tab label="About" />
        </Tabs>
      </Box>
      <Box flex={1} overflow="auto" px={4} py={3}>

        {/* ═══ GENERAL ═══ */}
        {settingsTab === 0 && (
          <Box>
            <Typography variant="subtitle1" mb={1}>Application Title</Typography>
            <Typography variant="body2" color="text.secondary" mb={2}>Customize the title shown in the top bar.</Typography>
            <Box display="flex" gap={1} mb={1} maxWidth={500}>
              <TextField size="small" fullWidth value={titleInput} onChange={(e) => { setTitleInput(e.target.value); setTitleSaved(false); }} placeholder="GDrive Sync App" />
              <Button variant="contained" onClick={async () => { await setAppTitle(titleInput); setTitleSaved(true); }} disabled={titleInput === appTitle} sx={{ whiteSpace: 'nowrap' }}>Save</Button>
            </Box>
            {titleSaved && <Typography variant="caption" color="success.main" display="block" mb={2}>Title saved!</Typography>}
            <Divider sx={{ opacity: 0.3, my: 3 }} />
            <Typography variant="subtitle1" mb={2}>Theme</Typography>
            <Box display="flex" flexWrap="wrap" gap={2}>
              {availableThemes.map((def) => (
                <ThemeCard key={def.id} def={def} selected={themeId === def.id} onSelect={() => setThemeId(def.id)} />
              ))}
            </Box>
          </Box>
        )}

        {/* ═══ PROFILES ═══ */}
        {settingsTab === 1 && (
          <Box>
            <Typography variant="subtitle1" mb={2}>Sync Profiles</Typography>
            {profiles.length === 0 ? (
              <Typography variant="body2" color="text.secondary">No profiles yet. Create one from Home.</Typography>
            ) : (
              <TableContainer sx={{ borderRadius: 2, border: (t) => `1.5px solid ${alpha(t.palette.primary.light, 0.35)}`, overflow: 'hidden' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ background: (t) => `linear-gradient(135deg, ${alpha(t.palette.primary.main, 0.15)}, ${alpha(t.palette.secondary.main, 0.1)})` }}>
                      <TableCell sx={thStyle}>Name</TableCell>
                      <TableCell sx={thStyle}>Direction</TableCell>
                      <TableCell sx={thStyle}>Drive Folder</TableCell>
                      <TableCell sx={thStyle}>Local Path</TableCell>
                      <TableCell sx={thStyle}>Schedule</TableCell>
                      <TableCell sx={thStyle}>Last Sync</TableCell>
                      <TableCell sx={thStyle} align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {profiles.map((p) => {
                      const DirIcon = directionIcons[p.syncDirection];
                      return (
                        <TableRow key={p.id} hover>
                          <TableCell><Typography variant="body2" fontWeight={500}>{p.name}</Typography></TableCell>
                          <TableCell><Chip icon={<DirIcon sx={{ fontSize: '14px !important' }} />} label={p.syncDirection} size="small" sx={{ height: 22, fontSize: 11 }} /></TableCell>
                          <TableCell><Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: 150, display: 'block' }}>{p.driveName}: {p.driveFolderPath}</Typography></TableCell>
                          <TableCell><Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: 150, display: 'block' }}>{p.localPath}</Typography></TableCell>
                          <TableCell><Typography variant="caption" color="text.secondary">{p.schedule || 'Manual'}</Typography></TableCell>
                          <TableCell><Typography variant="caption" color="text.secondary">{p.lastSyncAt ? new Date(p.lastSyncAt).toLocaleString() : 'Never'}</Typography></TableCell>
                          <TableCell align="right">
                            <Box display="flex" gap={0.25} justifyContent="flex-end">
                              <Tooltip title="Sync now"><IconButton size="small" onClick={() => handleSync(p.id)}><PlayArrowIcon sx={{ fontSize: 18 }} /></IconButton></Tooltip>
                              <Tooltip title="Edit"><IconButton size="small" onClick={() => setEditProfile(p)}><EditIcon sx={{ fontSize: 16 }} /></IconButton></Tooltip>
                              <Tooltip title="Delete"><IconButton size="small" onClick={() => handleDelete(p.id)} sx={{ color: 'text.secondary' }}><DeleteOutlineIcon sx={{ fontSize: 18 }} /></IconButton></Tooltip>
                            </Box>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>
        )}

        {/* ═══ STORAGE ═══ */}
        {settingsTab === 2 && (
          <Box>
            <Typography variant="subtitle1" mb={1}>Data Directory</Typography>
            <Typography variant="body2" color="text.secondary" mb={2}>Where the database, settings, and sync history are stored.</Typography>
            <Box display="flex" gap={1} mb={1} maxWidth={500}>
              <TextField size="small" fullWidth value={dataDir} InputProps={{ readOnly: true }} />
              <Button variant="outlined" onClick={async () => { const dir = await window.api.localFs.selectDirectory(); if (dir) { setDataDirMessage(null); try { const result = await window.api.app.setDataDir(dir); setDataDir(dir); setDataDirMessage({ type: 'success', text: result.message }); } catch (err: any) { setDataDirMessage({ type: 'error', text: err?.message || 'Failed' }); } } }} sx={{ whiteSpace: 'nowrap' }}>Change</Button>
            </Box>
            {dataDirMessage && <Alert severity={dataDirMessage.type} sx={{ mb: 2, borderRadius: 2, maxWidth: 500 }} onClose={() => setDataDirMessage(null)}>{dataDirMessage.text}</Alert>}
            <Box sx={{ mt: 1.5, mb: 2, p: 1.5, borderRadius: 1.5, maxWidth: 500, bgcolor: (t) => alpha(t.palette.primary.main, 0.04), border: (t) => `1px solid ${alpha(t.palette.primary.main, 0.1)}` }}>
              <Typography variant="caption" color="text.secondary" component="div" lineHeight={1.8}>
                <strong>Config:</strong> <code>~/.gsync/config.json</code><br />
                <strong>DB files:</strong> <code>gdrive-sync.db</code>, <code>.db-wal</code>, <code>.db-shm</code>
              </Typography>
            </Box>

            <Divider sx={{ opacity: 0.3, my: 3 }} />

            <Typography variant="subtitle1" mb={1}>Database Backup & Restore</Typography>
            <Typography variant="body2" color="text.secondary" mb={2}>Backup profiles and settings to Google Drive. Restore or merge on any machine.</Typography>

            <Box mb={2} maxWidth={500}>
              <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
                <Typography variant="subtitle2">Backup Folder</Typography>
                <Button size="small" variant="text" onClick={async () => { if (!showBackupPicker) { setShowBackupPicker(true); setLoadingBackupDrives(true); try { setBackupDrives(await window.api.drive.listDrives()); } finally { setLoadingBackupDrives(false); } } else { setShowBackupPicker(false); } }}>{showBackupPicker ? 'Cancel' : 'Change'}</Button>
              </Box>
              <Box sx={{ p: 1.5, borderRadius: 1.5, bgcolor: (t) => alpha(t.palette.primary.main, 0.04), border: (t) => `1px solid ${alpha(t.palette.primary.main, 0.1)}` }}>
                <Typography variant="caption" color="text.secondary" component="div" lineHeight={1.8}>
                  <strong>Current:</strong> {backupInfo.folderName || (backupInfo.folderId ? 'GDrive Sync Backups' : 'Drive root')}<br />
                  <strong>File:</strong> <code>gdrive-sync-backup.db</code>
                </Typography>
              </Box>
              {showBackupPicker && (
                <Box sx={{ mt: 1, maxHeight: 200, overflow: 'auto', borderRadius: 2, border: (t) => `1.5px solid ${alpha(t.palette.primary.light, 0.3)}`, bgcolor: 'background.default' }}>
                  {loadingBackupDrives ? <Box display="flex" justifyContent="center" py={2}><CircularProgress size={20} /></Box> : (
                    <Box>
                      <Box onClick={async () => { await window.api.backup.setFolder('root', 'Drive Root'); setBackupInfo((prev) => ({ ...prev, folderId: 'root', folderName: 'Drive Root' })); setShowBackupPicker(false); }} sx={{ px: 2, py: 1, cursor: 'pointer', '&:hover': { bgcolor: (t) => alpha(t.palette.primary.main, 0.05) }, borderBottom: (t) => `1px solid ${alpha(t.palette.divider, 0.08)}` }}>
                        <Typography variant="caption" fontWeight={600}>My Drive Root</Typography>
                      </Box>
                      {backupDrives.filter((d: any) => d.id === 'root').map((drive: any) => (
                        <Box key={drive.id}>
                          <Box onClick={async () => { const exp = new Set(backupExpandedDrives); if (exp.has(drive.id)) { exp.delete(drive.id); } else { exp.add(drive.id); if (!backupDriveFiles[drive.id]) { const files = await window.api.drive.listFiles(drive.id, 'root'); setBackupDriveFiles((prev) => ({ ...prev, [drive.id]: files.filter((f: any) => f.isFolder) })); } } setBackupExpandedDrives(exp); }} sx={{ px: 2, py: 0.75, cursor: 'pointer', '&:hover': { bgcolor: (t) => alpha(t.palette.primary.main, 0.05) } }}>
                            <Typography variant="caption" fontWeight={500}>{backupExpandedDrives.has(drive.id) ? '▾' : '▸'} My Drive Folders</Typography>
                          </Box>
                          {backupExpandedDrives.has(drive.id) && (backupDriveFiles[drive.id] || []).map((folder: any) => (
                            <Box key={folder.id} onClick={async () => { await window.api.backup.setFolder(folder.id, folder.name); setBackupInfo((prev) => ({ ...prev, folderId: folder.id, folderName: folder.name })); setShowBackupPicker(false); }} sx={{ px: 4, py: 0.5, cursor: 'pointer', bgcolor: backupInfo.folderId === folder.id ? (t: any) => alpha(t.palette.success.main, 0.1) : 'transparent', '&:hover': { bgcolor: (t) => alpha(t.palette.primary.main, 0.05) } }}>
                              <Typography variant="caption">📁 {folder.name}</Typography>
                            </Box>
                          ))}
                        </Box>
                      ))}
                    </Box>
                  )}
                </Box>
              )}
            </Box>
            {backupMessage && <Alert severity={backupMessage.type} sx={{ mb: 2, borderRadius: 2 }} onClose={() => setBackupMessage(null)}>{backupMessage.text}</Alert>}
            <Box display="flex" gap={2} flexWrap="wrap" mb={2}>
              <Button variant="outlined" startIcon={backupLoading === 'backup' ? <CircularProgress size={18} /> : <BackupIcon />} onClick={handleBackup} disabled={!!backupLoading}>Backup to Drive</Button>
              <Button variant="outlined" startIcon={backupLoading === 'merge' ? <CircularProgress size={18} /> : <SyncIcon />} onClick={handleSyncMerge} disabled={!!backupLoading}>Sync & Merge</Button>
              <Button variant="outlined" color="warning" startIcon={backupLoading === 'restore' ? <CircularProgress size={18} /> : <RestoreIcon />} onClick={handleRestore} disabled={!!backupLoading}>Restore from Drive</Button>
            </Box>
            <Typography variant="caption" color="text.secondary">{backupInfo.lastBackup ? `Last backup: ${new Date(backupInfo.lastBackup).toLocaleString()}` : 'No backup yet.'}</Typography>
          </Box>
        )}

        {/* ═══ CREDENTIALS ═══ */}
        {settingsTab === 3 && (
          <Box>
            <Typography variant="subtitle1" mb={1}>Google OAuth Credentials</Typography>
            <Typography variant="body2" color="text.secondary" mb={2}>
              Credentials are already embedded in the app. You only need to change these if you want to use a different Google Cloud project.
            </Typography>
            <Box display="flex" flexDirection="column" gap={1.5} mb={1} maxWidth={500}>
              <TextField size="small" label="Client ID" value={googleClientId} onChange={(e) => { setGoogleClientId(e.target.value); setGoogleCredsSaved(false); }} fullWidth />
              <TextField size="small" label="Client Secret" type="password" value={googleClientSecret} onChange={(e) => { setGoogleClientSecret(e.target.value); setGoogleCredsSaved(false); }} placeholder={googleClientSecret ? undefined : 'Not set'} fullWidth />
              <Button variant="contained" onClick={async () => { if (googleClientId.trim() && googleClientSecret.trim() && !googleClientSecret.startsWith('••')) { await window.api.auth.setCredentials(googleClientId.trim(), googleClientSecret.trim()); setGoogleCredsSaved(true); } }} sx={{ alignSelf: 'flex-start' }}>Save Credentials</Button>
            </Box>
            {googleCredsSaved && <Typography variant="caption" color="success.main" display="block">Credentials saved! Sign out and back in to use new credentials.</Typography>}
          </Box>
        )}

        {/* ═══ ABOUT ═══ */}
        {settingsTab === 4 && (
          <Box>
            <Box sx={{ p: 3, borderRadius: 3, background: (t) => `linear-gradient(135deg, ${alpha(t.palette.primary.main, 0.08)}, ${alpha(t.palette.secondary.main, 0.05)})`, border: (t) => `1.5px solid ${alpha(t.palette.primary.light, 0.2)}`, mb: 3, textAlign: 'center' }}>
              <Typography variant="h5" sx={{ fontWeight: 800, mb: 1, background: 'linear-gradient(135deg, #00e5ff, #00bfa5, #64ffda)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{appTitle}</Typography>
              <Box display="flex" gap={1.5} justifyContent="center" flexWrap="wrap">
                <Chip label={`v${version}`} sx={{ fontWeight: 700, bgcolor: (t) => alpha(t.palette.primary.main, 0.12), color: 'primary.light' }} />
                <Chip label={platform} variant="outlined" sx={{ fontSize: 12 }} />
                <Chip label="Electron + React" variant="outlined" sx={{ fontSize: 12 }} />
              </Box>
            </Box>
            <Typography variant="body2" color="text.secondary" mb={3} lineHeight={1.8} maxWidth={600}>
              Sync your Google Drive files with local folders. Create sync profiles that map a Drive folder to a local folder, choose a direction,
              and gsync handles the rest — comparing files by MD5 checksum, transferring only what changed, exporting Google Workspace files,
              and logging every operation. Supports pause/resume, scheduled auto-sync, mirror mode, HEIC conversion, and database backup to Drive.
            </Typography>
            <Button variant="outlined" size="small" startIcon={<SystemUpdateIcon />} onClick={async () => { setChecking(true); try { const r = await window.api.app.checkForUpdates(); if (r.status === 'available') { alert(`Update available: v${r.version}`); } else if (r.status === 'latest') { alert(`You're on the latest version (v${version}).`); } else { alert(r.message || 'Check failed'); } } finally { setChecking(false); } }} disabled={checking} sx={{ mb: 3 }}>
              {checking ? 'Checking...' : 'Check for Updates'}
            </Button>

            <Typography variant="subtitle2" fontWeight={700} mb={1}>Tech Stack</Typography>
            <Box sx={{ p: 2, borderRadius: 2, border: (t) => `1.5px solid ${alpha(t.palette.primary.light, 0.2)}`, maxWidth: 400, mb: 3 }}>
              {[['Desktop', 'Electron 33'], ['UI', 'React 18 + Material UI 5'], ['Build', 'Vite 6 + TypeScript 5'], ['APIs', 'Google Drive API v3'], ['Database', 'SQLite via better-sqlite3'], ['Scheduling', 'node-cron'], ['Testing', 'Vitest (30 tests)'], ['Author', 'Jerome Purushotham']].map(([k, v]) => (
                <Box key={k} display="flex" gap={2} py={0.5}>
                  <Typography variant="caption" color="text.secondary" sx={{ minWidth: 80 }}>{k}</Typography>
                  <Typography variant="caption">{v}</Typography>
                </Box>
              ))}
            </Box>
          </Box>
        )}

      </Box>
      <EditProfileDialog open={!!editProfile} profile={editProfile} onClose={() => setEditProfile(null)} onSave={handleSaved} onDelete={() => editProfile && handleDelete(editProfile.id)} onSync={() => editProfile && handleSync(editProfile.id)} />
    </Box>
  );
}
