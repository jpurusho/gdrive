import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  IconButton,
  Toolbar,
  Button,
  LinearProgress,
  Fab,
  Tooltip,
} from '@mui/material';
import {
  Sync as SyncIcon,
  Settings as SettingsIcon,
  Add as AddIcon,
  PlayArrow as PlayArrowIcon,
  Stop as StopIcon,
} from '@mui/icons-material';
import SplitPane from 'react-split-pane';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../store/store';

// Components
import FileBrowser from '../components/FileBrowser/FileBrowser';
import SyncProfileSelector from '../components/SyncProfileSelector/SyncProfileSelector';
import SyncProgress from '../components/SyncProgress/SyncProgress';
import ConflictDialog from '../components/ConflictDialog/ConflictDialog';
import ProfileDialog from '../components/ProfileDialog/ProfileDialog';

const Dashboard: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { activeSync } = useSelector((state: RootState) => state.sync);
  const { selectedProfile } = useSelector((state: RootState) => state.profiles);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [conflictDialogOpen, setConflictDialogOpen] = useState(false);
  const [splitPos, setSplitPos] = useState('50%');

  const handleStartSync = () => {
    if (selectedProfile) {
      // Start sync logic
      console.log('Starting sync for profile:', selectedProfile.name);
    }
  };

  const handleStopSync = () => {
    // Stop sync logic
    console.log('Stopping sync');
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Top Toolbar */}
      <Paper elevation={1} sx={{ zIndex: 1 }}>
        <Toolbar>
          <SyncProfileSelector />

          <Box sx={{ flexGrow: 1 }} />

          {activeSync && activeSync.status === 'running' ? (
            <Button
              variant="contained"
              color="error"
              startIcon={<StopIcon />}
              onClick={handleStopSync}
              sx={{ mr: 2 }}
            >
              Stop Sync
            </Button>
          ) : (
            <Button
              variant="contained"
              color="primary"
              startIcon={<PlayArrowIcon />}
              onClick={handleStartSync}
              disabled={!selectedProfile}
              sx={{ mr: 2 }}
            >
              Start Sync
            </Button>
          )}

          <Tooltip title="Add Profile">
            <IconButton onClick={() => setProfileDialogOpen(true)}>
              <AddIcon />
            </IconButton>
          </Tooltip>

          <Tooltip title="Settings">
            <IconButton>
              <SettingsIcon />
            </IconButton>
          </Tooltip>
        </Toolbar>

        {/* Sync Progress Bar */}
        {activeSync && activeSync.status === 'running' && (
          <LinearProgress
            variant="determinate"
            value={activeSync.progress}
            sx={{ height: 3 }}
          />
        )}
      </Paper>

      {/* Dual Pane File Browser */}
      <Box sx={{ flexGrow: 1, position: 'relative' }}>
        <SplitPane
          split="vertical"
          minSize={300}
          defaultSize={splitPos}
          onChange={(size) => setSplitPos(size as string)}
          style={{ position: 'relative' }}
        >
          {/* Local Files Pane */}
          <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Paper
              elevation={0}
              sx={{
                p: 1,
                borderBottom: 1,
                borderColor: 'divider',
                backgroundColor: 'grey.50',
              }}
            >
              <Typography variant="h6" component="div">
                Local Files
              </Typography>
            </Paper>
            <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
              <FileBrowser type="local" />
            </Box>
          </Box>

          {/* Google Drive Pane */}
          <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Paper
              elevation={0}
              sx={{
                p: 1,
                borderBottom: 1,
                borderColor: 'divider',
                backgroundColor: 'grey.50',
              }}
            >
              <Typography variant="h6" component="div">
                Google Drive
              </Typography>
            </Paper>
            <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
              <FileBrowser type="drive" />
            </Box>
          </Box>
        </SplitPane>
      </Box>

      {/* Sync Progress Component */}
      {activeSync && <SyncProgress />}

      {/* Floating Action Button for Quick Sync */}
      <Fab
        color="primary"
        aria-label="sync"
        sx={{
          position: 'absolute',
          bottom: 16,
          right: 16,
        }}
        onClick={handleStartSync}
        disabled={!selectedProfile || (activeSync?.status === 'running')}
      >
        <SyncIcon />
      </Fab>

      {/* Dialogs */}
      <ProfileDialog
        open={profileDialogOpen}
        onClose={() => setProfileDialogOpen(false)}
      />
      <ConflictDialog
        open={conflictDialogOpen}
        onClose={() => setConflictDialogOpen(false)}
      />
    </Box>
  );
};

export default Dashboard;