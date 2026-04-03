import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  FormControlLabel,
  Checkbox,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Collapse,
  Chip,
  ToggleButtonGroup,
  ToggleButton,
  alpha,
  useTheme,
} from '@mui/material';
import CloudIcon from '@mui/icons-material/Cloud';
import GroupWorkIcon from '@mui/icons-material/GroupWork';
import FolderIcon from '@mui/icons-material/Folder';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import SyncIcon from '@mui/icons-material/Sync';
import type { DriveInfo, DriveFile, SyncProfile, SyncDirection, DrivePermission } from '../../../shared/types';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreate: (profile: SyncProfile) => void;
}

interface FolderSelection {
  driveId: string;
  driveName: string;
  driveType: 'my_drive' | 'shared_drive';
  folderId: string;
  folderPath: string;
  permission: DrivePermission;
}

function DriveFolderPicker({ onSelect }: { onSelect: (sel: FolderSelection) => void }) {
  const [drives, setDrives] = useState<DriveInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedDrives, setExpandedDrives] = useState<Set<string>>(new Set());
  const [driveFiles, setDriveFiles] = useState<Record<string, DriveFile[]>>({});
  const [expandedFolders, setExpandedFolders] = useState<Record<string, DriveFile[]>>({});
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setDrives(await window.api.drive.listDrives());
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function toggleDrive(drive: DriveInfo) {
    const id = drive.id;
    const newExp = new Set(expandedDrives);
    if (newExp.has(id)) {
      newExp.delete(id);
    } else {
      newExp.add(id);
      if (!driveFiles[id]) {
        setLoadingIds((p) => new Set(p).add(id));
        try {
          const fid = id === 'root' ? 'root' : id;
          const files = await window.api.drive.listFiles(id, fid);
          setDriveFiles((p) => ({ ...p, [id]: files }));
        } finally {
          setLoadingIds((p) => { const n = new Set(p); n.delete(id); return n; });
        }
      }
    }
    setExpandedDrives(newExp);
  }

  function selectDriveRoot(drive: DriveInfo) {
    const key = `drive:${drive.id}`;
    setSelected(key);
    onSelect({
      driveId: drive.id,
      driveName: drive.name,
      driveType: drive.type,
      folderId: drive.id === 'root' ? 'root' : drive.id,
      folderPath: '/',
      permission: drive.permission,
    });
  }

  async function toggleFolder(driveId: string, folder: DriveFile, parentPath: string, permission: DrivePermission, driveInfo: DriveInfo) {
    const fkey = folder.id;
    if (expandedFolders[fkey]) {
      const copy = { ...expandedFolders };
      delete copy[fkey];
      setExpandedFolders(copy);
    } else {
      setLoadingIds((p) => new Set(p).add(fkey));
      try {
        const files = await window.api.drive.listFiles(driveId, folder.id);
        setExpandedFolders((p) => ({ ...p, [fkey]: files }));
      } finally {
        setLoadingIds((p) => { const n = new Set(p); n.delete(fkey); return n; });
      }
    }
    selectFolder(driveId, folder, parentPath, permission, driveInfo);
  }

  function selectFolder(driveId: string, folder: DriveFile, parentPath: string, permission: DrivePermission, driveInfo: DriveInfo) {
    const key = `folder:${folder.id}`;
    setSelected(key);
    onSelect({
      driveId,
      driveName: driveInfo.name,
      driveType: driveInfo.type,
      folderId: folder.id,
      folderPath: `${parentPath}${folder.name}/`,
      permission,
    });
  }

  function renderFolders(driveId: string, files: DriveFile[], depth: number, parentPath: string, permission: DrivePermission, driveInfo: DriveInfo) {
    const folders = files.filter((f) => f.isFolder);
    if (folders.length === 0 && depth > 0) {
      return (
        <Typography variant="caption" color="text.secondary" sx={{ pl: 2 + depth * 2, py: 0.5, display: 'block' }}>
          No subfolders
        </Typography>
      );
    }
    return folders.map((folder) => {
      const fkey = folder.id;
      const isExpanded = !!expandedFolders[fkey];
      const isSelected = selected === `folder:${fkey}`;
      return (
        <React.Fragment key={fkey}>
          <ListItemButton
            selected={isSelected}
            onClick={() => toggleFolder(driveId, folder, parentPath, permission, driveInfo)}
            sx={{ pl: 2 + depth * 2, py: 0.5 }}
          >
            <ListItemIcon sx={{ minWidth: 24 }}>
              {loadingIds.has(fkey) ? <CircularProgress size={14} /> : isExpanded ? <ExpandMoreIcon sx={{ fontSize: 16 }} /> : <ChevronRightIcon sx={{ fontSize: 16 }} />}
            </ListItemIcon>
            <ListItemIcon sx={{ minWidth: 24 }}>
              {isExpanded ? <FolderOpenIcon sx={{ fontSize: 16, color: 'warning.main' }} /> : <FolderIcon sx={{ fontSize: 16, color: 'warning.main' }} />}
            </ListItemIcon>
            <ListItemText primary={folder.name} primaryTypographyProps={{ fontSize: 13, noWrap: true }} />
          </ListItemButton>
          {isExpanded && expandedFolders[fkey] && (
            <Collapse in>
              {renderFolders(driveId, expandedFolders[fkey], depth + 1, `${parentPath}${folder.name}/`, permission, driveInfo)}
            </Collapse>
          )}
        </React.Fragment>
      );
    });
  }

  if (loading) return <Box display="flex" justifyContent="center" py={3}><CircularProgress size={24} /></Box>;

  return (
    <List dense disablePadding sx={{ maxHeight: 300, overflow: 'auto' }}>
      {drives.map((drive) => {
        const isExpanded = expandedDrives.has(drive.id);
        const isDriveSelected = selected === `drive:${drive.id}`;
        return (
          <React.Fragment key={drive.id}>
            <ListItemButton selected={isDriveSelected} sx={{ py: 0.75 }}>
              <ListItemIcon sx={{ minWidth: 24 }} onClick={() => toggleDrive(drive)}>
                {loadingIds.has(drive.id) ? <CircularProgress size={14} /> : isExpanded ? <ExpandMoreIcon sx={{ fontSize: 16 }} /> : <ChevronRightIcon sx={{ fontSize: 16 }} />}
              </ListItemIcon>
              <ListItemIcon sx={{ minWidth: 24 }}>
                {drive.type === 'shared_drive' ? <GroupWorkIcon sx={{ fontSize: 16, color: 'secondary.main' }} /> : <CloudIcon sx={{ fontSize: 16, color: 'primary.main' }} />}
              </ListItemIcon>
              <ListItemText
                primary={drive.name}
                onClick={() => { selectDriveRoot(drive); toggleDrive(drive); }}
                primaryTypographyProps={{ fontSize: 13, fontWeight: 500 }}
              />
              <Chip label={drive.permission} size="small" sx={{ height: 18, fontSize: 10 }} />
            </ListItemButton>
            <Collapse in={isExpanded} timeout="auto">
              {driveFiles[drive.id] && renderFolders(drive.id, driveFiles[drive.id], 1, '/', drive.permission, drive)}
            </Collapse>
          </React.Fragment>
        );
      })}
    </List>
  );
}

