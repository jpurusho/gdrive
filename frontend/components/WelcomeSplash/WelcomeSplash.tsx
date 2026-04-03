import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  Box,
  Typography,
  Button,
  FormControlLabel,
  Checkbox,
  Chip,
  alpha,
  useTheme,
} from '@mui/material';
import CloudSyncIcon from '@mui/icons-material/CloudSync';
import SecurityIcon from '@mui/icons-material/Security';
import SpeedIcon from '@mui/icons-material/Speed';
import PaletteIcon from '@mui/icons-material/Palette';
import ScheduleIcon from '@mui/icons-material/Schedule';
import BackupIcon from '@mui/icons-material/Backup';
import { useAppSettings } from '../../context/AppSettingsContext';

const highlights = [
  { icon: CloudSyncIcon, text: 'Bidirectional sync with Google Drive' },
  { icon: SecurityIcon, text: 'MD5 checksum verification — only sync what changed' },
  { icon: SpeedIcon, text: 'Pause & resume large transfers' },
  { icon: ScheduleIcon, text: 'Scheduled auto-sync' },
  { icon: PaletteIcon, text: '6 beautiful themes' },
  { icon: BackupIcon, text: 'Backup settings to Google Drive' },
];

export default function WelcomeSplash() {
  const theme = useTheme();
  const { appTitle } = useAppSettings();
  const [open, setOpen] = useState(false);
  const [dontShow, setDontShow] = useState(false);

  useEffect(() => {
    window.api.app.getSetting('hide_welcome').then((val) => {
      if (val !== 'true') setOpen(true);
    });
  }, []);

  function handleClose() {
    if (dontShow) {
      window.api.app.setSetting('hide_welcome', 'true');
    }
    setOpen(false);
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { borderRadius: 4, overflow: 'hidden' } }}
    >
      {/* Hero header */}
      <Box
        sx={{
          p: 4,
          textAlign: 'center',
          background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.15)}, ${alpha(theme.palette.secondary.main, 0.1)})`,
        }}
      >
        <Box
          sx={{
            width: 64,
            height: 64,
            borderRadius: '16px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
            boxShadow: `0 8px 32px ${alpha(theme.palette.primary.main, 0.3)}`,
            mb: 2,
          }}
        >
          <CloudSyncIcon sx={{ fontSize: 34, color: 'white' }} />
        </Box>
        <Typography
          variant="h5"
          sx={{
            fontWeight: 800,
            mb: 1,
            background: 'linear-gradient(135deg, #00e5ff, #00bfa5, #64ffda)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          Welcome to {appTitle}
        </Typography>
        <Typography variant="body2" color="text.secondary" maxWidth={350} mx="auto" lineHeight={1.7}>
          Sync your Google Drive files with local folders. Fast, reliable, and built for daily use.
        </Typography>
      </Box>

      <DialogContent sx={{ px: 4, py: 3 }}>
        <Typography variant="subtitle2" fontWeight={600} mb={2}>What you can do</Typography>
        <Box display="flex" flexDirection="column" gap={1.5} mb={3}>
          {highlights.map((h) => (
            <Box key={h.text} display="flex" alignItems="center" gap={1.5}>
              <h.icon sx={{ fontSize: 20, color: 'primary.main', flexShrink: 0 }} />
              <Typography variant="body2" color="text.secondary">{h.text}</Typography>
            </Box>
          ))}
        </Box>

        <Typography variant="subtitle2" fontWeight={600} mb={1}>Getting started</Typography>
        <Typography variant="body2" color="text.secondary" lineHeight={1.8} mb={3}>
          1. <strong>Create a sync profile</strong> — pick a Google Drive folder and a local folder{'\n'}
          2. <strong>Choose direction</strong> — download, upload, or bidirectional{'\n'}
          3. <strong>Hit sync</strong> — or set a schedule and let it run automatically
        </Typography>

        <Box display="flex" alignItems="center" justifyContent="space-between">
          <FormControlLabel
            control={<Checkbox checked={dontShow} onChange={(e) => setDontShow(e.target.checked)} size="small" />}
            label={<Typography variant="caption" color="text.secondary">Don't show this again</Typography>}
          />
          <Button
            variant="contained"
            onClick={handleClose}
            sx={{
              background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
            }}
          >
            Get Started
          </Button>
        </Box>
      </DialogContent>
    </Dialog>
  );
}
