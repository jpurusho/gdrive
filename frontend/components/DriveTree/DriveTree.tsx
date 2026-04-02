import React, { useState, useEffect } from 'react';
import StatusMessage, { classifyError } from '../StatusMessage/StatusMessage';
import {
  Box,
  Typography,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  CircularProgress,
  Collapse,
  IconButton,
  Chip,
  alpha,
} from '@mui/material';
import CloudIcon from '@mui/icons-material/Cloud';
import GroupWorkIcon from '@mui/icons-material/GroupWork';
import FolderIcon from '@mui/icons-material/Folder';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import RefreshIcon from '@mui/icons-material/Refresh';
import type { DriveInfo, DriveFile } from '../../../shared/types';

function formatSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

interface FolderNodeProps {
  file: DriveFile;
  driveId: string;
  depth: number;
}

function FolderNode({ file, driveId, depth }: FolderNodeProps) {
  const [open, setOpen] = useState(false);
  const [children, setChildren] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  async function handleToggle() {
    if (!loaded) {
      setLoading(true);
      try {
        const files = await window.api.drive.listFiles(driveId, file.id);
        setChildren(files);
        setLoaded(true);
      } catch (err) {
        console.error('Failed to load folder:', err);
      } finally {
        setLoading(false);
      }
    }
    setOpen(!open);
  }

  return (
    <>
      <ListItemButton onClick={handleToggle} sx={{ pl: 2 + depth * 2, py: 0.5 }}>
        <ListItemIcon sx={{ minWidth: 28 }}>
          {loading ? (
            <CircularProgress size={16} />
          ) : open ? (
            <ExpandMoreIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
          ) : (
            <ChevronRightIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
          )}
        </ListItemIcon>
        <ListItemIcon sx={{ minWidth: 28 }}>
          <FolderIcon sx={{ fontSize: 18, color: '#f59e0b' }} />
        </ListItemIcon>
        <ListItemText primary={file.name} primaryTypographyProps={{ fontSize: 13, noWrap: true }} />
      </ListItemButton>
      <Collapse in={open} timeout="auto">
        {children.map((child) =>
          child.isFolder ? (
            <FolderNode key={child.id} file={child} driveId={driveId} depth={depth + 1} />
          ) : (
            <ListItemButton key={child.id} sx={{ pl: 2 + (depth + 1) * 2, py: 0.5 }}>
              <ListItemIcon sx={{ minWidth: 28 }}><Box width={18} /></ListItemIcon>
              <ListItemIcon sx={{ minWidth: 28 }}>
                <InsertDriveFileIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
              </ListItemIcon>
              <ListItemText
                primary={child.name}
                secondary={formatSize(child.size)}
                primaryTypographyProps={{ fontSize: 13, noWrap: true }}
                secondaryTypographyProps={{ fontSize: 11 }}
              />
            </ListItemButton>
          ),
        )}
        {loaded && children.length === 0 && (
          <Typography variant="caption" color="text.secondary" sx={{ pl: 4 + (depth + 1) * 2, py: 0.5, display: 'block' }}>
            Empty folder
          </Typography>
        )}
      </Collapse>
    </>
  );
}

