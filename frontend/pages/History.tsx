import React, { useState, useEffect, useMemo } from 'react';
import StatusMessage, { classifyError } from '../components/StatusMessage/StatusMessage';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Chip,
  CircularProgress,
  IconButton,
  Tooltip,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Checkbox,
  alpha,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import CancelIcon from '@mui/icons-material/Cancel';
import PauseCircleOutlineIcon from '@mui/icons-material/PauseCircleOutline';
import FilterListIcon from '@mui/icons-material/FilterList';
import type { SyncSession } from '../../shared/types';

const statusConfig: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  completed: { icon: <CheckCircleIcon sx={{ fontSize: 16 }} />, color: 'success', label: 'Completed' },
  failed: { icon: <ErrorIcon sx={{ fontSize: 16 }} />, color: 'error', label: 'Failed' },
  in_progress: { icon: <HourglassEmptyIcon sx={{ fontSize: 16 }} />, color: 'info', label: 'In Progress' },
  paused: { icon: <PauseCircleOutlineIcon sx={{ fontSize: 16 }} />, color: 'warning', label: 'Paused' },
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

type SortField = 'profileName' | 'status' | 'startedAt' | 'filesSynced' | 'bytesTransferred';
type SortDir = 'asc' | 'desc';

export default function History() {
  const [sessions, setSessions] = useState<SyncSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filterProfile, setFilterProfile] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  // Sort
  const [sortField, setSortField] = useState<SortField>('startedAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Selection for delete
  const [selected, setSelected] = useState<Set<number>>(new Set());

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const result = await window.api.sync.getSessions();
      setSessions(result);
    } catch (err: any) {
      setError(err?.message || 'Failed to load history');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
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

  // Unique profile names for filter dropdown
  const profileNames = useMemo(() =>
    [...new Set(sessions.map((s) => s.profileName))].sort(),
    [sessions],
  );

  // Filtered and sorted sessions
  const filteredSessions = useMemo(() => {
    let result = sessions;

    if (filterProfile) {
      result = result.filter((s) => s.profileName === filterProfile);
    }
    if (filterStatus) {
      result = result.filter((s) => s.status === filterStatus);
    }
    if (filterDateFrom) {
      const from = new Date(filterDateFrom).getTime();
      result = result.filter((s) => new Date(s.startedAt).getTime() >= from);
    }
    if (filterDateTo) {
      const to = new Date(filterDateTo + 'T23:59:59').getTime();
      result = result.filter((s) => new Date(s.startedAt).getTime() <= to);
    }

    // Sort
    result = [...result].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'profileName': cmp = a.profileName.localeCompare(b.profileName); break;
        case 'status': cmp = a.status.localeCompare(b.status); break;
        case 'startedAt': cmp = new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime(); break;
        case 'filesSynced': cmp = a.filesSynced - b.filesSynced; break;
        case 'bytesTransferred': cmp = a.bytesTransferred - b.bytesTransferred; break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [sessions, filterProfile, filterStatus, filterDateFrom, filterDateTo, sortField, sortDir]);

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  }

  function toggleSelect(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === filteredSessions.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredSessions.map((s) => s.id)));
    }
  }

  async function handleDeleteSelected() {
    if (selected.size === 0) return;
    await window.api.sync.deleteSessions([...selected]);
    setSessions((prev) => prev.filter((s) => !selected.has(s.id)));
    setSelected(new Set());
  }

  function clearFilters() {
    setFilterProfile('');
    setFilterStatus('');
    setFilterDateFrom('');
    setFilterDateTo('');
  }

  const hasFilters = filterProfile || filterStatus || filterDateFrom || filterDateTo;

  const thStyle = { fontWeight: 700, fontSize: 12, py: 1.25, borderBottom: (t: any) => `1px solid ${alpha(t.palette.divider, 0.15)}` };

  return (
    <Box flex={1} overflow="auto" px={4} py={3}>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
        <Box>
          <Typography variant="h5" mb={0.5}>Sync History</Typography>
          <Typography variant="body2" color="text.secondary">
            {filteredSessions.length}{hasFilters ? ` of ${sessions.length}` : ''} session{filteredSessions.length !== 1 ? 's' : ''}
          </Typography>
        </Box>
        <Box display="flex" gap={1}>
          {selected.size > 0 && (
            <Button size="small" color="error" variant="outlined" startIcon={<DeleteOutlineIcon />} onClick={handleDeleteSelected}>
              Delete {selected.size}
            </Button>
          )}
          <Tooltip title="Refresh">
            <IconButton onClick={load} sx={{ color: 'text.secondary' }}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Filters */}
      <Box display="flex" gap={1.5} mb={2} flexWrap="wrap" alignItems="center">
        <FilterListIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Profile</InputLabel>
          <Select value={filterProfile} label="Profile" onChange={(e) => setFilterProfile(e.target.value)}>
            <MenuItem value="">All profiles</MenuItem>
            {profileNames.map((name) => (
              <MenuItem key={name} value={name}>{name}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 130 }}>
          <InputLabel>Status</InputLabel>
          <Select value={filterStatus} label="Status" onChange={(e) => setFilterStatus(e.target.value)}>
            <MenuItem value="">All statuses</MenuItem>
            <MenuItem value="completed">Completed</MenuItem>
            <MenuItem value="failed">Failed</MenuItem>
            <MenuItem value="in_progress">In Progress</MenuItem>
            <MenuItem value="paused">Paused</MenuItem>
            <MenuItem value="cancelled">Cancelled</MenuItem>
          </Select>
        </FormControl>
        <TextField
          size="small"
          type="date"
          label="From"
          value={filterDateFrom}
          onChange={(e) => setFilterDateFrom(e.target.value)}
          InputLabelProps={{ shrink: true }}
          sx={{ width: 150 }}
        />
        <TextField
          size="small"
          type="date"
          label="To"
          value={filterDateTo}
          onChange={(e) => setFilterDateTo(e.target.value)}
          InputLabelProps={{ shrink: true }}
          sx={{ width: 150 }}
        />
        {hasFilters && (
          <Button size="small" variant="text" onClick={clearFilters}>Clear</Button>
        )}
      </Box>

      {loading ? (
        <Box display="flex" justifyContent="center" py={6}>
          <CircularProgress size={28} />
        </Box>
      ) : error ? (
        (() => { const e = classifyError(error); return <StatusMessage type={e.type} title={e.title} detail={e.detail} onRetry={load} />; })()
      ) : filteredSessions.length === 0 ? (
        <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" py={8} sx={{ opacity: 0.5 }}>
          <HourglassEmptyIcon sx={{ fontSize: 48, mb: 1 }} />
          <Typography color="text.secondary">
            {hasFilters ? 'No sessions match your filters.' : 'No sync sessions yet.'}
          </Typography>
          {hasFilters && (
            <Button size="small" variant="text" onClick={clearFilters} sx={{ mt: 1 }}>Clear filters</Button>
          )}
        </Box>
      ) : (
        <TableContainer
          sx={{
            borderRadius: 3,
            border: (t) => `1.5px solid ${alpha(t.palette.primary.light, 0.35)}`,
            overflow: 'hidden',
          }}
        >
          <Table size="small">
            <TableHead>
              <TableRow
                sx={{
                  background: (t) => `linear-gradient(135deg, ${alpha(t.palette.primary.main, 0.15)}, ${alpha(t.palette.secondary.main, 0.1)})`,
                }}
              >
                <TableCell padding="checkbox" sx={thStyle}>
                  <Checkbox
                    size="small"
                    checked={selected.size === filteredSessions.length && filteredSessions.length > 0}
                    indeterminate={selected.size > 0 && selected.size < filteredSessions.length}
                    onChange={toggleSelectAll}
                  />
                </TableCell>
                <TableCell sx={thStyle}>
                  <TableSortLabel active={sortField === 'profileName'} direction={sortField === 'profileName' ? sortDir : 'asc'} onClick={() => handleSort('profileName')}>
                    Profile
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={thStyle}>
                  <TableSortLabel active={sortField === 'status'} direction={sortField === 'status' ? sortDir : 'asc'} onClick={() => handleSort('status')}>
                    Status
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={thStyle}>
                  <TableSortLabel active={sortField === 'startedAt'} direction={sortField === 'startedAt' ? sortDir : 'asc'} onClick={() => handleSort('startedAt')}>
                    Started
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={thStyle}>Duration</TableCell>
                <TableCell sx={thStyle} align="right">Found</TableCell>
                <TableCell sx={thStyle} align="right">
                  <TableSortLabel active={sortField === 'filesSynced'} direction={sortField === 'filesSynced' ? sortDir : 'asc'} onClick={() => handleSort('filesSynced')}>
                    Synced
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={thStyle} align="right">Skipped</TableCell>
                <TableCell sx={thStyle} align="right">
                  <TableSortLabel active={sortField === 'bytesTransferred'} direction={sortField === 'bytesTransferred' ? sortDir : 'asc'} onClick={() => handleSort('bytesTransferred')}>
                    Transferred
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={thStyle}>Error</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredSessions.map((session) => {
                const cfg = statusConfig[session.status] || statusConfig.idle;
                return (
                  <TableRow key={session.id} hover selected={selected.has(session.id)}>
                    <TableCell padding="checkbox">
                      <Checkbox size="small" checked={selected.has(session.id)} onChange={() => toggleSelect(session.id)} />
                    </TableCell>
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
                      <Typography variant="caption">{new Date(session.startedAt).toLocaleString()}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption">{formatDuration(session.startedAt, session.completedAt)}</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="caption">{session.totalFiles}</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="caption">
                        {session.filesSynced}
                        {session.filesFailed > 0 && (
                          <Typography component="span" variant="caption" color="error.main"> ({session.filesFailed} failed)</Typography>
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
