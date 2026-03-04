import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  RadioGroup,
  FormControlLabel,
  Radio,
  Typography,
  Box,
} from '@mui/material';

interface ConflictDialogProps {
  open: boolean;
  onClose: () => void;
}

const ConflictDialog: React.FC<ConflictDialogProps> = ({ open, onClose }) => {
  const [resolution, setResolution] = React.useState('keep_newer');

  const handleResolve = () => {
    console.log('Resolving conflict with:', resolution);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Resolve File Conflict</DialogTitle>
      <DialogContent>
        <Typography variant="body1" gutterBottom>
          The file "document.pdf" exists in both locations with different versions.
        </Typography>

        <Box sx={{ my: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Local: Modified 2 hours ago (2.5 MB)
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Drive: Modified 1 hour ago (2.3 MB)
          </Typography>
        </Box>

        <RadioGroup value={resolution} onChange={(e) => setResolution(e.target.value)}>
          <FormControlLabel
            value="keep_newer"
            control={<Radio />}
            label="Keep newer version (Drive)"
          />
          <FormControlLabel
            value="keep_local"
            control={<Radio />}
            label="Keep local version"
          />
          <FormControlLabel
            value="keep_remote"
            control={<Radio />}
            label="Keep Drive version"
          />
          <FormControlLabel
            value="keep_both"
            control={<Radio />}
            label="Keep both (rename one)"
          />
        </RadioGroup>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleResolve} variant="contained">
          Resolve
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ConflictDialog;