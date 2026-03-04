import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Box,
  Typography,
} from '@mui/material';

interface ProfileDialogProps {
  open: boolean;
  onClose: () => void;
}

const ProfileDialog: React.FC<ProfileDialogProps> = ({ open, onClose }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    sourcePath: '',
    destinationPath: '',
    syncDirection: 'bidirectional',
    allowDeletions: false,
    conflictResolution: 'prompt',
  });

  const handleChange = (e: any) => {
    const { name, value, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: e.target.type === 'checkbox' ? checked : value,
    }));
  };

  const handleSave = () => {
    console.log('Saving profile:', formData);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Create Sync Profile</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <TextField
            name="name"
            label="Profile Name"
            fullWidth
            value={formData.name}
            onChange={handleChange}
            required
          />

          <TextField
            name="description"
            label="Description"
            fullWidth
            multiline
            rows={2}
            value={formData.description}
            onChange={handleChange}
          />

          <TextField
            name="sourcePath"
            label="Source Path"
            fullWidth
            value={formData.sourcePath}
            onChange={handleChange}
            placeholder="/path/to/local/folder or drive://folder-id"
            required
          />

          <TextField
            name="destinationPath"
            label="Destination Path"
            fullWidth
            value={formData.destinationPath}
            onChange={handleChange}
            placeholder="drive://folder-id or /path/to/local/folder"
            required
          />

          <FormControl fullWidth>
            <InputLabel>Sync Direction</InputLabel>
            <Select
              name="syncDirection"
              value={formData.syncDirection}
              onChange={handleChange}
              label="Sync Direction"
            >
              <MenuItem value="bidirectional">Bidirectional</MenuItem>
              <MenuItem value="upload_only">Upload Only (Local → Drive)</MenuItem>
              <MenuItem value="download_only">Download Only (Drive → Local)</MenuItem>
            </Select>
          </FormControl>

          <FormControl fullWidth>
            <InputLabel>Conflict Resolution</InputLabel>
            <Select
              name="conflictResolution"
              value={formData.conflictResolution}
              onChange={handleChange}
              label="Conflict Resolution"
            >
              <MenuItem value="prompt">Prompt Me</MenuItem>
              <MenuItem value="keep_newer">Keep Newer</MenuItem>
              <MenuItem value="keep_local">Keep Local</MenuItem>
              <MenuItem value="keep_remote">Keep Remote</MenuItem>
              <MenuItem value="keep_both">Keep Both</MenuItem>
            </Select>
          </FormControl>

          <FormControlLabel
            control={
              <Switch
                name="allowDeletions"
                checked={formData.allowDeletions}
                onChange={handleChange}
              />
            }
            label="Allow file deletions"
          />

          <Typography variant="caption" color="text.secondary">
            Note: Deletions will always require confirmation before execution
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} variant="contained">
          Create Profile
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ProfileDialog;