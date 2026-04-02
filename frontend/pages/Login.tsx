import React, { useState } from 'react';
import {
  Box,
  Button,
  Typography,
  CircularProgress,
  Alert,
  alpha,
  useTheme,
} from '@mui/material';
import CloudSyncIcon from '@mui/icons-material/CloudSync';
import type { UserInfo } from '../../shared/types';

interface LoginProps {
  onLogin: (user: UserInfo) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const theme = useTheme();

  async function handleLogin() {
    setLoading(true);
    setError(null);
    try {
      const user = await window.api.auth.login();
      onLogin(user);
    } catch (err: any) {
      const msg = err?.message || 'Login failed';
      if (msg === 'Authentication window was closed') {
        // User closed the window — not an error
      } else if (msg.includes('ENOTFOUND') || msg.includes('ENETUNREACH')) {
        setError('No internet connection. Please check your network.');
      } else if (msg.includes('401') || msg.includes('Unauthorized')) {
        setError('Authentication failed. Please try again.');
      } else if (msg.includes('access_denied')) {
        setError('Access denied. Make sure your email is added as a test user in Google Cloud Console.');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  const primary = theme.palette.primary.main;
  const primaryDark = theme.palette.primary.dark;
  const bg = theme.palette.background.default;
  const bgPaper = theme.palette.background.paper;

  return (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      height="100vh"
      sx={{
        background: `linear-gradient(160deg, ${bg} 0%, ${bgPaper} 50%, ${alpha(primaryDark, 0.15)} 100%)`,
      }}
    >
      <Box className="titlebar-drag" position="fixed" top={0} left={0} right={0} height={52} />

      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 3,
          p: 6,
          borderRadius: 4,
          background: alpha(theme.palette.background.paper, 0.6),
          backdropFilter: 'blur(20px)',
          border: `1px solid ${alpha(theme.palette.divider, 0.3)}`,
          maxWidth: 420,
          width: '90%',
        }}
      >
        <Box
          sx={{
            width: 80,
            height: 80,
            borderRadius: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: `linear-gradient(135deg, ${primary}, ${theme.palette.secondary.main})`,
            boxShadow: `0 8px 32px ${alpha(primary, 0.3)}`,
          }}
        >
          <CloudSyncIcon sx={{ fontSize: 44, color: 'white' }} />
        </Box>

        <Typography variant="h4" fontWeight={700} letterSpacing={-0.5}>
          GDrive Sync
        </Typography>

        <Typography
          variant="body1"
          color="text.secondary"
          textAlign="center"
          sx={{ maxWidth: 300, lineHeight: 1.6 }}
        >
          Sync your Google Drive files with your local folders. Fast, reliable, and secure.
        </Typography>

        {error && (
          <Alert severity="error" sx={{ width: '100%', borderRadius: 2 }}>
            {error}
          </Alert>
        )}

        <Button
          variant="contained"
          size="large"
          onClick={handleLogin}
          disabled={loading}
          sx={{
            mt: 1,
            width: '100%',
            py: 1.5,
            fontSize: '1rem',
            background: `linear-gradient(135deg, ${primary}, ${theme.palette.secondary.main})`,
            '&:hover': {
              background: `linear-gradient(135deg, ${primaryDark}, ${theme.palette.secondary.dark})`,
            },
          }}
        >
          {loading ? <CircularProgress size={24} color="inherit" /> : 'Sign in with Google'}
        </Button>

        <Typography variant="caption" color="text.secondary" textAlign="center">
          Your credentials are stored locally and never shared.
        </Typography>
      </Box>
    </Box>
  );
}
