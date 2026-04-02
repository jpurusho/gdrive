import React from 'react';
import { Box, Typography } from '@mui/material';
import SyncCards from '../components/SyncCards/SyncCards';

export default function Profiles() {
  return (
    <Box flex={1} overflow="auto" px={4} py={3}>
      <Typography variant="h5" mb={0.5}>Sync Profiles</Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        Manage your sync profiles. Click a card to edit, or create a new one.
      </Typography>
      <SyncCards />
    </Box>
  );
}
