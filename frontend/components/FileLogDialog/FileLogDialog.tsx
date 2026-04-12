import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  alpha,
  useTheme,
} from '@mui/material';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import PauseCircleOutlineIcon from '@mui/icons-material/PauseCircleOutline';
import type { SyncFileEntry } from '../../../shared/types';

function formatBytes(bytes: number): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

const statusConfig: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  completed: { icon: <CheckCircleIcon sx={{ fontSize: 14 }} />, color: 'success', label: 'Synced' },
  skipped: { icon: <SkipNextIcon sx={{ fontSize: 14 }} />, color: 'default', label: 'Skipped' },
  failed: { icon: <ErrorOutlineIcon sx={{ fontSize: 14 }} />, color: 'error', label: 'Failed' },
  paused: { icon: <PauseCircleOutlineIcon sx={{ fontSize: 14 }} />, color: 'warning', label: 'Paused' },
};

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  sessionIds: number[];
}

export default function FileLogDialog({ open, onClose, title, sessionIds }: Props) {
  const theme = useTheme();
  const [files, setFiles] = useState<SyncFileEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open || sessionIds.length === 0) return;
    setLoading(true);
    Promise.all(sessionIds.map((id) => window.api.sync.getFileLogs(id)))
      .then((results) => {
        setFiles(results.flat());
      })
      .finally(() => setLoading(false));
  }, [open, sessionIds.join(',')]);

  const synced = files.filter((f) => f.status === 'completed').length;
  const skipped = files.filter((f) => f.status === 'skipped').length;
  const failed = files.filter((f) => f.status === 'failed').length;
  const totalBytes = files.reduce((sum, f) => sum + f.bytesTransferred, 0);

  const thStyle = {
    fontWeight: 700, fontSize: 12, py: 1,
    borderBottom: (t: any) => `1px solid ${alpha(t.palette.divider, 0.15)}`,
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 3, overflow: 'hidden' } }}>
      <Box
        sx={{
          px: 3, py: 2,
          background: (t) => `linear-gradient(135deg, ${alpha(t.palette.primary.main, 0.12)}, ${alpha(t.palette.secondary.main, 0.08)})`,
          borderBottom: (t) => `1px solid ${alpha(t.palette.divider, 0.15)}`,
        }}
      >
        <Typography variant="h6" fontWeight={700}>{title}</Typography>
        {!loading && (
          <Box display="flex" gap={2} mt={0.5}>
            <Typography variant="caption" color="text.secondary">{files.length} files</Typography>
            {synced > 0 && <Typography variant="caption" color="success.main">{synced} synced</Typography>}
            {skipped > 0 && <Typography variant="caption" color="text.secondary">{skipped} skipped</Typography>}
            {failed > 0 && <Typography variant="caption" color="error.main">{failed} failed</Typography>}
            <Typography variant="caption" color="text.secondary">{formatBytes(totalBytes)} transferred</Typography>
          </Box>
        )}
      </Box>
      <DialogContent sx={{ p: 0 }}>
        {loading ? (
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress size={28} />
          </Box>
        ) : files.length === 0 ? (
          <Box py={4} textAlign="center">
            <Typography variant="body2" color="text.secondary">No file records found.</Typography>
          </Box>
        ) : (
          <TableContainer sx={{ maxHeight: 500 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow sx={{ background: (t) => alpha(t.palette.background.paper, 1) }}>
                  <TableCell sx={thStyle}>File</TableCell>
                  <TableCell sx={thStyle}>Path</TableCell>
                  <TableCell sx={thStyle}>Direction</TableCell>
                  <TableCell sx={thStyle}>Status</TableCell>
                  <TableCell sx={thStyle} align="right">Size</TableCell>
                  <TableCell sx={thStyle}>Error</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {files.map((file) => {
                  const cfg = statusConfig[file.status] || statusConfig.completed;
                  return (
                    <TableRow key={file.id} hover>
                      <TableCell>
                        <Typography variant="caption" fontWeight={500}>{file.fileName}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: 200, display: 'block' }}>
                          {file.filePath}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {file.direction === 'download'
                          ? <CloudDownloadIcon sx={{ fontSize: 14, color: 'primary.main' }} />
                          : <CloudUploadIcon sx={{ fontSize: 14, color: 'secondary.main' }} />
                        }
                      </TableCell>
                      <TableCell>
                        <Chip
                          icon={cfg.icon as any}
                          label={cfg.label}
                          size="small"
                          color={cfg.color as any}
                          variant="outlined"
                          sx={{ height: 22, fontSize: 11 }}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="caption">{formatBytes(file.fileSize)}</Typography>
                      </TableCell>
                      <TableCell>
                        {file.errorMessage && (
                          <Typography variant="caption" color="error.main" noWrap sx={{ maxWidth: 150, display: 'block' }}>
                            {file.errorMessage}
                          </Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DialogContent>
    </Dialog>
  );
}
