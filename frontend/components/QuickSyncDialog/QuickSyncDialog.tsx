import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Button,
  ToggleButtonGroup,
  ToggleButton,
  Checkbox,
  FormControlLabel,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Chip,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Collapse,
  CircularProgress,
  Stepper,
  Step,
  StepLabel,
  alpha,
  useTheme,
} from '@mui/material';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CloudIcon from '@mui/icons-material/Cloud';
import GroupWorkIcon from '@mui/icons-material/GroupWork';
import FolderIcon from '@mui/icons-material/Folder';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AddIcon from '@mui/icons-material/Add';
import CreateNewFolderIcon from '@mui/icons-material/CreateNewFolder';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import type { SyncProfile, SyncDirection, DriveInfo, DriveFile } from '../../../shared/types';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (profiles: SyncProfile[]) => void;
}

interface SourceFolder {
  driveId: string;
  driveName: string;
  driveType: 'my_drive' | 'shared_drive';
  folderId: string;
  folderPath: string;
  folderName: string;
}

const STEPS = ['Direction', 'Sources', 'Destination', 'Options', 'Review'];

export default function QuickSyncDialog({ open, onClose, onCreated }: Props) {
  const theme = useTheme();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<'download' | 'upload'>('download');
  const [creating, setCreating] = useState(false);

  // Sources
  const [selectedSources, setSelectedSources] = useState<SourceFolder[]>([]);
  const [localSources, setLocalSources] = useState<string[]>([]);

  // Destination
  const [destLocalPath, setDestLocalPath] = useState('');
  const [destDriveId, setDestDriveId] = useState('');
  const [destDriveName, setDestDriveName] = useState('');
  const [destDriveType, setDestDriveType] = useState<'my_drive' | 'shared_drive'>('my_drive');
  const [destFolderId, setDestFolderId] = useState('');
  const [destFolderPath, setDestFolderPath] = useState('');

  // Options
  const [convertHeic, setConvertHeic] = useState(false);
  const [mirrorMode, setMirrorMode] = useState(false);
  const [schedule, setSchedule] = useState('');
  const [customCron, setCustomCron] = useState('');

  // Drive picker state
  const [drives, setDrives] = useState<DriveInfo[]>([]);
  const [driveFiles, setDriveFiles] = useState<Record<string, DriveFile[]>>({});
  const [expandedDrives, setExpandedDrives] = useState<Set<string>>(new Set());
  const [expandedFolders, setExpandedFolders] = useState<Record<string, DriveFile[]>>({});
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());
  const [loadingDrives, setLoadingDrives] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderParent, setNewFolderParent] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);

  useEffect(() => {
    if (open) {
      setStep(0);
      setSelectedSources([]);
      setLocalSources([]);
      setDestLocalPath('');
      setDestFolderId('');
      setDrives([]);
    }
  }, [open]);

  async function loadDrives() {
    if (drives.length > 0) return;
    setLoadingDrives(true);
    try {
      setDrives(await window.api.drive.listDrives());
    } finally {
      setLoadingDrives(false);
    }
  }

  async function toggleDrive(drive: DriveInfo) {
    const exp = new Set(expandedDrives);
    if (exp.has(drive.id)) {
      exp.delete(drive.id);
    } else {
      exp.add(drive.id);
      if (!driveFiles[drive.id]) {
        setLoadingIds((p) => new Set(p).add(drive.id));
        try {
          const fid = drive.id === 'root' ? 'root' : drive.id;
          const files = await window.api.drive.listFiles(drive.id, fid);
          setDriveFiles((p) => ({ ...p, [drive.id]: files.filter((f) => f.isFolder) }));
        } finally {
          setLoadingIds((p) => { const n = new Set(p); n.delete(drive.id); return n; });
        }
      }
    }
    setExpandedDrives(exp);
  }

  async function toggleFolder(driveId: string, folder: DriveFile) {
    const key = folder.id;
    if (expandedFolders[key]) {
      const copy = { ...expandedFolders };
      delete copy[key];
      setExpandedFolders(copy);
    } else {
      setLoadingIds((p) => new Set(p).add(key));
      try {
        const files = await window.api.drive.listFiles(driveId, folder.id);
        setExpandedFolders((p) => ({ ...p, [key]: files.filter((f) => f.isFolder) }));
      } finally {
        setLoadingIds((p) => { const n = new Set(p); n.delete(key); return n; });
      }
    }
  }

  function isSourceSelected(folderId: string): boolean {
    return selectedSources.some((s) => s.folderId === folderId);
  }

  function toggleSource(drive: DriveInfo, folderId: string, folderPath: string, folderName: string) {
    if (isSourceSelected(folderId)) {
      setSelectedSources((prev) => prev.filter((s) => s.folderId !== folderId));
    } else {
      setSelectedSources((prev) => [...prev, {
        driveId: drive.id, driveName: drive.name, driveType: drive.type,
        folderId, folderPath, folderName,
      }]);
    }
  }

  function selectDest(drive: DriveInfo, folderId: string, folderPath: string) {
    setDestDriveId(drive.id);
    setDestDriveName(drive.name);
    setDestDriveType(drive.type);
    setDestFolderId(folderId);
    setDestFolderPath(folderPath);
  }

  async function handleAddLocalSource() {
    const dir = await window.api.localFs.selectDirectory();
    if (dir && !localSources.includes(dir)) {
      setLocalSources((prev) => [...prev, dir]);
    }
  }

  async function handleCreateFolder() {
    if (!newFolderName.trim() || !newFolderParent) return;
    setCreatingFolder(true);
    try {
      const parentDriveId = destDriveId || 'root';
      const folderId = await window.api.drive.createFolder(newFolderName.trim(), newFolderParent, parentDriveId);
      // Refresh the parent's file list
      const files = await window.api.drive.listFiles(parentDriveId, newFolderParent);
      setDriveFiles((p) => ({ ...p, [newFolderParent]: files.filter((f) => f.isFolder) }));
      if (expandedFolders[newFolderParent]) {
        setExpandedFolders((p) => ({ ...p, [newFolderParent]: files.filter((f) => f.isFolder) }));
      }
      setNewFolderName('');
    } finally {
      setCreatingFolder(false);
    }
  }

  async function handleCreate() {
    setCreating(true);
    try {
      const profiles: SyncProfile[] = [];
      const sources = direction === 'download' ? selectedSources : localSources.map((p) => ({ localPath: p, name: p.split('/').pop() || 'Sync' }));
      const effectiveSchedule = schedule === 'custom' ? customCron : schedule;

      for (const source of sources) {
        if (direction === 'download') {
          const s = source as SourceFolder;
          const profile = await window.api.sync.createProfile({
            name: s.folderName,
            driveId: s.driveId,
            driveName: s.driveName,
            driveType: s.driveType,
            driveFolderId: s.folderId,
            driveFolderPath: s.folderPath,
            localPath: destLocalPath,
            syncDirection: 'download',
            useSourceFolderName: true,
            convertHeicToJpeg: convertHeic,
            mirrorMode,
            maxDepth: 0,
            schedule: effectiveSchedule || undefined,
            isActive: true,
          });
          profiles.push(profile);
          window.api.sync.startSync(profile.id);
        } else {
          const s = source as { localPath: string; name: string };
          const profile = await window.api.sync.createProfile({
            name: s.name,
            driveId: destDriveId || 'root',
            driveName: destDriveName || 'My Drive',
            driveType: destDriveType,
            driveFolderId: destFolderId || 'root',
            driveFolderPath: destFolderPath || '/',
            localPath: s.localPath,
            syncDirection: 'upload',
            useSourceFolderName: true,
            convertHeicToJpeg: convertHeic,
            mirrorMode,
            maxDepth: 0,
            schedule: effectiveSchedule || undefined,
            isActive: true,
          });
          profiles.push(profile);
          window.api.sync.startSync(profile.id);
        }
      }
      onCreated(profiles);
      onClose();
    } finally {
      setCreating(false);
    }
  }

  const sourceCount = direction === 'download' ? selectedSources.length : localSources.length;
  const hasDest = direction === 'download' ? !!destLocalPath : !!destFolderId;
  const canCreate = sourceCount > 0 && hasDest;

  function renderDriveFolders(driveId: string, folders: DriveFile[], depth: number, drive: DriveInfo, parentPath: string, mode: 'source' | 'dest') {
    return folders.map((folder) => {
      const isExp = !!expandedFolders[folder.id];
      const folderPath = `${parentPath}${folder.name}/`;
      const isSelected = mode === 'source' ? isSourceSelected(folder.id) : destFolderId === folder.id;

      return (
        <React.Fragment key={folder.id}>
          <ListItemButton
            sx={{
              pl: 2 + depth * 2, py: 0.25,
              bgcolor: isSelected ? (t: any) => alpha(t.palette.success.main, 0.1) : 'transparent',
              borderLeft: isSelected ? (t: any) => `3px solid ${t.palette.success.main}` : '3px solid transparent',
            }}
            onClick={() => {
              if (mode === 'source') toggleSource(drive, folder.id, folderPath, folder.name);
              else selectDest(drive, folder.id, folderPath);
              toggleFolder(driveId, folder);
            }}
          >
            {mode === 'source' && (
              <Checkbox size="small" checked={isSelected} sx={{ p: 0, mr: 0.5 }} />
            )}
            <ListItemIcon sx={{ minWidth: 22 }}>
              {loadingIds.has(folder.id) ? <CircularProgress size={12} /> : isExp ? <ExpandMoreIcon sx={{ fontSize: 14 }} /> : <ChevronRightIcon sx={{ fontSize: 14 }} />}
            </ListItemIcon>
            <ListItemIcon sx={{ minWidth: 22 }}>
              <FolderIcon sx={{ fontSize: 14, color: isSelected ? 'success.main' : 'warning.main' }} />
            </ListItemIcon>
            <ListItemText primary={folder.name} primaryTypographyProps={{ fontSize: 12, fontWeight: isSelected ? 700 : 400 }} />
            {isSelected && <CheckCircleIcon sx={{ fontSize: 14, color: 'success.main' }} />}
          </ListItemButton>
          {isExp && expandedFolders[folder.id] && (
            <Collapse in>
              {renderDriveFolders(driveId, expandedFolders[folder.id], depth + 1, drive, folderPath, mode)}
            </Collapse>
          )}
        </React.Fragment>
      );
    });
  }

  function renderDriveTree(mode: 'source' | 'dest') {
    return (
      <Box sx={{ maxHeight: 250, overflow: 'auto', borderRadius: 2, border: (t) => `1.5px solid ${alpha(t.palette.primary.light, 0.3)}`, bgcolor: 'background.default' }}>
        {loadingDrives ? <Box display="flex" justifyContent="center" py={2}><CircularProgress size={20} /></Box> : (
          <List dense disablePadding>
            {drives.map((drive) => {
              if (drive.id === 'shared_with_me') return null;
              const isExp = expandedDrives.has(drive.id);
              const isDriveSelected = mode === 'source' ? isSourceSelected(drive.id === 'root' ? 'root' : drive.id) : destFolderId === (drive.id === 'root' ? 'root' : drive.id);

              return (
                <React.Fragment key={drive.id}>
                  <ListItemButton
                    sx={{
                      py: 0.5,
                      bgcolor: isDriveSelected ? (t: any) => alpha(t.palette.success.main, 0.1) : 'transparent',
                      borderLeft: isDriveSelected ? (t: any) => `3px solid ${t.palette.success.main}` : '3px solid transparent',
                    }}
                    onClick={() => {
                      const fid = drive.id === 'root' ? 'root' : drive.id;
                      if (mode === 'source') toggleSource(drive, fid, '/', drive.name);
                      else selectDest(drive, fid, '/');
                      toggleDrive(drive);
                    }}
                  >
                    {mode === 'source' && <Checkbox size="small" checked={isDriveSelected} sx={{ p: 0, mr: 0.5 }} />}
                    <ListItemIcon sx={{ minWidth: 22 }}>
                      {loadingIds.has(drive.id) ? <CircularProgress size={14} /> : isExp ? <ExpandMoreIcon sx={{ fontSize: 16 }} /> : <ChevronRightIcon sx={{ fontSize: 16 }} />}
                    </ListItemIcon>
                    <ListItemIcon sx={{ minWidth: 22 }}>
                      {drive.type === 'shared_drive' ? <GroupWorkIcon sx={{ fontSize: 16, color: 'secondary.main' }} /> : <CloudIcon sx={{ fontSize: 16, color: 'primary.main' }} />}
                    </ListItemIcon>
                    <ListItemText primary={drive.name} primaryTypographyProps={{ fontSize: 12, fontWeight: 500 }} />
                    {isDriveSelected && <CheckCircleIcon sx={{ fontSize: 14, color: 'success.main' }} />}
                  </ListItemButton>
                  <Collapse in={isExp} timeout="auto">
                    {driveFiles[drive.id] && renderDriveFolders(drive.id, driveFiles[drive.id], 1, drive, '/', mode)}
                  </Collapse>
                </React.Fragment>
              );
            })}
          </List>
        )}
        {/* New folder creation */}
        {mode === 'dest' && destFolderId && (
          <Box display="flex" gap={1} p={1} sx={{ borderTop: (t) => `1px solid ${alpha(t.palette.divider, 0.1)}` }}>
            <TextField size="small" placeholder="New folder name" value={newFolderName} onChange={(e) => { setNewFolderName(e.target.value); setNewFolderParent(destFolderId); }} sx={{ flex: 1 }} InputProps={{ sx: { fontSize: 12 } }} />
            <Button size="small" variant="outlined" startIcon={<CreateNewFolderIcon sx={{ fontSize: 14 }} />} onClick={handleCreateFolder} disabled={!newFolderName.trim() || creatingFolder} sx={{ fontSize: 11, textTransform: 'none' }}>
              {creatingFolder ? '...' : 'Create'}
            </Button>
          </Box>
        )}
      </Box>
    );
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3, overflow: 'hidden' } }}>
      <Box sx={{ px: 3, py: 2, background: (t) => `linear-gradient(135deg, ${alpha(t.palette.primary.main, 0.12)}, ${alpha(t.palette.secondary.main, 0.08)})`, borderBottom: (t) => `1px solid ${alpha(t.palette.divider, 0.15)}` }}>
        <Typography variant="h6" fontWeight={700}>Quick Sync</Typography>
        <Typography variant="caption" color="text.secondary">Select multiple folders to sync at once</Typography>
      </Box>

      <DialogContent sx={{ py: 2 }}>
        <Stepper activeStep={step} alternativeLabel sx={{ mb: 2, '& .MuiStepLabel-label': { fontSize: 11 } }}>
          {STEPS.map((label) => <Step key={label}><StepLabel>{label}</StepLabel></Step>)}
        </Stepper>

        {/* Step 0: Direction */}
        {step === 0 && (
          <Box textAlign="center">
            <Typography variant="body2" color="text.secondary" mb={2}>Choose sync direction</Typography>
            <ToggleButtonGroup value={direction} exclusive onChange={(_e, v) => v && setDirection(v)} fullWidth>
              <ToggleButton value="download"><CloudDownloadIcon sx={{ mr: 1, fontSize: 18 }} /> Download from Drive</ToggleButton>
              <ToggleButton value="upload"><CloudUploadIcon sx={{ mr: 1, fontSize: 18 }} /> Upload to Drive</ToggleButton>
            </ToggleButtonGroup>
          </Box>
        )}

        {/* Step 1: Sources */}
        {step === 1 && (
          <Box>
            <Typography variant="body2" color="text.secondary" mb={1.5}>
              {direction === 'download' ? 'Select Drive folders to download (check multiple)' : 'Add local folders to upload'}
            </Typography>
            {direction === 'download' ? (
              <>
                {renderDriveTree('source')}
                {selectedSources.length > 0 && (
                  <Box display="flex" flexWrap="wrap" gap={0.5} mt={1.5}>
                    {selectedSources.map((s) => (
                      <Chip key={s.folderId} label={s.folderName} size="small" onDelete={() => setSelectedSources((prev) => prev.filter((x) => x.folderId !== s.folderId))} sx={{ height: 24, fontSize: 11 }} />
                    ))}
                  </Box>
                )}
              </>
            ) : (
              <Box>
                <Button variant="outlined" startIcon={<FolderOpenIcon />} onClick={handleAddLocalSource} sx={{ mb: 1.5 }}>Add Local Folder</Button>
                {localSources.length === 0 && <Typography variant="caption" color="text.secondary" display="block">No folders selected yet.</Typography>}
                <Box display="flex" flexDirection="column" gap={0.5}>
                  {localSources.map((p) => (
                    <Chip key={p} label={p} size="small" onDelete={() => setLocalSources((prev) => prev.filter((x) => x !== p))} icon={<FolderIcon sx={{ fontSize: '14px !important' }} />} sx={{ height: 28, fontSize: 11, justifyContent: 'flex-start' }} />
                  ))}
                </Box>
              </Box>
            )}
          </Box>
        )}

        {/* Step 2: Destination */}
        {step === 2 && (
          <Box>
            <Typography variant="body2" color="text.secondary" mb={1.5}>
              {direction === 'download' ? 'Choose local destination folder' : 'Choose Drive destination folder'}
            </Typography>
            {direction === 'download' ? (
              <Box>
                <Box display="flex" gap={1}>
                  <TextField size="small" fullWidth value={destLocalPath} placeholder="Select destination..." InputProps={{ readOnly: true }} />
                  <Button variant="outlined" onClick={async () => { const d = await window.api.localFs.selectDirectory(); if (d) setDestLocalPath(d); }}>Browse</Button>
                </Box>
                {destLocalPath && <Typography variant="caption" color="success.main" mt={0.5} display="block">Each source folder will create a subfolder here.</Typography>}
              </Box>
            ) : (
              <>
                {renderDriveTree('dest')}
                {destFolderId && <Typography variant="caption" color="success.main" mt={0.5} display="block">{destDriveName}: {destFolderPath} — each local folder creates a subfolder here.</Typography>}
              </>
            )}
          </Box>
        )}

        {/* Step 3: Options */}
        {step === 3 && (
          <Box>
            <Typography variant="body2" color="text.secondary" mb={1.5}>Configure sync options (applies to all profiles)</Typography>
            <FormControlLabel control={<Checkbox checked={convertHeic} onChange={(e) => setConvertHeic(e.target.checked)} size="small" />} label={<Typography variant="body2">Convert HEIC to JPEG</Typography>} />
            <FormControlLabel control={<Checkbox checked={mirrorMode} onChange={(e) => setMirrorMode(e.target.checked)} size="small" />} label={<Box><Typography variant="body2">Mirror mode (delete extras)</Typography>{mirrorMode && <Typography variant="caption" color="warning.main">Files not in source will be deleted.</Typography>}</Box>} />
            <Box mt={2}>
              <FormControl size="small" fullWidth>
                <InputLabel>Schedule</InputLabel>
                <Select value={schedule} label="Schedule" onChange={(e) => setSchedule(e.target.value)}>
                  <MenuItem value="">Manual only</MenuItem>
                  <MenuItem value="*/1 * * * *">Every 1 minute</MenuItem>
                  <MenuItem value="*/5 * * * *">Every 5 minutes</MenuItem>
                  <MenuItem value="*/15 * * * *">Every 15 minutes</MenuItem>
                  <MenuItem value="0 * * * *">Every hour</MenuItem>
                  <MenuItem value="0 0 * * *">Daily at midnight</MenuItem>
                  <MenuItem value="custom">Custom cron</MenuItem>
                </Select>
              </FormControl>
              {schedule === 'custom' && <TextField size="small" fullWidth label="Cron Expression" value={customCron} onChange={(e) => setCustomCron(e.target.value)} placeholder="*/5 * * * *" sx={{ mt: 1 }} />}
            </Box>
          </Box>
        )}

        {/* Step 4: Review */}
        {step === 4 && (
          <Box>
            <Typography variant="body2" color="text.secondary" mb={1.5}>Review — {sourceCount} profile{sourceCount !== 1 ? 's' : ''} will be created</Typography>
            <Box sx={{ borderRadius: 2, border: (t) => `1.5px solid ${alpha(t.palette.primary.light, 0.2)}`, overflow: 'hidden' }}>
              {(direction === 'download' ? selectedSources : localSources.map((p) => ({ folderName: p.split('/').pop() || 'Sync', folderPath: p }))).map((source: any, i: number) => (
                <Box key={i} display="flex" alignItems="center" gap={1.5} px={2} py={1} sx={{ borderBottom: i < sourceCount - 1 ? (t: any) => `1px solid ${alpha(t.palette.divider, 0.08)}` : 'none' }}>
                  {direction === 'download' ? <CloudIcon sx={{ fontSize: 16, color: 'primary.main' }} /> : <FolderIcon sx={{ fontSize: 16, color: 'warning.main' }} />}
                  <Typography variant="caption" fontWeight={600}>{source.folderName || source.folderPath}</Typography>
                  <Typography variant="caption" color="text.secondary">→</Typography>
                  {direction === 'download' ? <FolderIcon sx={{ fontSize: 16, color: 'warning.main' }} /> : <CloudIcon sx={{ fontSize: 16, color: 'primary.main' }} />}
                  <Typography variant="caption" color="text.secondary" noWrap>
                    {direction === 'download' ? `${destLocalPath}/${source.folderName}/` : `${destFolderPath}${source.folderName}/`}
                  </Typography>
                </Box>
              ))}
            </Box>
            {mirrorMode && <Typography variant="caption" color="warning.main" mt={1} display="block">Mirror mode enabled — extras will be deleted.</Typography>}
            {schedule && <Typography variant="caption" color="text.secondary" mt={0.5} display="block">Schedule: {schedule === 'custom' ? customCron : schedule}</Typography>}
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, justifyContent: 'space-between' }}>
        <Button onClick={onClose} disabled={creating}>Cancel</Button>
        <Box display="flex" gap={1}>
          {step > 0 && <Button onClick={() => setStep(step - 1)} disabled={creating}>Back</Button>}
          {step < 4 ? (
            <Button variant="contained" onClick={() => { if (step === 1 && direction === 'download') loadDrives(); if (step === 2 && direction === 'upload') loadDrives(); setStep(step + 1); }}
              disabled={step === 1 && sourceCount === 0 || step === 2 && !hasDest}>
              Next
            </Button>
          ) : (
            <Button variant="contained" startIcon={<PlayArrowIcon />} onClick={handleCreate} disabled={!canCreate || creating}
              sx={{ background: `linear-gradient(135deg, ${theme.palette.success.main}, ${theme.palette.primary.main})` }}>
              {creating ? 'Creating...' : `Create ${sourceCount} Profile${sourceCount !== 1 ? 's' : ''} & Sync`}
            </Button>
          )}
        </Box>
      </DialogActions>
    </Dialog>
  );
}
