import React, { useState, useEffect } from 'react';
import { Box, Typography, alpha } from '@mui/material';
import Sidebar from '../components/Layout/Sidebar';
import StatsBar from '../components/StatsBar/StatsBar';
import ProfileList from '../components/ProfileList/ProfileList';
import ProfileDetail from '../components/ProfileDetail/ProfileDetail';
import EmptyState from '../components/EmptyState/EmptyState';
import CreateProfileDialog from '../components/CreateProfileDialog/CreateProfileDialog';
import Settings from './Settings';
import History from './History';
import About from './About';
import WelcomeSplash from '../components/WelcomeSplash/WelcomeSplash';
import { useAppSettings } from '../context/AppSettingsContext';
import type { UserInfo, SyncProfile, SyncSession } from '../../shared/types';

interface DashboardProps {
  user: UserInfo;
  onLogout: () => void;
}

type Page = 'home' | 'history' | 'settings' | 'about';

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

  useEffect(() => {
    window.api.app.getVersion().then(setVersion);
    window.api.app.onFullscreenChange(setIsFullScreen);
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
            <Typography
              variant="caption"
              sx={{
                fontWeight: 700,
                px: 1,
                py: 0.25,
                borderRadius: 1,
                bgcolor: (t) => alpha(t.palette.primary.main, 0.12),
                color: 'primary.light',
                fontSize: 11,
              }}
            >
              v{version}
            </Typography>
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
        {currentPage === 'about' && <About />}

        <WelcomeSplash />
      </Box>

      <CreateProfileDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={handleCreate}
      />
    </Box>
  );
}
