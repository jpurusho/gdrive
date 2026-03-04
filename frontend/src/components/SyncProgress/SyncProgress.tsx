import React from 'react';
import { Paper, Box, Typography, LinearProgress, Chip } from '@mui/material';
import { useSelector } from 'react-redux';
import { RootState } from '../../store/store';

const SyncProgress: React.FC = () => {
  const { activeSync } = useSelector((state: RootState) => state.sync);

  if (!activeSync || activeSync.status !== 'running') {
    return null;
  }

  return (
    <Paper
      elevation={3}
      sx={{
        position: 'fixed',
        bottom: 80,
        right: 16,
        width: 350,
        p: 2,
        zIndex: 1000,
      }}
    >
      <Box sx={{ mb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="subtitle1">Syncing...</Typography>
        <Chip label={`${activeSync.progress.toFixed(0)}%`} size="small" color="primary" />
      </Box>

      <LinearProgress variant="determinate" value={activeSync.progress} sx={{ mb: 1 }} />

      <Typography variant="body2" color="text.secondary">
        {activeSync.filesProcessed} of {activeSync.totalFiles} files
      </Typography>

      {activeSync.currentFile && (
        <Typography variant="caption" color="text.secondary" noWrap>
          {activeSync.currentFile}
        </Typography>
      )}

      {activeSync.bytesTransferred > 0 && (
        <Typography variant="caption" color="text.secondary">
          {(activeSync.bytesTransferred / 1024 / 1024).toFixed(2)} MB transferred
        </Typography>
      )}
    </Paper>
  );
};

export default SyncProgress;