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
import GroupWorkIcon from '@mui/icons-material/GroupWork';
import FolderIcon from '@mui/icons-material/Folder';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CircularProgress from '@mui/material/CircularProgress';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Collapse from '@mui/material/Collapse';
import type { SyncProfile, SyncDirection, DriveInfo, DriveFile } from '../../../shared/types';

function FolderPickerNode({
  folder,
  driveId,
  driveName,
  parentPath,
  depth,
  selectedFolderId,
  onSelect,
}: {
  folder: DriveFile;
  driveId: string;
  driveName: string;
  parentPath: string;
  depth: number;
  selectedFolderId: string;
  onSelect: (id: string, name: string, path: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [children, setChildren] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const isSelected = selectedFolderId === folder.id;
  const folderPath = `${parentPath}${folder.name}/`;

  async function handleToggle(e: React.MouseEvent) {
    e.stopPropagation();
    if (!loaded) {
      setLoading(true);
      try {
        const files = await window.api.drive.listFiles(driveId, folder.id);
        setChildren(files.filter((f) => f.isFolder));
        setLoaded(true);
      } finally {
        setLoading(false);
      }
    }
    setOpen(!open);
  }

  return (
    <>
      <ListItemButton
        sx={{
          pl: 3 + depth * 2, py: 0.25,
          bgcolor: isSelected ? (t: any) => alpha(t.palette.success.main, 0.1) : 'transparent',
          borderLeft: isSelected ? (t: any) => `3px solid ${t.palette.success.main}` : '3px solid transparent',
        }}
        onClick={() => onSelect(folder.id, driveName, folderPath)}
      >
        <ListItemIcon sx={{ minWidth: 22 }}>
          {loading ? (
            <CircularProgress size={12} />
          ) : (children.length > 0 || !loaded) ? (
            <Box onClick={handleToggle} sx={{ display: 'flex', cursor: 'pointer' }}>
              {open ? <ExpandMoreIcon sx={{ fontSize: 14, color: 'text.secondary' }} /> : <ChevronRightIcon sx={{ fontSize: 14, color: 'text.secondary' }} />}
            </Box>
          ) : (
            <Box width={14} />
          )}
        </ListItemIcon>
        <ListItemIcon sx={{ minWidth: 22 }}>
          <FolderIcon sx={{ fontSize: 14, color: isSelected ? 'success.main' : 'warning.main' }} />
        </ListItemIcon>
        <ListItemText primary={folder.name} primaryTypographyProps={{ fontSize: 12, fontWeight: isSelected ? 700 : 400 }} />
        {isSelected && <CheckCircleIcon sx={{ fontSize: 14, color: 'success.main' }} />}
      </ListItemButton>
      <Collapse in={open} timeout="auto">
        {children.map((child) => (
          <FolderPickerNode
            key={child.id}
            folder={child}
            driveId={driveId}
            driveName={driveName}
            parentPath={folderPath}
            depth={depth + 1}
            selectedFolderId={selectedFolderId}
            onSelect={onSelect}
          />
        ))}
        {loaded && children.length === 0 && (
          <Typography variant="caption" color="text.secondary" sx={{ pl: 5 + depth * 2, py: 0.5, display: 'block', fontSize: 11 }}>
            No subfolders
          </Typography>
        )}
      </Collapse>
    </>
  );
}

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
  const [changingDrive, setChangingDrive] = useState(false);
  const [driveFolderId, setDriveFolderId] = useState('');
  const [driveFolderPath, setDriveFolderPath] = useState('');
  const [driveName, setDriveName] = useState('');
  const [driveId, setDriveId] = useState('');
  const [drives, setDrives] = useState<DriveInfo[]>([]);
  const [driveFiles, setDriveFiles] = useState<Record<string, DriveFile[]>>({});
  const [expandedDrives, setExpandedDrives] = useState<Set<string>>(new Set());
  const [loadingDrives, setLoadingDrives] = useState(false);

  useEffect(() => {
    if (profile) {
      setName(profile.name);
      setLocalPath(profile.localPath);
      setDirection(profile.syncDirection);
      setUseSourceFolderName(profile.useSourceFolderName);
      setFileFilter(profile.fileFilter || '');
      setSchedule(profile.schedule || '');
      setDriveFolderId(profile.driveFolderId);
      setDriveFolderPath(profile.driveFolderPath);
      setDriveName(profile.driveName);
      setDriveId(profile.driveId);
      setChangingDrive(false);
    }
  }, [profile]);

  if (!profile) return null;

  async function handleBrowseLocal() {
    const selected = await window.api.localFs.selectDirectory();
    if (selected) setLocalPath(selected);
  }

  async function loadDrives() {
    setLoadingDrives(true);
    try {
      const result = await window.api.drive.listDrives();
      setDrives(result);
    } finally {
      setLoadingDrives(false);
    }
  }

  async function toggleDrive(id: string) {
    const newExp = new Set(expandedDrives);
    if (newExp.has(id)) {
      newExp.delete(id);
    } else {
      newExp.add(id);
      if (!driveFiles[id]) {
        const fid = id === 'root' ? 'root' : id;
        const files = await window.api.drive.listFiles(id, fid);
        setDriveFiles((prev) => ({ ...prev, [id]: files.filter((f) => f.isFolder) }));
      }
    }
    setExpandedDrives(newExp);
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
      if (localPath !== profile!.localPath) {
        updates.localPath = localPath;
      }
      if (driveFolderId !== profile!.driveFolderId) {
        updates.driveFolderId = driveFolderId;
        updates.driveFolderPath = driveFolderPath;
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

        {/* Drive Folder */}
        <Box>
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
            <Typography variant="subtitle2">Google Drive Folder</Typography>
            <Button size="small" variant="text" onClick={() => { if (!changingDrive) { setChangingDrive(true); loadDrives(); } else { setChangingDrive(false); } }}>
              {changingDrive ? 'Cancel' : 'Change'}
            </Button>
          </Box>
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
            <Typography variant="body2" color={driveFolderId !== profile.driveFolderId ? 'primary.main' : 'text.secondary'} flex={1} noWrap>
              {driveName}: {driveFolderPath}
            </Typography>
          </Box>
          {changingDrive && (
            <Box
              sx={{
                mt: 1,
                maxHeight: 200,
                overflow: 'auto',
                borderRadius: 2,
                border: (t) => `1px solid ${alpha(t.palette.primary.light, 0.3)}`,
                bgcolor: 'background.default',
              }}
            >
              {loadingDrives ? (
                <Box display="flex" justifyContent="center" py={2}><CircularProgress size={20} /></Box>
              ) : (
                <List dense disablePadding>
                  {drives.map((drive) => (
                    <React.Fragment key={drive.id}>
                      <ListItemButton
                        sx={{
                          py: 0.5,
                          bgcolor: (driveId === drive.id && driveFolderPath === '/')
                            ? (t: any) => alpha(t.palette.success.main, 0.1)
                            : 'transparent',
                          borderLeft: (driveId === drive.id && driveFolderPath === '/')
                            ? (t: any) => `3px solid ${t.palette.success.main}`
                            : '3px solid transparent',
                        }}
                        onClick={() => {
                          toggleDrive(drive.id);
                          const fid = drive.id === 'root' ? 'root' : drive.id;
                          setDriveId(drive.id);
                          setDriveName(drive.name);
                          setDriveFolderId(fid);
                          setDriveFolderPath('/');
                        }}
                      >
                        <ListItemIcon sx={{ minWidth: 24 }}>
                          {expandedDrives.has(drive.id) ? <ExpandMoreIcon sx={{ fontSize: 16 }} /> : <ChevronRightIcon sx={{ fontSize: 16 }} />}
                        </ListItemIcon>
                        <ListItemIcon sx={{ minWidth: 24 }}>
                          {drive.type === 'shared_drive' ? <GroupWorkIcon sx={{ fontSize: 16, color: 'secondary.main' }} /> : <CloudIcon sx={{ fontSize: 16, color: 'primary.main' }} />}
                        </ListItemIcon>
                        <ListItemText primary={drive.name} primaryTypographyProps={{ fontSize: 12, fontWeight: 500 }} />
                        {driveId === drive.id && driveFolderPath === '/' && (
                          <CheckCircleIcon sx={{ fontSize: 16, color: 'success.main', mr: 0.5 }} />
                        )}
                        <Chip label={drive.permission} size="small" sx={{ height: 18, fontSize: 10 }} />
                      </ListItemButton>
                      <Collapse in={expandedDrives.has(drive.id)} timeout="auto">
                        {(driveFiles[drive.id] || []).map((folder) => (
                          <FolderPickerNode
                            key={folder.id}
                            folder={folder}
                            driveId={drive.id}
                            driveName={drive.name}
                            parentPath="/"
                            depth={0}
                            selectedFolderId={driveFolderId}
                            onSelect={(fid, dn, fp) => {
                              setDriveId(drive.id);
                              setDriveName(dn);
                              setDriveFolderId(fid);
                              setDriveFolderPath(fp);
                            }}
                          />
                        ))}
                      </Collapse>
                    </React.Fragment>
                  ))}
                </List>
              )}
            </Box>
          )}
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
