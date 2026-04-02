import React from 'react';
import { Box, Typography, alpha } from '@mui/material';
import SyncIcon from '@mui/icons-material/Sync';

export default function SyncCards() {
  return (
    <Box
      sx={{
        minHeight: 140,
        borderRadius: 3,
        border: (t) => `1px dashed ${alpha(t.palette.divider, 0.3)}`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1,
        py: 3,
      }}
    >
      <SyncIcon sx={{ fontSize: 32, color: 'text.secondary', opacity: 0.4 }} />
      <Typography variant="body2" color="text.secondary" textAlign="center">
        Sync profiles will appear here.
      </Typography>
      <Typography variant="caption" color="text.secondary" textAlign="center" sx={{ opacity: 0.6 }}>
        Select a Google Drive folder and a local folder to create a sync profile (coming in Phase 2).
      </Typography>
    </Box>
  );
}
