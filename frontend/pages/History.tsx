import React, { useState, useEffect } from 'react';
import {
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
  IconButton,
  Tooltip,
  alpha,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import CancelIcon from '@mui/icons-material/Cancel';
import type { SyncSession } from '../../shared/types';

const statusConfig: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  completed: { icon: <CheckCircleIcon sx={{ fontSize: 16 }} />, color: 'success', label: 'Completed' },
  failed: { icon: <ErrorIcon sx={{ fontSize: 16 }} />, color: 'error', label: 'Failed' },
  in_progress: { icon: <HourglassEmptyIcon sx={{ fontSize: 16 }} />, color: 'info', label: 'In Progress' },
  cancelled: { icon: <CancelIcon sx={{ fontSize: 16 }} />, color: 'warning', label: 'Cancelled' },
  idle: { icon: <HourglassEmptyIcon sx={{ fontSize: 16 }} />, color: 'default', label: 'Idle' },
};

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatDuration(start: string, end?: string): string {
  if (!end) return 'running...';
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 1000) return '<1s';
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  return `${Math.round(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

export default function History() {
  const [sessions, setSessions] = useState<SyncSession[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const result = await window.api.sync.getSessions();
      setSessions(result);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // Also listen for live progress
    const unsub = window.api.sync.onSyncProgress((session) => {
      setSessions((prev) => {
        const idx = prev.findIndex((s) => s.id === session.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = session;
          return next;
        }
        return [session, ...prev];
      });
    });
    return unsub;
  }, []);

  return (
    <Box flex={1} overflow="auto" px={4} py={3}>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
        <Box>
          <Typography variant="h5" mb={0.5}>Sync History</Typography>
          <Typography variant="body2" color="text.secondary">
            {sessions.length} sync session{sessions.length !== 1 ? 's' : ''}
          </Typography>
        </Box>
        <Tooltip title="Refresh">
          <IconButton onClick={load} sx={{ color: 'text.secondary' }}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {loading ? (
        <Box display="flex" justifyContent="center" py={6}>
          <CircularProgress size={28} />
        </Box>
      ) : sessions.length === 0 ? (
        <Box
          display="flex"
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
          py={8}
          sx={{ opacity: 0.5 }}
        >
          <HourglassEmptyIcon sx={{ fontSize: 48, mb: 1 }} />
          <Typography color="text.secondary">No sync sessions yet.</Typography>
          <Typography variant="caption" color="text.secondary">
            Create a sync profile and run your first sync.
          </Typography>
        </Box>
      ) : (
        <TableContainer
          sx={{
            borderRadius: 3,
            border: (t) => `1px solid ${alpha(t.palette.divider, 0.3)}`,
          }}
        >
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Profile</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Started</TableCell>
                <TableCell>Duration</TableCell>
                <TableCell align="right">Found</TableCell>
                <TableCell align="right">Synced</TableCell>
                <TableCell align="right">Skipped</TableCell>
                <TableCell align="right">Transferred</TableCell>
                <TableCell>Error</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sessions.map((session) => {
                const cfg = statusConfig[session.status] || statusConfig.idle;
                return (
                  <TableRow key={session.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={500}>{session.profileName}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        icon={cfg.icon as any}
                        label={cfg.label}
                        size="small"
                        color={cfg.color as any}
                        variant="outlined"
                        sx={{ height: 24, fontSize: 12 }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption">
                        {new Date(session.startedAt).toLocaleString()}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption">
                        {formatDuration(session.startedAt, session.completedAt)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="caption">{session.totalFiles}</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="caption">
                        {session.filesSynced}
                        {session.filesFailed > 0 && (
                          <Typography component="span" variant="caption" color="error.main">
                            {' '}({session.filesFailed} failed)
                          </Typography>
                        )}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="caption">{session.filesSkipped}</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="caption">{formatBytes(session.bytesTransferred)}</Typography>
                    </TableCell>
                    <TableCell>
                      {session.errorMessage && (
                        <Tooltip title={session.errorMessage}>
                          <Typography variant="caption" color="error.main" noWrap sx={{ maxWidth: 200, display: 'block' }}>
                            {session.errorMessage}
                          </Typography>
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
