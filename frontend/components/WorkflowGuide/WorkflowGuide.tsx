import React from 'react';
import {
  Box,
  Typography,
  alpha,
  useTheme,
} from '@mui/material';
import CloudIcon from '@mui/icons-material/Cloud';
import FolderIcon from '@mui/icons-material/Folder';
import SyncIcon from '@mui/icons-material/Sync';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import ScheduleIcon from '@mui/icons-material/Schedule';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';

const steps = [
  {
    icon: AddCircleOutlineIcon,
    title: 'Create Profile',
    desc: 'Go to Profiles and click "New Sync Profile"',
    color: 'primary',
  },
  {
    icon: CloudIcon,
    title: 'Select Drive Folder',
    desc: 'Pick a folder from your Google Drive or shared drives',
    color: 'primary',
  },
  {
    icon: FolderIcon,
    title: 'Select Local Folder',
    desc: 'Choose where files will be synced on your machine',
    color: 'warning',
  },
  {
    icon: SyncIcon,
    title: 'Choose Direction',
    desc: 'Download, upload, or bidirectional sync',
    color: 'secondary',
  },
  {
    icon: ScheduleIcon,
    title: 'Set Schedule',
    desc: 'Optional — auto-sync every 15 min, hourly, daily',
    color: 'info',
  },
  {
    icon: CheckCircleOutlineIcon,
    title: 'Sync!',
    desc: 'Files sync automatically. Check status here.',
    color: 'success',
  },
];

export default function WorkflowGuide() {
  const theme = useTheme();

  return (
    <Box
      sx={{
        p: 3,
        borderRadius: 3,
        border: (t) => `1.5px solid ${alpha(t.palette.primary.main, 0.15)}`,
        bgcolor: 'background.paper',
      }}
    >
      <Typography variant="subtitle1" fontWeight={700} mb={0.5}>
        How to get started
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        Create a sync profile to start syncing files between Google Drive and your local folders.
      </Typography>

      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 1,
          overflowX: 'auto',
          pb: 1,
        }}
      >
        {steps.map((step, i) => (
          <React.Fragment key={step.title}>
            <Box
              sx={{
                minWidth: 130,
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 1,
              }}
            >
              <Box
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: alpha((theme.palette as any)[step.color]?.main || theme.palette.primary.main, 0.1),
                  border: `1.5px solid ${alpha((theme.palette as any)[step.color]?.main || theme.palette.primary.main, 0.2)}`,
                }}
              >
                <step.icon sx={{ fontSize: 24, color: `${step.color}.main` }} />
              </Box>
              <Typography variant="caption" fontWeight={600} lineHeight={1.3}>
                {step.title}
              </Typography>
              <Typography variant="caption" color="text.secondary" lineHeight={1.4} sx={{ fontSize: 11 }}>
                {step.desc}
              </Typography>
            </Box>
            {i < steps.length - 1 && (
              <ArrowForwardIcon
                sx={{ fontSize: 16, color: 'text.secondary', opacity: 0.3, mt: 2, flexShrink: 0 }}
              />
            )}
          </React.Fragment>
        ))}
      </Box>
    </Box>
  );
}
