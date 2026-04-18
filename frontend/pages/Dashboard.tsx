import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  alpha,
  Dialog,
  DialogContent,
  Button,
  LinearProgress,
  Tooltip,
} from '@mui/material';
import SystemUpdateIcon from '@mui/icons-material/SystemUpdate';
import DownloadIcon from '@mui/icons-material/Download';
import Sidebar from '../components/Layout/Sidebar';
import StatsBar from '../components/StatsBar/StatsBar';
import ProfileList from '../components/ProfileList/ProfileList';
import ProfileDetail from '../components/ProfileDetail/ProfileDetail';
import EmptyState from '../components/EmptyState/EmptyState';
import CreateProfileDialog from '../components/CreateProfileDialog/CreateProfileDialog';
import Settings from './Settings';
import History from './History';
import WelcomeSplash from '../components/WelcomeSplash/WelcomeSplash';
import { useAppSettings } from '../context/AppSettingsContext';
import type { UserInfo, SyncProfile, SyncSession } from '../../shared/types';

interface DashboardProps {
  user: UserInfo;
  onLogout: () => void;
}

type Page = 'home' | 'history' | 'settings';

function formatDate(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function Dashboard({ user, onLogout }: DashboardProps) {
  const [currentPage, setCurrentPage] = useState<Page>('home');
  const [version, setVersion] = useState('');
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [profiles, setProfiles] = useState<SyncProfile[]>([]);
  const [sessions, setSessions] = useState<Record<number, SyncSession>>({});
  const [selectedProfileId, setSelectedProfileId] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const { appTitle } = useAppSettings();

  // Update state
  const [updateAvailable, setUpdateAvailable] = useState<{ version: string; url: string; notes: string } | null>(null);
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadedPath, setDownloadedPath] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);

  useEffect(() => {
    window.api.app.getVersion().then(setVersion);
    window.api.app.onFullscreenChange(setIsFullScreen);
    loadProfiles();

    // Auto-check for updates on startup (silent)
    window.api.app.checkForUpdates().then((result) => {
      if (result.status === 'available' && result.version && result.url) {
        setUpdateAvailable({ version: result.version, url: result.url, notes: result.notes || '' });
      }
    }).catch(() => {});

    const unsub = window.api.sync.onSyncProgress((session) => {
      setSessions((prev) => ({ ...prev, [session.profileId]: session }));
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
      // Auto-select first profile if none selected
      if (result.length > 0 && !selectedProfileId) {
        setSelectedProfileId(result[0].id);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSync(profileId: number) {
    await window.api.sync.startSync(profileId);
  }

  async function handlePause(profileId: number) {
    await window.api.sync.cancelSync(profileId);
  }

  async function handleDelete(profileId: number) {
    await window.api.sync.deleteProfile(profileId);
    setProfiles((prev) => prev.filter((p) => p.id !== profileId));
    if (selectedProfileId === profileId) {
      setSelectedProfileId(profiles.find((p) => p.id !== profileId)?.id || null);
    }
  }

  function handleCreate(profile: SyncProfile) {
    setProfiles((prev) => [profile, ...prev]);
    setSelectedProfileId(profile.id);
    handleSync(profile.id);
  }

  function handleUpdated(updated: SyncProfile) {
    setProfiles((prev) => prev.map((p) => p.id === updated.id ? updated : p));
  }

  async function handleToggleActive(profileId: number, active: boolean) {
    const updated = await window.api.sync.updateProfile(profileId, { isActive: active });
    if (updated) {
      setProfiles((prev) => prev.map((p) => p.id === updated.id ? updated : p));
    }
  }

  async function handleDownloadUpdate() {
    if (!updateAvailable) return;
    const dir = await window.api.localFs.selectDirectory();
    if (!dir) return;

    setDownloading(true);
    setDownloadProgress(0);
    setDownloadedPath(null);
    setUpdateError(null);

    const unsub = window.api.app.onDownloadProgress((p) => setDownloadProgress(p.percent));

    try {
      const zipName = `gsync-${updateAvailable.version}-universal-mac.zip`;
      const downloadUrl = `https://github.com/jpurusho/gdrive/releases/download/v${updateAvailable.version}/${zipName}`;
      const result = await window.api.app.downloadUpdate(downloadUrl, dir);
      if (result.success) {
        setDownloadedPath(result.path);
      }
    } catch (err: any) {
      setUpdateError(err?.message || 'Download failed');
    } finally {
      unsub();
      setDownloading(false);
    }
  }

  const selectedProfile = profiles.find((p) => p.id === selectedProfileId);

  return (
    <Box display="flex" height="100vh" overflow="hidden">
      <Sidebar user={user} currentPage={currentPage} onNavigate={setCurrentPage} onLogout={onLogout} />

      <Box flex={1} display="flex" flexDirection="column" overflow="hidden" sx={{ background: (t) => t.palette.background.default }}>
        {/* Titlebar */}
        <Box
          className="titlebar-drag"
          sx={{
            height: 52,
            flexShrink: 0,
            pl: isFullScreen ? 1 : 10,
            pr: 3,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            transition: 'padding-left 0.2s',
          }}
        >
          <Typography
            variant="subtitle2"
            sx={{
              fontWeight: 800,
              letterSpacing: 0.5,
              background: 'linear-gradient(135deg, #00e5ff, #00bfa5, #64ffda)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              fontSize: 15,
            }}
          >
            {appTitle}
          </Typography>
          <Box display="flex" alignItems="center" gap={2}>
            <Typography
              variant="caption"
              sx={{
                fontWeight: 600,
                background: 'linear-gradient(135deg, #64ffda, #00bfa5)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              {formatDate()}
            </Typography>
            <Tooltip title={updateAvailable ? `Update available: v${updateAvailable.version} — click to download` : `v${version} — up to date`}>
              <Typography
                variant="caption"
                className="titlebar-nodrag"
                onClick={() => updateAvailable && setUpdateDialogOpen(true)}
                sx={{
                  fontWeight: 700,
                  px: 1,
                  py: 0.25,
                  borderRadius: 1,
                  fontSize: 11,
                  cursor: updateAvailable ? 'pointer' : 'default',
                  bgcolor: (t) => updateAvailable
                    ? alpha(t.palette.warning.main, 0.2)
                    : alpha(t.palette.primary.main, 0.12),
                  color: updateAvailable ? 'warning.main' : 'primary.light',
                  animation: updateAvailable ? 'pulse 2s ease-in-out infinite' : 'none',
                  '@keyframes pulse': {
                    '0%, 100%': { opacity: 1 },
                    '50%': { opacity: 0.6 },
                  },
                  '&:hover': updateAvailable ? {
                    bgcolor: (t: any) => alpha(t.palette.warning.main, 0.3),
                  } : {},
                }}
              >
                {updateAvailable ? `v${updateAvailable.version} available` : `v${version}`}
              </Typography>
            </Tooltip>
          </Box>
        </Box>

        {/* Home page — profile command center */}
        {currentPage === 'home' && (
          <Box flex={1} display="flex" flexDirection="column" overflow="hidden">
            {profiles.length === 0 && !loading ? (
              <EmptyState onCreateProfile={() => setCreateOpen(true)} />
            ) : (
              <>
                <StatsBar profiles={profiles} sessions={sessions} />
                <Box flex={1} display="flex" overflow="hidden">
                  <ProfileList
                    profiles={profiles}
                    sessions={sessions}
                    selectedId={selectedProfileId}
                    onSelect={setSelectedProfileId}
                    onAdd={() => setCreateOpen(true)}
                  />
                  {selectedProfile ? (
                    <ProfileDetail
                      profile={selectedProfile}
                      session={sessions[selectedProfile.id]}
                      onSync={() => handleSync(selectedProfile.id)}
                      onPause={() => handlePause(selectedProfile.id)}
                      onDelete={() => handleDelete(selectedProfile.id)}
                      onToggleActive={(active) => handleToggleActive(selectedProfile.id, active)}
                      onUpdated={handleUpdated}
                    />
                  ) : (
                    <Box flex={1} display="flex" alignItems="center" justifyContent="center">
                      <Typography variant="body2" color="text.secondary">
                        Select a profile to view details
                      </Typography>
                    </Box>
                  )}
                </Box>
              </>
            )}
          </Box>
        )}

        {currentPage === 'history' && <History />}
        {currentPage === 'settings' && <Settings />}
        <WelcomeSplash />
      </Box>

      <CreateProfileDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={handleCreate}
      />

      {/* Update dialog */}
      <Dialog
        open={updateDialogOpen}
        onClose={() => !downloading && setUpdateDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3, overflow: 'hidden' } }}
      >
        <Box
          sx={{
            px: 3, py: 2,
            background: (t) => `linear-gradient(135deg, ${alpha(t.palette.warning.main, 0.15)}, ${alpha(t.palette.primary.main, 0.1)})`,
            borderBottom: (t) => `1px solid ${alpha(t.palette.divider, 0.15)}`,
            display: 'flex', alignItems: 'center', gap: 1.5,
          }}
        >
          <SystemUpdateIcon sx={{ color: 'warning.main' }} />
          <Box>
            <Typography variant="h6" fontWeight={700}>Update Available</Typography>
            <Typography variant="caption" color="text.secondary">
              v{version} → v{updateAvailable?.version}
            </Typography>
          </Box>
        </Box>
        <DialogContent sx={{ py: 3 }}>
          {!downloading && !downloadedPath && (
            <Box>
              {updateAvailable?.notes && (
                <Box
                  sx={{
                    mb: 2, p: 2, borderRadius: 2, maxHeight: 200, overflowY: 'auto',
                    bgcolor: (t) => alpha(t.palette.primary.main, 0.04),
                    border: (t) => `1px solid ${alpha(t.palette.primary.light, 0.15)}`,
                  }}
                >
                  <Typography variant="subtitle2" fontWeight={600} mb={1}>What's New</Typography>
                  <Typography variant="caption" color="text.secondary" component="div" whiteSpace="pre-line" lineHeight={1.8}>
                    {updateAvailable.notes}
                  </Typography>
                </Box>
              )}
              <Typography variant="body2" color="text.secondary" mb={2}>
                Your data and profiles won't be affected by the update.
              </Typography>
              <Box display="flex" gap={1}>
                <Button
                  variant="contained"
                  startIcon={<DownloadIcon />}
                  onClick={handleDownloadUpdate}
                >
                  Download v{updateAvailable?.version}
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => updateAvailable?.url && window.api.app.openExternal(updateAvailable.url)}
                >
                  View on GitHub
                </Button>
              </Box>
            </Box>
          )}

          {downloading && (
            <Box>
              <Box display="flex" justifyContent="space-between" mb={1}>
                <Typography variant="body2" color="text.secondary">Downloading...</Typography>
                <Typography variant="body2" fontWeight={700} color="primary.main">{downloadProgress}%</Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={downloadProgress}
                sx={{ height: 8, borderRadius: 4, mb: 1 }}
              />
            </Box>
          )}

          {downloadedPath && (
            <Box>
              <Box
                sx={{
                  p: 2.5, borderRadius: 2,
                  bgcolor: (t) => alpha(t.palette.success.main, 0.08),
                  border: (t) => `1.5px solid ${alpha(t.palette.success.main, 0.2)}`,
                }}
              >
                <Typography variant="body2" fontWeight={700} color="success.main" mb={1.5}>
                  Download complete
                </Typography>
                <Typography variant="caption" color="text.secondary" component="div" lineHeight={2}>
                  <strong>To install:</strong>
                  <ol style={{ margin: '4px 0 0 0', paddingLeft: 18 }}>
                    <li>Quit gsync</li>
                    <li>Extract the downloaded ZIP</li>
                    <li>Replace <code>/Applications/gsync.app</code> with the new one</li>
                    <li>Run: <code>xattr -rc /Applications/gsync.app</code></li>
                    <li>Open gsync</li>
                  </ol>
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1.5, display: 'block', wordBreak: 'break-all' }}>
                  Saved to: {downloadedPath}
                </Typography>
              </Box>
              <Box display="flex" justifyContent="flex-end" mt={2}>
                <Button variant="outlined" onClick={() => setUpdateDialogOpen(false)}>Close</Button>
              </Box>
            </Box>
          )}

          {updateError && (
            <Typography variant="body2" color="error.main" mt={2}>{updateError}</Typography>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}
