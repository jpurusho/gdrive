import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  ToggleButtonGroup,
  ToggleButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Checkbox,
  Chip,
  alpha,
  useTheme,
} from '@mui/material';
import CloudIcon from '@mui/icons-material/Cloud';
import FolderIcon from '@mui/icons-material/Folder';
import SyncIcon from '@mui/icons-material/Sync';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import ScheduleIcon from '@mui/icons-material/Schedule';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import type { SyncProfile, SyncDirection, DriveInfo, DriveFile } from '../../../shared/types';

interface Props {
  onProfileCreated: (profile: SyncProfile) => void;
  onActiveStepChange?: (step: string | null) => void;
  externalDriveSelection?: { data: { driveId: string; driveName: string; driveType: 'my_drive' | 'shared_drive'; folderId: string; folderPath: string }; ts: number } | null;
  externalLocalSelection?: { path: string; ts: number } | null;
}

interface StepDef {
  id: string;
  icon: React.ElementType;
  title: string;
  color: string;
}

const STEPS: StepDef[] = [
  { id: 'name', icon: AddCircleOutlineIcon, title: 'Name', color: 'primary' },
  { id: 'drive', icon: CloudIcon, title: 'Drive Folder', color: 'primary' },
  { id: 'local', icon: FolderIcon, title: 'Local Folder', color: 'warning' },
  { id: 'direction', icon: SyncIcon, title: 'Direction', color: 'secondary' },
  { id: 'schedule', icon: ScheduleIcon, title: 'Schedule', color: 'info' },
  { id: 'sync', icon: PlayArrowIcon, title: 'Sync!', color: 'success' },
];

