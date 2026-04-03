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
  Breadcrumbs,
  Link,
  Button,
  Chip,
  alpha,
} from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import ComputerIcon from '@mui/icons-material/Computer';
import FolderIcon from '@mui/icons-material/Folder';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import type { LocalFile } from '../../../shared/types';

function formatSize(bytes: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

interface FolderNodeProps {
  file: LocalFile;
  depth: number;
  showHidden: boolean;
}

function FolderNode({ file, depth, showHidden }: FolderNodeProps) {
  const [open, setOpen] = useState(false);
  const [children, setChildren] = useState<LocalFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  async function handleToggle() {
    if (!loaded) {
      setLoading(true);
      try {
        const files = await window.api.localFs.listDirectory(file.path);
        setChildren(files);
        setLoaded(true);
      } catch (err) {
        console.error('Failed to load directory:', err);
      } finally {
        setLoading(false);
      }
    }
    setOpen(!open);
  }

  const visibleChildren = showHidden ? children : children.filter((f) => !f.isHidden);

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
          {open ? (
            <FolderOpenIcon sx={{ fontSize: 18, color: '#f59e0b' }} />
          ) : (
            <FolderIcon sx={{ fontSize: 18, color: '#f59e0b' }} />
          )}
        </ListItemIcon>
        <ListItemText
          primary={file.name}
          primaryTypographyProps={{ fontSize: 13, noWrap: true, sx: { opacity: file.isHidden ? 0.5 : 1 } }}
        />
      </ListItemButton>
      <Collapse in={open} timeout="auto">
        {visibleChildren.map((child) =>
          child.isDirectory ? (
            <FolderNode key={child.path} file={child} depth={depth + 1} showHidden={showHidden} />
          ) : (
            <ListItemButton key={child.path} sx={{ pl: 2 + (depth + 1) * 2, py: 0.5 }}>
              <ListItemIcon sx={{ minWidth: 28 }}><Box width={18} /></ListItemIcon>
              <ListItemIcon sx={{ minWidth: 28 }}>
                <InsertDriveFileIcon sx={{ fontSize: 16, color: 'text.secondary', opacity: child.isHidden ? 0.5 : 1 }} />
              </ListItemIcon>
              <ListItemText
                primary={child.name}
                secondary={formatSize(child.size)}
                primaryTypographyProps={{ fontSize: 13, noWrap: true, sx: { opacity: child.isHidden ? 0.5 : 1 } }}
                secondaryTypographyProps={{ fontSize: 11 }}
              />
            </ListItemButton>
          ),
        )}
        {loaded && visibleChildren.length === 0 && (
          <Typography variant="caption" color="text.secondary" sx={{ pl: 4 + (depth + 1) * 2, py: 0.5, display: 'block' }}>
            Empty folder
          </Typography>
        )}
      </Collapse>
    </>
  );
}

interface LocalTreeProps {
  selectionMode?: boolean;
  onFolderSelect?: (path: string) => void;
}