export default function CreateProfileDialog({ open, onClose, onCreate }: Props) {
  const theme = useTheme();
  const [name, setName] = useState('');
  const [folderSel, setFolderSel] = useState<FolderSelection | null>(null);
  const [localPath, setLocalPath] = useState('');
  const [direction, setDirection] = useState<SyncDirection>('download');
  const [useSourceFolderName, setUseSourceFolderName] = useState(true);
  const [fileFilter, setFileFilter] = useState('');
  const [schedule, setSchedule] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  // Constrain direction based on drive permission
  const isReadOnly = folderSel?.permission === 'reader';

  useEffect(() => {
    if (isReadOnly && direction !== 'download') {
      setDirection('download');
    }
  }, [folderSel, isReadOnly, direction]);

  function reset() {
    setName('');
    setFolderSel(null);
    setLocalPath('');
    setDirection('download');
    setUseSourceFolderName(true);
    setFileFilter('');
    setSchedule('');
    setError('');
  }

  async function handleBrowseLocal() {
    const selected = await window.api.localFs.selectDirectory();
    if (selected) setLocalPath(selected);
  }

  async function handleCreate() {
    if (!name.trim()) { setError('Profile name is required'); return; }
    if (!folderSel) { setError('Select a Google Drive folder'); return; }
    if (!localPath) { setError('Select a local folder'); return; }
    setError('');
    setCreating(true);
    try {
      const profile = await window.api.sync.createProfile({
        name: name.trim(),
        driveId: folderSel.driveId,
        driveName: folderSel.driveName,
        driveType: folderSel.driveType,
        driveFolderId: folderSel.folderId,
        driveFolderPath: folderSel.folderPath,
        localPath,
        syncDirection: direction,
        useSourceFolderName,
        fileFilter: fileFilter || undefined,
        schedule: schedule || undefined,
        isActive: true,
      });
      onCreate(profile);
      reset();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to create profile');
    } finally {
      setCreating(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ fontWeight: 600 }}>Create Sync Profile</DialogTitle>
      <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 2 }}>
        <TextField
          label="Profile Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          size="small"
          fullWidth
          placeholder="e.g. Work Documents"
        />

        {/* Drive folder picker */}
        <Box>
          <Typography variant="subtitle2" mb={1}>Google Drive Folder</Typography>
          <Box
            sx={{
              border: `1px solid ${alpha(theme.palette.divider, 0.3)}`,
              borderRadius: 2,
              bgcolor: 'background.default',
              overflow: 'hidden',
            }}
          >
            <DriveFolderPicker onSelect={setFolderSel} />
          </Box>
          {folderSel && (
            <Typography variant="caption" color="primary.main" mt={0.5} display="block">
              {folderSel.driveName}: {folderSel.folderPath}
            </Typography>
          )}
        </Box>

        {/* Local folder */}
        <Box>
          <Typography variant="subtitle2" mb={1}>Local Folder</Typography>
          <Box display="flex" gap={1}>
            <TextField
              size="small"
              fullWidth
              value={localPath}
              placeholder="Select a local folder..."
              InputProps={{ readOnly: true }}
            />
            <Button variant="outlined" onClick={handleBrowseLocal} sx={{ whiteSpace: 'nowrap' }}>
              Browse
            </Button>
          </Box>
        </Box>

        {/* Source folder name option */}
        <FormControlLabel
          control={<Checkbox checked={useSourceFolderName} onChange={(e) => setUseSourceFolderName(e.target.checked)} size="small" />}
          label={<Typography variant="body2">Create source folder in destination (e.g., <code>{folderSel ? folderSel.folderPath.split('/').filter(Boolean).pop() || folderSel.driveName : 'My Folder'}/</code>)</Typography>}
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
            <ToggleButton value="upload" disabled={isReadOnly}>
              <CloudUploadIcon sx={{ fontSize: 18, mr: 0.75 }} />
              <Typography variant="caption">Upload</Typography>
            </ToggleButton>
            <ToggleButton value="bidirectional" disabled={isReadOnly}>
              <SyncIcon sx={{ fontSize: 18, mr: 0.75 }} />
              <Typography variant="caption">Bidirectional</Typography>
            </ToggleButton>
          </ToggleButtonGroup>
          {isReadOnly && (
            <Typography variant="caption" color="warning.main" mt={0.5} display="block">
              This drive is read-only. Only download is available.
            </Typography>
          )}
        </Box>

        {/* File filter */}
        <Box>
          <Typography variant="subtitle2" mb={1}>File Filter (optional)</Typography>
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
          <Typography variant="subtitle2" mb={1}>Auto-sync Schedule (optional)</Typography>
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

        {error && (
          <Typography variant="body2" color="error.main">{error}</Typography>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={() => { reset(); onClose(); }} disabled={creating}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleCreate}
          disabled={creating}
          sx={{
            background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
          }}
        >
          {creating ? <CircularProgress size={20} color="inherit" /> : 'Create Profile'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
