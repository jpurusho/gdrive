import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Box, Typography, alpha } from '@mui/material';
import Sidebar from '../components/Layout/Sidebar';
import DriveTree from '../components/DriveTree/DriveTree';
import LocalTree from '../components/LocalTree/LocalTree';
import SyncStatus from '../components/SyncStatus/SyncStatus';
import Profiles from './Profiles';
import Settings from './Settings';
import History from './History';
import About from './About';
import { useAppSettings } from '../context/AppSettingsContext';
import type { UserInfo } from '../../shared/types';

interface DashboardProps {
  user: UserInfo;
  onLogout: () => void;
}

type Page = 'dashboard' | 'profiles' | 'history' | 'settings' | 'about';

function ResizeHandle({ onDrag }: { onDrag: (deltaY: number) => void }) {
  const dragging = useRef(false);
  const lastY = useRef(0);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    lastY.current = e.clientY;

    const onMouseMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      const delta = ev.clientY - lastY.current;
      lastY.current = ev.clientY;
      onDrag(delta);
    };

    const onMouseUp = () => {
      dragging.current = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  }, [onDrag]);

  return (
    <Box
      onMouseDown={onMouseDown}
      sx={{
        height: 8,
        cursor: 'row-resize',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        mx: 2,
        '&:hover > div, &:active > div': {
          bgcolor: (t) => alpha(t.palette.primary.main, 0.5),
          width: 60,
        },
      }}
    >
      <Box
        sx={{
          width: 40,
          height: 3,
          borderRadius: 1.5,
          bgcolor: (t) => alpha(t.palette.divider, 0.4),
          transition: 'all 0.2s',
        }}
      />
    </Box>
  );
}

function formatDate(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function Dashboard({ user, onLogout }: DashboardProps) {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [statusHeight, setStatusHeight] = useState(180);
  const [version, setVersion] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const { appTitle } = useAppSettings();

  useEffect(() => {
    window.api.app.getVersion().then(setVersion);
  }, []);

  const handleResize = useCallback((deltaY: number) => {
    setStatusHeight((prev) => {
      const containerH = containerRef.current?.clientHeight || 600;
      const maxH = containerH - 200;
      const minH = 80;
      return Math.max(minH, Math.min(maxH, prev - deltaY));
    });
  }, []);

  return (
    <Box display="flex" height="100vh" overflow="hidden">
      <Sidebar user={user} currentPage={currentPage} onNavigate={setCurrentPage} onLogout={onLogout} />

      <Box flex={1} display="flex" flexDirection="column" overflow="hidden" sx={{ background: (t) => t.palette.background.default }}>
        {/* Titlebar with app name, version, date */}
        <Box
          className="titlebar-drag"
          sx={{
            height: 52,
            flexShrink: 0,
            pl: 10,
            pr: 3,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
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

        {currentPage === 'dashboard' && (
          <Box ref={containerRef} flex={1} display="flex" flexDirection="column" overflow="hidden" px={3} pb={3}>
            {/* File trees */}
            <Box flex={1} display="flex" gap={2} minHeight={150}>
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

            <ResizeHandle onDrag={handleResize} />

            <Box sx={{ height: statusHeight, flexShrink: 0, overflowY: 'auto' }}>
              <SyncStatus />
            </Box>
          </Box>
        )}

        {currentPage === 'profiles' && <Profiles />}

        {currentPage === 'history' && <History />}

        {currentPage === 'settings' && <Settings />}

        {currentPage === 'about' && <About />}
      </Box>
    </Box>
  );
}
