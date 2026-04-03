import React from 'react';
import { Box, Typography, Button, alpha, useTheme } from '@mui/material';
import CloudSyncIcon from '@mui/icons-material/CloudSync';
import AddIcon from '@mui/icons-material/Add';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import SecurityIcon from '@mui/icons-material/Security';
import ScheduleIcon from '@mui/icons-material/Schedule';
import PauseCircleOutlineIcon from '@mui/icons-material/PauseCircleOutline';
import PaletteIcon from '@mui/icons-material/Palette';
import BackupIcon from '@mui/icons-material/Backup';
import { useAppSettings } from '../../context/AppSettingsContext';

interface Props {
  onCreateProfile: () => void;
}

const features = [
  { icon: CheckCircleOutlineIcon, text: 'MD5 checksum verification' },
  { icon: PauseCircleOutlineIcon, text: 'Pause & resume transfers' },
  { icon: ScheduleIcon, text: 'Scheduled auto-sync' },
  { icon: SecurityIcon, text: 'Safe mode — never deletes' },
  { icon: PaletteIcon, text: '6 themes to choose from' },
  { icon: BackupIcon, text: 'Backup settings to Drive' },
];

export default function EmptyState({ onCreateProfile }: Props) {
  const theme = useTheme();
  const { appTitle } = useAppSettings();

  return (
    <Box
      flex={1}
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      p={4}
    >
      <Box
        sx={{
          maxWidth: 500,
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2.5,
        }}
      >
        {/* Icon */}
        <Box
          sx={{
            width: 72,
            height: 72,
            borderRadius: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
            boxShadow: `0 8px 32px ${alpha(theme.palette.primary.main, 0.3)}`,
          }}
        >
          <CloudSyncIcon sx={{ fontSize: 38, color: 'white' }} />
        </Box>

        {/* Title */}
        <Typography
          variant="h5"
          sx={{
            fontWeight: 800,
            background: 'linear-gradient(135deg, #00e5ff, #00bfa5, #64ffda)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          Welcome to {appTitle}
        </Typography>

        {/* Description */}
        <Typography variant="body2" color="text.secondary" lineHeight={1.7} maxWidth={400}>
          Sync your Google Drive files with local folders. Create a profile to map a Drive folder
          to a local folder, choose a direction, and let gsync handle the rest.
        </Typography>

        {/* How it works */}
        <Box
          sx={{
            display: 'flex',
            gap: 3,
            mb: 1,
          }}
        >
          {['Pick a Drive folder', 'Choose local folder', 'Sync!'].map((step, i) => (
            <Box key={step} display="flex" flexDirection="column" alignItems="center" gap={0.5}>
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: alpha(theme.palette.primary.main, 0.1),
                  border: `1.5px solid ${alpha(theme.palette.primary.light, 0.3)}`,
                }}
              >
                <Typography variant="caption" fontWeight={700} color="primary.main">{i + 1}</Typography>
              </Box>
              <Typography variant="caption" color="text.secondary" textAlign="center" sx={{ maxWidth: 100 }}>
                {step}
              </Typography>
            </Box>
          ))}
        </Box>

        {/* CTA */}
        <Button
          variant="contained"
          size="large"
          startIcon={<AddIcon />}
          onClick={onCreateProfile}
          sx={{
            px: 4,
            py: 1.5,
            fontSize: '1rem',
            background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
          }}
        >
          Create Your First Profile
        </Button>

        {/* Feature list */}
        <Box display="flex" flexWrap="wrap" justifyContent="center" gap={2} mt={1}>
          {features.map((f) => (
            <Box key={f.text} display="flex" alignItems="center" gap={0.75}>
              <f.icon sx={{ fontSize: 14, color: 'text.secondary', opacity: 0.6 }} />
              <Typography variant="caption" color="text.secondary">{f.text}</Typography>
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
}
