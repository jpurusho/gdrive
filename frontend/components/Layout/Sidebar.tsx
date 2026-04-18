import React, { useState } from 'react';
import {
  Box,
  Avatar,
  Typography,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  IconButton,
  Tooltip,
  alpha,
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import HistoryIcon from '@mui/icons-material/History';
import SettingsIcon from '@mui/icons-material/Settings';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import LogoutIcon from '@mui/icons-material/Logout';
import CloudSyncIcon from '@mui/icons-material/CloudSync';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import MenuIcon from '@mui/icons-material/Menu';
import type { UserInfo } from '../../../shared/types';

interface SidebarProps {
  user: UserInfo;
  currentPage: string;
  onNavigate: (page: any) => void;
  onLogout: () => void;
}

const NAV_ITEMS = [
  { id: 'home', label: 'Home', icon: DashboardIcon },
  { id: 'history', label: 'History', icon: HistoryIcon },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
];

const EXPANDED_WIDTH = 220;
const COLLAPSED_WIDTH = 56;

export default function Sidebar({ user, currentPage, onNavigate, onLogout }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const width = collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH;

  return (
    <Box
      width={width}
      flexShrink={0}
      display="flex"
      flexDirection="column"
      sx={{
        bgcolor: (t) => alpha(t.palette.background.paper, 0.7),
        borderRight: (t) => `1px solid ${alpha(t.palette.divider, 0.3)}`,
        backdropFilter: 'blur(20px)',
        transition: 'width 0.2s ease',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <Box
        className="titlebar-drag"
        sx={{
          height: 52,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: collapsed ? 0 : 2,
          pl: collapsed ? 0 : 9,
          justifyContent: collapsed ? 'center' : 'flex-start',
        }}
      >
        <CloudSyncIcon sx={{ color: 'primary.main', fontSize: 22, flexShrink: 0 }} />
        {!collapsed && (
          <Typography variant="subtitle1" fontWeight={700} letterSpacing={-0.3} noWrap>
            gsync
          </Typography>
        )}
      </Box>

      {/* Nav items */}
      <List sx={{ px: collapsed ? 0.5 : 1, py: 1, flex: 1 }}>
        {NAV_ITEMS.map((item) => (
          <Tooltip key={item.id} title={collapsed ? item.label : ''} placement="right">
            <ListItemButton
              selected={currentPage === item.id}
              onClick={() => onNavigate(item.id)}
              sx={{
                borderRadius: 2,
                mb: 0.5,
                py: 1,
                px: collapsed ? 1 : 2,
                justifyContent: collapsed ? 'center' : 'flex-start',
                minHeight: 40,
                '&.Mui-selected': {
                  bgcolor: (t) => alpha(t.palette.primary.main, 0.15),
                  '&:hover': { bgcolor: (t) => alpha(t.palette.primary.main, 0.2) },
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: collapsed ? 0 : 36, justifyContent: 'center' }}>
                <item.icon
                  sx={{ fontSize: 20, color: currentPage === item.id ? 'primary.main' : 'text.secondary' }}
                />
              </ListItemIcon>
              {!collapsed && (
                <ListItemText
                  primary={item.label}
                  primaryTypographyProps={{ fontSize: 14, fontWeight: currentPage === item.id ? 600 : 400 }}
                />
              )}
            </ListItemButton>
          </Tooltip>
        ))}
      </List>

      {/* Collapse toggle */}
      <Box display="flex" justifyContent="center" py={0.5}>
        <Tooltip title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} placement="right">
          <IconButton
            size="small"
            onClick={() => setCollapsed(!collapsed)}
            sx={{ color: 'text.secondary' }}
          >
            {collapsed ? <MenuIcon sx={{ fontSize: 18 }} /> : <ChevronLeftIcon sx={{ fontSize: 18 }} />}
          </IconButton>
        </Tooltip>
      </Box>

      <Divider sx={{ opacity: 0.3 }} />

      {/* User section */}
      <Box
        display="flex"
        alignItems="center"
        gap={collapsed ? 0 : 1.5}
        p={collapsed ? 1 : 2}
        justifyContent={collapsed ? 'center' : 'flex-start'}
        className="titlebar-nodrag"
      >
        <Tooltip title={collapsed ? `${user.name} — Sign out` : ''} placement="right">
          <Avatar
            src={user.picture}
            sx={{ width: 32, height: 32, cursor: collapsed ? 'pointer' : 'default' }}
            onClick={collapsed ? onLogout : undefined}
          >
            {user.name?.[0] || user.email?.[0]}
          </Avatar>
        </Tooltip>
        {!collapsed && (
          <>
            <Box flex={1} overflow="hidden">
              <Typography variant="body2" fontWeight={500} noWrap>{user.name}</Typography>
              <Typography variant="caption" color="text.secondary" noWrap display="block">{user.email}</Typography>
            </Box>
            <Tooltip title="Sign out">
              <IconButton size="small" onClick={onLogout} sx={{ color: 'text.secondary' }}>
                <LogoutIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </>
        )}
      </Box>
    </Box>
  );
}
