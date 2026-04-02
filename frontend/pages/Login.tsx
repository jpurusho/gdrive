import React, { useState } from 'react';
import {
  Box,
  Button,
  Typography,
  CircularProgress,
  Alert,
  alpha,
} from '@mui/material';
import CloudSyncIcon from '@mui/icons-material/CloudSync';
import type { UserInfo } from '../../shared/types';

interface LoginProps {
  onLogin: (user: UserInfo) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin() {
    setLoading(true);
    setError(null);
    try {
      const user = await window.api.auth.login();
      onLogin(user);
    } catch (err: any) {
      const msg = err?.message || 'Login failed';
      if (!msg.includes('window was closed')) {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      height="100vh"
      sx={{
        background: 'linear-gradient(160deg, #0f0f23 0%, #1a1a2e 50%, #16213e 100%)',
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
          background: (t) => alpha(t.palette.background.paper, 0.6),
          backdropFilter: 'blur(20px)',
          border: (t) => `1px solid ${alpha(t.palette.divider, 0.3)}`,
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
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            boxShadow: '0 8px 32px rgba(99, 102, 241, 0.3)',
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
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            '&:hover': {
              background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
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
