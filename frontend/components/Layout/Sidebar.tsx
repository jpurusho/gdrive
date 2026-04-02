import React from 'react';
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
import SyncIcon from '@mui/icons-material/Sync';
import SettingsIcon from '@mui/icons-material/Settings';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import LogoutIcon from '@mui/icons-material/Logout';
import CloudSyncIcon from '@mui/icons-material/CloudSync';
import type { UserInfo } from '../../../shared/types';

interface SidebarProps {
  user: UserInfo;
  currentPage: string;
  onNavigate: (page: any) => void;
  onLogout: () => void;
}

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: DashboardIcon },
  { id: 'profiles', label: 'Profiles', icon: SyncIcon },
  { id: 'history', label: 'History', icon: HistoryIcon },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
  { id: 'about', label: 'About', icon: InfoOutlinedIcon },
];

export default function Sidebar({ user, currentPage, onNavigate, onLogout }: SidebarProps) {
  return (
    <Box
      width={220}
      flexShrink={0}
      display="flex"
      flexDirection="column"
      sx={{
        bgcolor: (t) => alpha(t.palette.background.paper, 0.7),
        borderRight: (t) => `1px solid ${alpha(t.palette.divider, 0.3)}`,
        backdropFilter: 'blur(20px)',
      }}
    >
      <Box
        className="titlebar-drag"
        sx={{ height: 52, display: 'flex', alignItems: 'center', gap: 1.5, px: 2, pl: 9 }}
      >
        <CloudSyncIcon sx={{ color: 'primary.main', fontSize: 22 }} />
        <Typography variant="subtitle1" fontWeight={700} letterSpacing={-0.3}>
          GDrive Sync
        </Typography>
      </Box>

      <List sx={{ px: 1, py: 1, flex: 1 }}>
        {NAV_ITEMS.map((item) => (
          <ListItemButton
            key={item.id}
            selected={currentPage === item.id}
            onClick={() => onNavigate(item.id)}
            sx={{
              borderRadius: 2,
              mb: 0.5,
              py: 1,
              '&.Mui-selected': {
                bgcolor: (t) => alpha(t.palette.primary.main, 0.15),
                '&:hover': { bgcolor: (t) => alpha(t.palette.primary.main, 0.2) },
              },
            }}
          >
            <ListItemIcon sx={{ minWidth: 36 }}>
              <item.icon
                sx={{ fontSize: 20, color: currentPage === item.id ? 'primary.main' : 'text.secondary' }}
              />
            </ListItemIcon>
            <ListItemText
              primary={item.label}
              primaryTypographyProps={{ fontSize: 14, fontWeight: currentPage === item.id ? 600 : 400 }}
            />
          </ListItemButton>
        ))}
      </List>

      <Divider sx={{ opacity: 0.3 }} />
      <Box display="flex" alignItems="center" gap={1.5} p={2} className="titlebar-nodrag">
        <Avatar src={user.picture} sx={{ width: 32, height: 32 }}>
          {user.name?.[0] || user.email?.[0]}
        </Avatar>
        <Box flex={1} overflow="hidden">
          <Typography variant="body2" fontWeight={500} noWrap>{user.name}</Typography>
          <Typography variant="caption" color="text.secondary" noWrap display="block">{user.email}</Typography>
        </Box>
        <Tooltip title="Sign out">
          <IconButton size="small" onClick={onLogout} sx={{ color: 'text.secondary' }}>
            <LogoutIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
}