export default function WorkflowGuide({ onProfileCreated, onActiveStepChange, externalDriveSelection, externalLocalSelection }: Props) {
  const theme = useTheme();
  const [activeStep, setActiveStep] = useState<string | null>(null);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [driveId, setDriveId] = useState('');
  const [driveName, setDriveName] = useState('');
  const [driveType, setDriveType] = useState<'my_drive' | 'shared_drive'>('my_drive');
  const [driveFolderId, setDriveFolderId] = useState('');
  const [driveFolderPath, setDriveFolderPath] = useState('');
  const [localPath, setLocalPath] = useState('');
  const [direction, setDirection] = useState<SyncDirection>('download');
  const [useSourceFolder, setUseSourceFolder] = useState(true);
  const [schedule, setSchedule] = useState('');

  // Auto-activate first step on mount
  useEffect(() => {
    if (!activeStep) {
      setActiveStep('name');
      onActiveStepChange?.('name');
    }
  }, []);

  // Drive listing for inline picker
  const [drives, setDrives] = useState<DriveInfo[]>([]);
  const [driveFiles, setDriveFiles] = useState<DriveFile[]>([]);
  const [loadingDrives, setLoadingDrives] = useState(false);
  const [selectedDriveForFiles, setSelectedDriveForFiles] = useState('');

  function completeStep(step: string) {
    setCompleted((prev) => new Set(prev).add(step));
  }

  function handleStepClick(stepId: string) {
    const next = activeStep === stepId ? null : stepId;
    setActiveStep(next);
    onActiveStepChange?.(next);
  }

  // Handle external selections from explorers
  useEffect(() => {
    if (!externalDriveSelection) return;
    const info = externalDriveSelection.data;
    setDriveId(info.driveId);
    setDriveName(info.driveName);
    setDriveType(info.driveType);
    setDriveFolderId(info.folderId);
    setDriveFolderPath(info.folderPath);
    completeStep('drive');
    setTimeout(() => {
      setActiveStep('local');
      onActiveStepChange?.('local');
    }, 300);
  }, [externalDriveSelection]);

  useEffect(() => {
    if (!externalLocalSelection) return;
    setLocalPath(externalLocalSelection.path);
    completeStep('local');
    setTimeout(() => {
      setActiveStep('direction');
      onActiveStepChange?.('direction');
    }, 300);
  }, [externalLocalSelection]);

  // Step handlers
  function handleNameDone() {
    if (name.trim()) {
      completeStep('name');
      setActiveStep('drive');
    }
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

  async function handleDriveSelect(drive: DriveInfo) {
    setDriveId(drive.id);
    setDriveName(drive.name);
    setDriveType(drive.type);
    setSelectedDriveForFiles(drive.id);
    // List root files
    const fid = drive.id === 'root' ? 'root' : drive.id;
    const files = await window.api.drive.listFiles(drive.id, fid);
    setDriveFiles(files.filter((f) => f.isFolder));
    // Default to drive root
    setDriveFolderId(fid);
    setDriveFolderPath('/');
  }

  function handleFolderSelect(folder: DriveFile) {
    setDriveFolderId(folder.id);
    setDriveFolderPath('/' + folder.name + '/');
  }

  function handleDriveDone() {
    if (driveFolderId) {
      completeStep('drive');
      setActiveStep('local');
    }
  }

  async function handleBrowseLocal() {
    const dir = await window.api.localFs.selectDirectory();
    if (dir) {
      setLocalPath(dir);
      completeStep('local');
      setActiveStep('direction');
    }
  }

  function handleDirectionDone() {
    completeStep('direction');
    setActiveStep('schedule');
  }

  function handleScheduleDone() {
    completeStep('schedule');
    setActiveStep('sync');
  }

  async function handleCreateAndSync() {
    if (!name.trim() || !driveFolderId || !localPath) return;
    setCreating(true);
    try {
      const profile = await window.api.sync.createProfile({
        name: name.trim(),
        driveId,
        driveName,
        driveType,
        driveFolderId,
        driveFolderPath,
        localPath,
        syncDirection: direction,
        useSourceFolderName: useSourceFolder,
        convertHeicToJpeg: false,
        fileFilter: undefined,
        schedule: schedule || undefined,
        isActive: true,
      });
      completeStep('sync');
      await window.api.sync.startSync(profile.id);
      onProfileCreated(profile);

      // Reset
      setTimeout(() => {
        setActiveStep(null);
        setCompleted(new Set());
        setName('');
        setDriveFolderId('');
        setLocalPath('');
        setDirection('download');
        setSchedule('');
      }, 1500);
    } finally {
      setCreating(false);
    }
  }

  const allReady = name.trim() && driveFolderId && localPath;

  return (
    <Box
      sx={{
        borderRadius: 3,
        border: (t) => `1.5px solid ${alpha(t.palette.primary.light, 0.4)}`,
        bgcolor: 'background.paper',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          px: 2.5,
          py: 1.5,
          background: (t) => `linear-gradient(135deg, ${alpha(t.palette.primary.main, 0.15)}, ${alpha(t.palette.secondary.main, 0.1)})`,
          borderBottom: (t) => `1px solid ${alpha(t.palette.divider, 0.15)}`,
        }}
      >
        <Typography variant="subtitle2" fontWeight={700}>Create your first sync profile</Typography>
      </Box>

      {/* Step indicators */}
      <Box display="flex" alignItems="center" gap={0.5} px={2} py={1.5} sx={{ overflowX: 'auto' }}>
        {STEPS.map((step, i) => {
          const isDone = completed.has(step.id);
          const isActive = activeStep === step.id;
          const paletteColor = (theme.palette as any)[step.color]?.main || theme.palette.primary.main;

          return (
            <React.Fragment key={step.id}>
              <Box
                onClick={() => handleStepClick(step.id)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.75,
                  px: 1.5,
                  py: 0.75,
                  borderRadius: 2,
                  cursor: 'pointer',
                  bgcolor: isActive ? alpha(paletteColor, 0.1) : 'transparent',
                  border: isActive ? `1.5px solid ${alpha(paletteColor, 0.3)}` : '1.5px solid transparent',
                  transition: 'all 0.2s',
                  '&:hover': { bgcolor: alpha(paletteColor, 0.06) },
                  flexShrink: 0,
                }}
              >
                {isDone ? (
                  <CheckCircleIcon sx={{ fontSize: 20, color: 'success.main' }} />
                ) : (
                  <step.icon sx={{ fontSize: 20, color: isActive ? paletteColor : 'text.secondary' }} />
                )}
                <Typography
                  variant="caption"
                  fontWeight={isActive ? 700 : 500}
                  color={isDone ? 'success.main' : isActive ? paletteColor : 'text.secondary'}
                  sx={{ textDecoration: isDone ? 'line-through' : 'none' }}
                >
                  {step.title}
                </Typography>
              </Box>
              {i < STEPS.length - 1 && (
                <ArrowForwardIcon sx={{ fontSize: 14, color: 'text.secondary', opacity: 0.2, flexShrink: 0 }} />
              )}
            </React.Fragment>
          );
        })}
      </Box>

      {/* Summary + active step panel */}
      {(activeStep || name || driveFolderId || localPath) && (
        <Box sx={{ px: 2.5, py: 1.5, borderTop: (t) => `1px solid ${alpha(t.palette.divider, 0.1)}` }}>

          {/* Always-visible summary of completed selections */}
          <Box display="flex" flexWrap="wrap" gap={1} mb={activeStep ? 1.5 : 0}>
            {name && (
              <Chip
                icon={<AddCircleOutlineIcon sx={{ fontSize: '14px !important' }} />}
                label={name}
                size="small"
                variant="outlined"
                onDelete={() => { setName(''); completed.delete('name'); setCompleted(new Set(completed)); }}
                sx={{ height: 24, fontSize: 11 }}
              />
            )}
            {driveFolderId && (
              <Chip
                icon={<CloudIcon sx={{ fontSize: '14px !important' }} />}
                label={`${driveName}: ${driveFolderPath}`}
                size="small"
                color="primary"
                variant="outlined"
                onDelete={() => { setDriveFolderId(''); setDriveFolderPath(''); completed.delete('drive'); setCompleted(new Set(completed)); }}
                sx={{ height: 24, fontSize: 11 }}
              />
            )}
            {localPath && (
              <Chip
                icon={<FolderIcon sx={{ fontSize: '14px !important' }} />}
                label={localPath}
                size="small"
                color="success"
                variant="outlined"
                onDelete={() => { setLocalPath(''); completed.delete('local'); setCompleted(new Set(completed)); }}
                sx={{ height: 24, fontSize: 11 }}
              />
            )}
            {completed.has('direction') && (
              <Chip
                icon={<SyncIcon sx={{ fontSize: '14px !important' }} />}
                label={direction}
                size="small"
                variant="outlined"
                sx={{ height: 24, fontSize: 11 }}
              />
            )}
            {completed.has('schedule') && schedule && (
              <Chip
                icon={<ScheduleIcon sx={{ fontSize: '14px !important' }} />}
                label={schedule}
                size="small"
                variant="outlined"
                sx={{ height: 24, fontSize: 11 }}
              />
            )}
          </Box>

          {/* Active step input */}
          {activeStep === 'name' && (
            <Box display="flex" gap={1} alignItems="flex-end">
              <TextField
                size="small"
                label="Profile Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Work Documents"
                sx={{ flex: 1, maxWidth: 300 }}
                onKeyDown={(e) => e.key === 'Enter' && handleNameDone()}
                autoFocus
              />
              <Button variant="contained" size="small" onClick={handleNameDone} disabled={!name.trim()}>
                Next
              </Button>
            </Box>
          )}

          {activeStep === 'drive' && !driveFolderId && (
            <Typography variant="body2" color="text.secondary">
              Navigate in the <strong>Google Drive</strong> explorer and click <strong>Select folder</strong>.
            </Typography>
          )}

          {activeStep === 'local' && !localPath && (
            <Typography variant="body2" color="text.secondary">
              Navigate in the <strong>Local Files</strong> explorer and click <strong>Select folder</strong>.
            </Typography>
          )}

          {activeStep === 'direction' && (
            <Box>
              <ToggleButtonGroup
                value={direction}
                exclusive
                onChange={(_e, val) => val && setDirection(val)}
                size="small"
                sx={{ mb: 1.5 }}
              >
                <ToggleButton value="download">
                  <CloudDownloadIcon sx={{ fontSize: 16, mr: 0.5 }} /> Download
                </ToggleButton>
                <ToggleButton value="upload">
                  <CloudUploadIcon sx={{ fontSize: 16, mr: 0.5 }} /> Upload
                </ToggleButton>
                <ToggleButton value="bidirectional">
                  <SyncIcon sx={{ fontSize: 16, mr: 0.5 }} /> Bidirectional
                </ToggleButton>
              </ToggleButtonGroup>
              <Box mb={1.5}>
                <FormControlLabel
                  control={<Checkbox checked={useSourceFolder} onChange={(e) => setUseSourceFolder(e.target.checked)} size="small" />}
                  label={<Typography variant="caption">Create source folder in destination</Typography>}
                />
              </Box>
              <Button variant="contained" size="small" onClick={handleDirectionDone}>Next</Button>
            </Box>
          )}

          {activeStep === 'schedule' && (
            <Box display="flex" gap={1} alignItems="flex-end">
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel>Schedule</InputLabel>
                <Select value={schedule} label="Schedule" onChange={(e) => setSchedule(e.target.value)}>
                  <MenuItem value="">Manual only</MenuItem>
                  <MenuItem value="*/15 * * * *">Every 15 minutes</MenuItem>
                  <MenuItem value="*/30 * * * *">Every 30 minutes</MenuItem>
                  <MenuItem value="0 * * * *">Every hour</MenuItem>
                  <MenuItem value="0 */6 * * *">Every 6 hours</MenuItem>
                  <MenuItem value="0 0 * * *">Daily at midnight</MenuItem>
                </Select>
              </FormControl>
              <Button variant="contained" size="small" onClick={handleScheduleDone}>Next</Button>
            </Box>
          )}

          {activeStep === 'sync' && (
            <Box>
              {allReady ? (
                <Box>
                  <Typography variant="body2" color="text.secondary" mb={1.5}>
                    <strong>{name}</strong> — {driveName}: {driveFolderPath} → {localPath}
                    {useSourceFolder && ` / ${driveFolderPath.split('/').filter(Boolean).pop() || driveName}`}
                  </Typography>
                  <Button
                    variant="contained"
                    onClick={handleCreateAndSync}
                    disabled={creating}
                    startIcon={<PlayArrowIcon />}
                    sx={{
                      background: `linear-gradient(135deg, ${theme.palette.success.main}, ${theme.palette.primary.main})`,
                    }}
                  >
                    {creating ? 'Creating...' : 'Create Profile & Sync Now'}
                  </Button>
                </Box>
              ) : (
                <Typography variant="body2" color="warning.main">
                  Complete the previous steps first.
                </Typography>
              )}
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}