export default function DriveTree() {
  const [drives, setDrives] = useState<DriveInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedDrives, setExpandedDrives] = useState<Set<string>>(new Set());
  const [driveFiles, setDriveFiles] = useState<Record<string, DriveFile[]>>({});
  const [loadingDrives, setLoadingDrives] = useState<Set<string>>(new Set());

  useEffect(() => { loadDrives(); }, []);

  async function loadDrives() {
    setLoading(true);
    setError(null);
    try {
      const result = await window.api.drive.listDrives();
      setDrives(result);
    } catch (err: any) {
      console.error('Failed to load drives:', err);
      setError(err?.message || 'Failed to load drives');
    } finally {
      setLoading(false);
    }
  }

  async function toggleDrive(driveId: string) {
    const newExpanded = new Set(expandedDrives);
    if (newExpanded.has(driveId)) {
      newExpanded.delete(driveId);
    } else {
      newExpanded.add(driveId);
      if (!driveFiles[driveId]) {
        setLoadingDrives((prev) => new Set(prev).add(driveId));
        try {
          const folderId = driveId === 'root' ? 'root' : driveId;
          const files = await window.api.drive.listFiles(driveId, folderId);
          setDriveFiles((prev) => ({ ...prev, [driveId]: files }));
        } catch (err) {
          console.error('Failed to load drive files:', err);
        } finally {
          setLoadingDrives((prev) => {
            const next = new Set(prev);
            next.delete(driveId);
            return next;
          });
        }
      }
    }
    setExpandedDrives(newExpanded);
  }

  return (
    <>
      <Box
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        px={2}
        py={1.25}
        sx={{
          background: (t) => `linear-gradient(135deg, ${alpha(t.palette.primary.main, 0.15)}, ${alpha(t.palette.secondary.main, 0.1)})`,
          borderBottom: (t) => `1px solid ${alpha(t.palette.divider, 0.15)}`,
        }}
      >
        <Box display="flex" alignItems="center" gap={1}>
          <CloudIcon sx={{ fontSize: 18, color: 'primary.main' }} />
          <Typography variant="subtitle2" fontWeight={700}>Google Drive</Typography>
        </Box>
        <IconButton size="small" onClick={loadDrives} sx={{ color: 'text.secondary' }}>
          <RefreshIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Box>

      <Box flex={1} overflow="auto">
        {loading ? (
          <Box display="flex" justifyContent="center" py={4}><CircularProgress size={24} /></Box>
        ) : error ? (
          (() => { const e = classifyError(error); return <StatusMessage type={e.type} title={e.title} detail={e.detail} onRetry={loadDrives} />; })()
        ) : drives.length === 0 ? (
          <Typography variant="body2" color="text.secondary" textAlign="center" py={4}>
            No drives found. Sign in to see your drives.
          </Typography>
        ) : (
          <List dense disablePadding>
            {drives.map((drive) => (
              <React.Fragment key={drive.id}>
                <ListItemButton onClick={() => toggleDrive(drive.id)} sx={{ py: 1 }}>
                  <ListItemIcon sx={{ minWidth: 28 }}>
                    {loadingDrives.has(drive.id) ? (
                      <CircularProgress size={16} />
                    ) : expandedDrives.has(drive.id) ? (
                      <ExpandMoreIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                    ) : (
                      <ChevronRightIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                    )}
                  </ListItemIcon>
                  <ListItemIcon sx={{ minWidth: 28 }}>
                    {drive.type === 'shared_drive' ? (
                      <GroupWorkIcon sx={{ fontSize: 18, color: drive.colorRgb || '#8b5cf6' }} />
                    ) : (
                      <CloudIcon sx={{ fontSize: 18, color: '#6366f1' }} />
                    )}
                  </ListItemIcon>
                  <ListItemText primary={drive.name} primaryTypographyProps={{ fontSize: 13, fontWeight: 500 }} />
                  <Chip
                    label={drive.permission}
                    size="small"
                    sx={{
                      height: 20,
                      fontSize: 10,
                      bgcolor: (t) =>
                        drive.permission === 'owner'
                          ? alpha(t.palette.success.main, 0.15)
                          : drive.permission === 'writer'
                            ? alpha(t.palette.primary.main, 0.15)
                            : alpha(t.palette.text.secondary, 0.1),
                      color: drive.permission === 'owner' ? 'success.main'
                        : drive.permission === 'writer' ? 'primary.main' : 'text.secondary',
                    }}
                  />
                </ListItemButton>
                <Collapse in={expandedDrives.has(drive.id)} timeout="auto">
                  {(driveFiles[drive.id] || []).map((file) =>
                    file.isFolder ? (
                      <FolderNode key={file.id} file={file} driveId={drive.id} depth={1} />
                    ) : (
                      <ListItemButton key={file.id} sx={{ pl: 6, py: 0.5 }}>
                        <ListItemIcon sx={{ minWidth: 28 }}><Box width={18} /></ListItemIcon>
                        <ListItemIcon sx={{ minWidth: 28 }}>
                          <InsertDriveFileIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                        </ListItemIcon>
                        <ListItemText
                          primary={file.name}
                          secondary={formatSize(file.size)}
                          primaryTypographyProps={{ fontSize: 13, noWrap: true }}
                          secondaryTypographyProps={{ fontSize: 11 }}
                        />
                      </ListItemButton>
                    ),
                  )}
                </Collapse>
              </React.Fragment>
            ))}
          </List>
        )}
      </Box>
    </>
  );
}
