import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  ToggleButtonGroup,
  ToggleButton,
  FormControl,
  FormControlLabel,
  Checkbox,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  alpha,
  useTheme,
} from '@mui/material';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import SyncIcon from '@mui/icons-material/Sync';
import CloudIcon from '@mui/icons-material/Cloud';
import FolderIcon from '@mui/icons-material/Folder';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import type { SyncProfile, SyncDirection } from '../../../shared/types';

interface Props {
  open: boolean;
  profile: SyncProfile | null;
  onClose: () => void;
  onSave: (updated: SyncProfile) => void;
  onDelete: () => void;
  onSync: () => void;
}

export default function EditProfileDialog({ open, profile, onClose, onSave, onDelete, onSync }: Props) {
  const theme = useTheme();
  const [name, setName] = useState('');
  const [localPath, setLocalPath] = useState('');
  const [direction, setDirection] = useState<SyncDirection>('download');
  const [useSourceFolderName, setUseSourceFolderName] = useState(false);
  const [fileFilter, setFileFilter] = useState('');
  const [schedule, setSchedule] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setName(profile.name);
      setLocalPath(profile.localPath);
      setDirection(profile.syncDirection);
      setUseSourceFolderName(profile.useSourceFolderName);
      setFileFilter(profile.fileFilter || '');
      setSchedule(profile.schedule || '');
    }
  }, [profile]);

  if (!profile) return null;

  async function handleBrowseLocal() {
    const selected = await window.api.localFs.selectDirectory();
    if (selected) setLocalPath(selected);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const updates: Partial<SyncProfile> = {
        name: name.trim(),
        syncDirection: direction,
        useSourceFolderName,
        fileFilter: fileFilter || undefined,
        schedule: schedule || undefined,
      };
      // Only include localPath if changed
      if (localPath !== profile!.localPath) {
        updates.localPath = localPath;
      }
      const updated = await window.api.sync.updateProfile(profile!.id, updates);
      onSave(updated);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const localChanged = localPath !== profile.localPath;

  const DirIcon = direction === 'download' ? CloudDownloadIcon : direction === 'upload' ? CloudUploadIcon : SyncIcon;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3, overflow: 'hidden' } }}>
      {/* Styled title banner */}
      <Box
        sx={{
          px: 3,
          py: 2,
          background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.2)}, ${alpha(theme.palette.secondary.main, 0.15)})`,
          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.15)}`,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
        }}
      >
        <DirIcon sx={{ fontSize: 24, color: theme.palette.primary.main }} />
        <Box>
          <Typography variant="h6" fontWeight={700} lineHeight={1.2}>
            {profile.name || 'Edit Profile'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Edit sync profile settings
          </Typography>
        </Box>
      </Box>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 2.5 }}>
        <TextField
          label="Profile Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          size="small"
          fullWidth
        />

        {/* Locations */}
        <Box>
          <Typography variant="subtitle2" mb={1}>Google Drive Folder</Typography>
          <Box
            sx={{
              p: 1.5,
              borderRadius: 2,
              border: (t) => `1px solid ${alpha(t.palette.divider, 0.2)}`,
              bgcolor: 'background.default',
              display: 'flex',
              alignItems: 'center',
              gap: 1,
            }}
          >
            <CloudIcon sx={{ fontSize: 16, color: 'primary.main' }} />
            <Typography variant="body2" color="text.secondary" flex={1} noWrap>
              {profile.driveName}: {profile.driveFolderPath}
            </Typography>
          </Box>
          <Typography variant="caption" color="text.secondary" mt={0.5} display="block">
            To change the Drive folder, delete this profile and create a new one.
          </Typography>
        </Box>

        <Box>
          <Typography variant="subtitle2" mb={1}>Local Folder</Typography>
          <Box display="flex" gap={1}>
            <TextField
              size="small"
              fullWidth
              value={localPath}
              InputProps={{
                readOnly: true,
                startAdornment: (
                  <FolderIcon sx={{ fontSize: 16, color: localChanged ? 'primary.main' : 'warning.main', mr: 1 }} />
                ),
              }}
              sx={localChanged ? { '& .MuiOutlinedInput-root': { borderColor: theme.palette.primary.main } } : {}}
            />
            <Button
              variant="outlined"
              onClick={handleBrowseLocal}
              startIcon={<FolderOpenIcon />}
              sx={{ whiteSpace: 'nowrap' }}
            >
              Change
            </Button>
          </Box>
          {localChanged && (
            <Typography variant="caption" color="primary.main" mt={0.5} display="block">
              Changed from: {profile.localPath}
            </Typography>
          )}
        </Box>

        <FormControlLabel
          control={<Checkbox checked={useSourceFolderName} onChange={(e) => setUseSourceFolderName(e.target.checked)} size="small" />}
          label={<Typography variant="body2">Create source folder in destination</Typography>}
        />

        {/* Sync direction */}
        <Box>
          <Typography variant="subtitle2" mb={1}>Sync Direction</Typography>
          <ToggleButtonGroup
            value={direction}
            exclusive
            onChange={(_e, val) => val && setDirection(val)}
            size="small"
            fullWidth
          >
            <ToggleButton value="download">
              <CloudDownloadIcon sx={{ fontSize: 18, mr: 0.75 }} />
              <Typography variant="caption">Download</Typography>
            </ToggleButton>
            <ToggleButton value="upload">
              <CloudUploadIcon sx={{ fontSize: 18, mr: 0.75 }} />
              <Typography variant="caption">Upload</Typography>
            </ToggleButton>
            <ToggleButton value="bidirectional">
              <SyncIcon sx={{ fontSize: 18, mr: 0.75 }} />
              <Typography variant="caption">Bidirectional</Typography>
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>

        {/* File filter */}
        <Box>
          <Typography variant="subtitle2" mb={1}>File Filter</Typography>
          <TextField
            size="small"
            fullWidth
            value={fileFilter}
            onChange={(e) => setFileFilter(e.target.value)}
            placeholder="e.g. *.pdf, *.docx, reports/*"
            helperText="Comma-separated patterns. Leave empty to sync all files."
          />
        </Box>

        {/* Schedule */}
        <Box>
          <Typography variant="subtitle2" mb={1}>Auto-sync Schedule</Typography>
          <FormControl size="small" fullWidth>
            <InputLabel>Schedule</InputLabel>
            <Select value={schedule} label="Schedule" onChange={(e) => setSchedule(e.target.value)}>
              <MenuItem value="">Manual only</MenuItem>
              <MenuItem value="*/15 * * * *">Every 15 minutes</MenuItem>
              <MenuItem value="*/30 * * * *">Every 30 minutes</MenuItem>
              <MenuItem value="0 * * * *">Every hour</MenuItem>
              <MenuItem value="0 */6 * * *">Every 6 hours</MenuItem>
              <MenuItem value="0 0 * * *">Daily at midnight</MenuItem>
              <MenuItem value="0 9 * * 1-5">Weekdays at 9 AM</MenuItem>
            </Select>
          </FormControl>
        </Box>

        {/* Stats */}
        {profile.lastSyncAt && (
          <Box>
            <Typography variant="subtitle2" mb={0.5}>Last Sync</Typography>
            <Typography variant="body2" color="text.secondary">
              {new Date(profile.lastSyncAt).toLocaleString()}
            </Typography>
          </Box>
        )}

        <Box>
          <Typography variant="subtitle2" mb={0.5}>Profile ID</Typography>
          <Chip label={`#${profile.id}`} size="small" variant="outlined" />
          <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>
            Created: {new Date(profile.createdAt).toLocaleString()}
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2, justifyContent: 'space-between' }}>
        <Button color="error" onClick={onDelete}>Delete Profile</Button>
        <Box display="flex" gap={1}>
          <Button variant="outlined" onClick={onSync}>Sync Now</Button>
          <Button onClick={onClose} disabled={saving}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving}
            sx={{
              background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
            }}
          >
            Save Changes
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
}
