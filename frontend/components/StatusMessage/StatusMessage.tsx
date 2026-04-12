import React from 'react';
import { Box, Typography, Button, alpha } from '@mui/material';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import WifiOffIcon from '@mui/icons-material/WifiOff';
import CloudOffIcon from '@mui/icons-material/CloudOff';
import FolderOffIcon from '@mui/icons-material/FolderOff';
import LockIcon from '@mui/icons-material/Lock';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';

type MessageType = 'error' | 'offline' | 'noAccess' | 'notFound' | 'empty' | 'info';

const iconMap: Record<MessageType, React.ElementType> = {
  error: ErrorOutlineIcon,
  offline: WifiOffIcon,
  noAccess: LockIcon,
  notFound: FolderOffIcon,
  empty: CloudOffIcon,
  info: InfoOutlinedIcon,
};

const colorMap: Record<MessageType, string> = {
  error: 'error.main',
  offline: 'warning.main',
  noAccess: 'error.main',
  notFound: 'warning.main',
  empty: 'text.secondary',
  info: 'primary.main',
};

/** Classify a raw error message into a user-friendly type and message */
export function classifyError(err: string): { type: MessageType; title: string; detail: string } {
  const lower = err.toLowerCase();

  if (lower.includes('enotfound') || lower.includes('enetunreach') || lower.includes('fetch failed')) {
    return { type: 'offline', title: 'No internet connection', detail: 'Check your network and try again.' };
  }
  if (lower.includes('econnreset') || lower.includes('socket hang up') || lower.includes('etimedout')) {
    return { type: 'offline', title: 'Connection lost', detail: 'The connection was interrupted. Try again.' };
  }
  if (lower.includes('invalid_grant') || lower.includes('token has been expired') || lower.includes('token expired or revoked')) {
    return { type: 'noAccess', title: 'Session expired', detail: 'Your Google session has expired. Please sign out and sign in again to continue.' };
  }
  if (lower.includes('401') || lower.includes('unauthorized') || lower.includes('not authenticated')) {
    return { type: 'noAccess', title: 'Session expired', detail: 'Please sign out and sign in again.' };
  }
  if (lower.includes('403') || lower.includes('forbidden') || lower.includes('access denied')) {
    return { type: 'noAccess', title: 'Access denied', detail: 'You don\'t have permission. Check your Google account settings.' };
  }
  if (lower.includes('404') || lower.includes('not found')) {
    return { type: 'notFound', title: 'Not found', detail: 'The requested resource no longer exists.' };
  }
  if (lower.includes('429') || lower.includes('rate limit') || lower.includes('quota')) {
    return { type: 'offline', title: 'Too many requests', detail: 'Google API rate limit reached. Wait a moment and try again.' };
  }
  if (lower.includes('500') || lower.includes('internal server') || lower.includes('502') || lower.includes('503')) {
    return { type: 'error', title: 'Server error', detail: 'Google is having issues. Try again in a few minutes.' };
  }
  if (lower.includes('disk') || lower.includes('enospc')) {
    return { type: 'error', title: 'Disk full', detail: 'Not enough disk space. Free up space and try again.' };
  }
  if (lower.includes('permission') || lower.includes('eacces')) {
    return { type: 'noAccess', title: 'Permission denied', detail: 'Cannot access the file or folder. Check permissions.' };
  }

  return { type: 'error', title: 'Something went wrong', detail: err };
}

interface Props {
  type?: MessageType;
  title: string;
  detail?: string;
  onRetry?: () => void;
  compact?: boolean;
}

export default function StatusMessage({ type = 'error', title, detail, onRetry, compact }: Props) {
  const Icon = iconMap[type];
  const color = colorMap[type];

  if (compact) {
    return (
      <Box display="flex" alignItems="center" gap={1} px={2} py={1}>
        <Icon sx={{ fontSize: 16, color, flexShrink: 0 }} />
        <Typography variant="caption" color={color} fontWeight={500}>{title}</Typography>
        {onRetry && (
          <Typography
            variant="caption"
            color="primary.main"
            sx={{ cursor: 'pointer', ml: 'auto', '&:hover': { textDecoration: 'underline' } }}
            onClick={onRetry}
          >
            Retry
          </Typography>
        )}
      </Box>
    );
  }

  return (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      p={4}
      gap={1.5}
    >
      <Icon sx={{ fontSize: 40, color, opacity: 0.6 }} />
      <Typography variant="subtitle2" fontWeight={600} textAlign="center">{title}</Typography>
      {detail && (
        <Typography variant="caption" color="text.secondary" textAlign="center" maxWidth={300}>
          {detail}
        </Typography>
      )}
      {onRetry && (
        <Button size="small" variant="outlined" startIcon={<RefreshIcon />} onClick={onRetry} sx={{ mt: 0.5 }}>
          Try Again
        </Button>
      )}
    </Box>
  );
}
