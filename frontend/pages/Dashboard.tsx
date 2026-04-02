import React, { useState } from 'react';
import { Box, alpha } from '@mui/material';
import Sidebar from '../components/Layout/Sidebar';
import DriveTree from '../components/DriveTree/DriveTree';
import LocalTree from '../components/LocalTree/LocalTree';
import SyncCards from '../components/SyncCards/SyncCards';
import Settings from './Settings';
import History from './History';
import type { UserInfo } from '../../shared/types';

interface DashboardProps {
  user: UserInfo;
  onLogout: () => void;
}

type Page = 'dashboard' | 'history' | 'settings';

export default function Dashboard({ user, onLogout }: DashboardProps) {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');

  return (
    <Box display="flex" height="100vh" overflow="hidden">
      <Sidebar user={user} currentPage={currentPage} onNavigate={setCurrentPage} onLogout={onLogout} />

      <Box flex={1} display="flex" flexDirection="column" overflow="hidden" sx={{ background: (t) => t.palette.background.default }}>
        {/* Titlebar drag zone */}
        <Box className="titlebar-drag" sx={{ height: 52, flexShrink: 0, pl: 10, pr: 2 }} />

        {currentPage === 'dashboard' && (
          <Box flex={1} display="flex" flexDirection="column" overflow="hidden" px={3} pb={3} gap={2}>
            <Box flex={1} display="flex" gap={2} minHeight={0}>
              <Box
                flex={1}
                sx={{
                  borderRadius: 3,
                  border: (t) => `1px solid ${alpha(t.palette.divider, 0.3)}`,
                  bgcolor: 'background.paper',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <DriveTree />
              </Box>
              <Box
                flex={1}
                sx={{
                  borderRadius: 3,
                  border: (t) => `1px solid ${alpha(t.palette.divider, 0.3)}`,
                  bgcolor: 'background.paper',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <LocalTree />
              </Box>
            </Box>
            <SyncCards />
          </Box>
        )}

        {currentPage === 'history' && <History />}

        {currentPage === 'settings' && <Settings />}
      </Box>
    </Box>
  );
}
