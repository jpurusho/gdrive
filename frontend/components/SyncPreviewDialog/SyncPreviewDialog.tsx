import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Chip,
  LinearProgress,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Tooltip,
  Alert,
} from '@mui/material';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import NewReleasesIcon from '@mui/icons-material/NewReleases';
import UpdateIcon from '@mui/icons-material/Update';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import type { SyncPreview, SyncPreviewItem } from '../../../shared/types';
import { formatBytes } from '@/utils/format';
import { directionLabels } from '@/utils/syncDirection';

interface Props {
  open: boolean;
  loading: boolean;
  error: string | null;
  preview: SyncPreview | null;
  onClose: () => void;
  onSyncNow: () => void;
}

const reasonChip = (reason: SyncPreviewItem['reason']) => {
  if (reason === 'new') return <Chip label="New" size="small" color="success" icon={<NewReleasesIcon />} sx={{ height: 20, fontSize: 11 }} />;
  if (reason === 'conflict') return <Chip label="Conflict" size="small" color="warning" icon={<WarningAmberIcon />} sx={{ height: 20, fontSize: 11 }} />;
  return <Chip label="Updated" size="small" color="info" icon={<UpdateIcon />} sx={{ height: 20, fontSize: 11 }} />;
};

export default function SyncPreviewDialog({ open, loading, error, preview, onClose, onSyncNow }: Props) {
  const allItems: SyncPreviewItem[] = preview
    ? [...preview.toDownload, ...preview.toUpload]
    : [];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      slotProps={{ paper: { sx: { borderRadius: 3, overflow: 'hidden' } } }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, flex: 1 }}>
            Preview{preview ? ` — ${preview.profileName}` : ''}
          </Typography>
          {preview && (
            <Chip
              label={directionLabels[preview.direction] ?? preview.direction}
              size="small"
              variant="outlined"
            />
          )}
        </Box>
      </DialogTitle>

      {loading && <LinearProgress />}

      <DialogContent sx={{ pt: 1 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
        )}

        {preview && !loading && (
          <>
            {/* Summary tiles */}
            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
              <Box sx={{ flex: 1, p: 1.5, borderRadius: 2, bgcolor: 'action.hover', textAlign: 'center' }}>
                <CloudDownloadIcon color="primary" fontSize="small" />
                <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                  {preview.toDownload.length}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  to download ({formatBytes(preview.totalDownloadBytes)})
                </Typography>
              </Box>
              <Box sx={{ flex: 1, p: 1.5, borderRadius: 2, bgcolor: 'action.hover', textAlign: 'center' }}>
                <CloudUploadIcon color="secondary" fontSize="small" />
                <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                  {preview.toUpload.length}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  to upload ({formatBytes(preview.totalUploadBytes)})
                </Typography>
              </Box>
              <Box sx={{ flex: 1, p: 1.5, borderRadius: 2, bgcolor: 'action.hover', textAlign: 'center' }}>
                <CheckCircleIcon color="success" fontSize="small" />
                <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                  {preview.alreadySynced}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  already in sync
                </Typography>
              </Box>
            </Box>

            {allItems.length === 0 ? (
              <Alert severity="success" icon={<CheckCircleIcon />}>
                Everything is already in sync — no files will be transferred.
              </Alert>
            ) : (
              <Box sx={{ maxHeight: 360, overflow: 'auto', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ width: 36, px: 1 }} />
                      <TableCell sx={{ fontWeight: 600 }}>File</TableCell>
                      <TableCell sx={{ fontWeight: 600, display: { xs: 'none', sm: 'table-cell' } }}>Path</TableCell>
                      <TableCell sx={{ fontWeight: 600, textAlign: 'right' }}>Size</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Reason</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {allItems.map((item, i) => (
                      <TableRow key={i} hover>
                        <TableCell sx={{ px: 1 }}>
                          <Tooltip title={item.direction === 'download' ? 'Download' : 'Upload'}>
                            {item.direction === 'download'
                              ? <CloudDownloadIcon fontSize="small" color="primary" />
                              : <CloudUploadIcon fontSize="small" color="secondary" />}
                          </Tooltip>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                            {item.fileName}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                          <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: 220, display: 'block' }}>
                            {item.relativePath}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <Typography variant="caption">{formatBytes(item.fileSize)}</Typography>
                        </TableCell>
                        <TableCell>{reasonChip(item.reason)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            )}

            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
              Preview scanned in {(preview.durationMs / 1000).toFixed(1)}s
            </Typography>
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
        <Button onClick={onClose} variant="outlined">Close</Button>
        {preview && allItems.length > 0 && (
          <Button onClick={onSyncNow} variant="contained" startIcon={<CloudDownloadIcon />}>
            Sync Now
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