export default function LocalTree({ selectionMode, onFolderSelect }: LocalTreeProps = {}) {
  const [rootPath, setRootPath] = useState('');
  const [files, setFiles] = useState<LocalFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showHidden, setShowHidden] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { loadHome(); }, []);

  async function loadHome() {
    setLoading(true);
    setError(null);
    try {
      const home = await window.api.localFs.getHomeDir();
      setRootPath(home);
      const result = await window.api.localFs.listDirectory(home);
      setFiles(result);
    } catch (err: any) {
      console.error('Failed to load home directory:', err);
      setError(err?.message || 'Failed to load directory');
    } finally {
      setLoading(false);
    }
  }

  async function handleBrowse() {
    const selected = await window.api.localFs.selectDirectory();
    if (selected) {
      setLoading(true);
      setRootPath(selected);
      try {
        const result = await window.api.localFs.listDirectory(selected);
        setFiles(result);
      } finally {
        setLoading(false);
      }
    }
  }

  async function navigateTo(path: string) {
    setRootPath(path);
    setLoading(true);
    setError(null);
    try {
      const result = await window.api.localFs.listDirectory(path);
      setFiles(result);
    } catch (err: any) {
      setError(err?.message || 'Failed to load directory');
    } finally {
      setLoading(false);
    }
  }

  const visibleFiles = showHidden ? files : files.filter((f) => !f.isHidden);
  const pathParts = rootPath.split('/').filter(Boolean);
  const breadcrumbs = pathParts.map((part, i) => ({
    label: part,
    path: '/' + pathParts.slice(0, i + 1).join('/'),
  }));

  return (
    <>
      <Box
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        px={2}
        py={1.25}
        sx={{
          background: (t) => `linear-gradient(135deg, ${alpha(t.palette.success.main, 0.12)}, ${alpha(t.palette.primary.main, 0.08)})`,
          borderBottom: (t) => `1px solid ${alpha(t.palette.divider, 0.15)}`,
        }}
      >
        <Box display="flex" alignItems="center" gap={1}>
          <ComputerIcon sx={{ fontSize: 18, color: 'success.main' }} />
          <Typography variant="subtitle2" fontWeight={700}>Local Files</Typography>
          {selectionMode && (
            <Chip label="Navigate & select" size="small" color="success" variant="outlined" sx={{ height: 20, fontSize: 10 }} />
          )}
        </Box>
        <Box display="flex" gap={0.5}>
          {selectionMode && rootPath && (
            <Button
              size="small"
              variant="contained"
              color="success"
              startIcon={<CheckIcon sx={{ fontSize: 14 }} />}
              onClick={() => onFolderSelect?.(rootPath)}
              sx={{ height: 26, fontSize: 11, textTransform: 'none' }}
            >
              Select
            </Button>
          )}
          <IconButton
            size="small"
            onClick={() => setShowHidden(!showHidden)}
            sx={{ color: showHidden ? 'primary.main' : 'text.secondary' }}
            title={showHidden ? 'Hide hidden files' : 'Show hidden files'}
          >
            <VisibilityOffIcon sx={{ fontSize: 18 }} />
          </IconButton>
          <IconButton size="small" onClick={handleBrowse} sx={{ color: 'text.secondary' }} title="Browse folder">
            <FolderOpenIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>
      </Box>

      <Box px={2} py={0.75} sx={{ borderBottom: (t) => `1px solid ${alpha(t.palette.divider, 0.15)}` }}>
        <Breadcrumbs separator="/" sx={{ '& .MuiBreadcrumbs-separator': { mx: 0.5, color: 'text.secondary', fontSize: 12 } }}>
          {breadcrumbs.slice(-3).map((crumb, i) => (
            <Link
              key={crumb.path}
              component="button"
              underline="hover"
              color={i === breadcrumbs.slice(-3).length - 1 ? 'text.primary' : 'text.secondary'}
              onClick={() => navigateTo(crumb.path)}
              sx={{ fontSize: 12 }}
            >
              {crumb.label}
            </Link>
          ))}
        </Breadcrumbs>
      </Box>

      <Box flex={1} overflow="auto">
        {loading ? (
          <Box display="flex" justifyContent="center" py={4}><CircularProgress size={24} /></Box>
        ) : error ? (
          (() => { const e = classifyError(error); return <StatusMessage type={e.type} title={e.title} detail={e.detail} onRetry={loadHome} />; })()
        ) : (
          <List dense disablePadding>
            {visibleFiles.map((file) =>
              file.isDirectory ? (
                <FolderNode key={file.path} file={file} depth={0} showHidden={showHidden} />
              ) : (
                <ListItemButton key={file.path} sx={{ pl: 2, py: 0.5 }}>
                  <ListItemIcon sx={{ minWidth: 28 }}><Box width={18} /></ListItemIcon>
                  <ListItemIcon sx={{ minWidth: 28 }}>
                    <InsertDriveFileIcon sx={{ fontSize: 16, color: 'text.secondary', opacity: file.isHidden ? 0.5 : 1 }} />
                  </ListItemIcon>
                  <ListItemText
                    primary={file.name}
                    secondary={formatSize(file.size)}
                    primaryTypographyProps={{ fontSize: 13, noWrap: true, sx: { opacity: file.isHidden ? 0.5 : 1 } }}
                    secondaryTypographyProps={{ fontSize: 11 }}
                  />
                </ListItemButton>
              ),
            )}
          </List>
        )}
      </Box>
    </>
  );
}
