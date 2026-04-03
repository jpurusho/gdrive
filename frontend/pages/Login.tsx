import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Typography,
  CircularProgress,
  Alert,
  TextField,
  Stepper,
  Step,
  StepLabel,
  alpha,
  useTheme,
  Divider,
  Collapse,
} from '@mui/material';
import CloudSyncIcon from '@mui/icons-material/CloudSync';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SettingsIcon from '@mui/icons-material/Settings';
import type { UserInfo } from '../../shared/types';

interface LoginProps {
  onLogin: (user: UserInfo) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [hasCredentials, setHasCredentials] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSetup, setShowSetup] = useState(false);
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const theme = useTheme();

  useEffect(() => {
    window.api.auth.hasCredentials().then((has) => {
      setHasCredentials(has);
      if (!has) setShowSetup(true);
      setChecking(false);
    });
  }, []);

  async function handleSaveCredentials() {
    if (!clientId.trim() || !clientSecret.trim()) {
      setError('Both Client ID and Client Secret are required.');
      return;
    }
    setError(null);
    await window.api.auth.setCredentials(clientId.trim(), clientSecret.trim());
    setHasCredentials(true);
    setShowSetup(false);
  }

  async function handleLogin() {
    setLoading(true);
    setError(null);
    try {
      const user = await window.api.auth.login();
      onLogin(user);
    } catch (err: any) {
      const msg = err?.message || 'Login failed';
      if (msg === 'Authentication window was closed' || msg.includes('timed out')) {
        setError(msg.includes('timed out') ? 'Login timed out. Please try again.' : null);
      } else if (msg.includes('ENOTFOUND') || msg.includes('ENETUNREACH')) {
        setError('No internet connection. Please check your network.');
      } else if (msg.includes('access_denied')) {
        setError('Access denied. Your Google account may not be authorized for this app.');
      } else if (msg.includes('client_id') || msg.includes('invalid_client')) {
        setError('Invalid OAuth credentials. Please reconfigure.');
        setHasCredentials(false);
        setShowSetup(true);
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  const primary = theme.palette.primary.main;
  const bg = theme.palette.background.default;
  const bgPaper = theme.palette.background.paper;

  if (checking) {
    return (
      <Box display="flex" alignItems="center" justifyContent="center" height="100vh" bgcolor="background.default">
        <CircularProgress size={36} />
      </Box>
    );
  }

  return (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      height="100vh"
      sx={{
        background: `linear-gradient(160deg, ${bg} 0%, ${bgPaper} 50%, ${alpha(theme.palette.primary.dark, 0.15)} 100%)`,
      }}
    >
      <Box className="titlebar-drag" position="fixed" top={0} left={0} right={0} height={52} />

      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2.5,
          p: 5,
          borderRadius: 4,
          background: alpha(bgPaper, 0.6),
          backdropFilter: 'blur(20px)',
          border: `1.5px solid ${alpha(theme.palette.primary.main, 0.2)}`,
          maxWidth: 480,
          width: '92%',
        }}
      >
        {/* Logo */}
        <Box
          sx={{
            width: 70,
            height: 70,
            borderRadius: '18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: `linear-gradient(135deg, ${primary}, ${theme.palette.secondary.main})`,
            boxShadow: `0 8px 32px ${alpha(primary, 0.3)}`,
          }}
        >
          <CloudSyncIcon sx={{ fontSize: 38, color: 'white' }} />
        </Box>

        <Typography
          variant="h5"
          sx={{
            fontWeight: 800,
            background: 'linear-gradient(135deg, #00e5ff, #00bfa5, #64ffda)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          gsync
        </Typography>

        <Typography variant="body2" color="text.secondary" textAlign="center" lineHeight={1.6} maxWidth={350}>
          Sync your Google Drive files with local folders.
        </Typography>

        {error && (
          <Alert severity="error" sx={{ width: '100%', borderRadius: 2 }}>{error}</Alert>
        )}

        {/* Sign In — shown when credentials are available */}
        {hasCredentials && !showSetup && (
          <Box sx={{ width: '100%', textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary" mb={2} display="block">
              Your browser will open for Google sign-in.
            </Typography>
            <Button
              variant="contained"
              size="large"
              onClick={handleLogin}
              disabled={loading}
              fullWidth
              sx={{
                py: 1.5,
                fontSize: '1rem',
                background: `linear-gradient(135deg, ${primary}, ${theme.palette.secondary.main})`,
                '&:hover': { background: `linear-gradient(135deg, ${theme.palette.primary.dark}, ${theme.palette.secondary.dark})` },
              }}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : 'Sign in with Google'}
            </Button>

            <Divider sx={{ my: 2, opacity: 0.2 }} />

            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 0.5, '&:hover': { color: 'primary.main' } }}
              onClick={() => setShowSetup(true)}
            >
              <SettingsIcon sx={{ fontSize: 14 }} /> Configure OAuth credentials
            </Typography>
          </Box>
        )}

        {/* Setup — shown when no credentials or user clicked configure */}
        {showSetup && (
          <Box sx={{ width: '100%' }}>
            <Typography variant="subtitle2" fontWeight={600} mb={1.5}>
              {hasCredentials ? 'Update OAuth Credentials' : 'First-Time Setup'}
            </Typography>

            <Box
              sx={{
                p: 2,
                borderRadius: 2,
                bgcolor: alpha(primary, 0.05),
                border: `1px solid ${alpha(primary, 0.12)}`,
                mb: 2,
              }}
            >
              <Typography variant="caption" color="text.secondary" component="div" lineHeight={1.9}>
                <strong>Google Cloud Console</strong> setup (one time):
              </Typography>
              <Typography variant="caption" color="text.secondary" component="ol" sx={{ pl: 2, mt: 0.5, mb: 0, lineHeight: 1.9 }}>
                <li>Go to <strong>console.cloud.google.com</strong></li>
                <li>APIs &amp; Services → Credentials → Create <strong>OAuth Client ID</strong></li>
                <li>Application type: <strong>Desktop app</strong></li>
                <li>APIs &amp; Services → Library → Enable <strong>Google Drive API</strong></li>
                <li>OAuth consent screen → Add your email as <strong>test user</strong></li>
              </Typography>
            </Box>

            <Box display="flex" flexDirection="column" gap={1.5}>
              <TextField
                size="small"
                label="Client ID"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="123456789-abc.apps.googleusercontent.com"
                fullWidth
              />
              <TextField
                size="small"
                label="Client Secret"
                type="password"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                placeholder="GOCSPX-..."
                fullWidth
              />
              <Box display="flex" gap={1}>
                <Button
                  variant="contained"
                  onClick={handleSaveCredentials}
                  disabled={!clientId.trim() || !clientSecret.trim()}
                  fullWidth
                  sx={{
                    background: `linear-gradient(135deg, ${primary}, ${theme.palette.secondary.main})`,
                  }}
                >
                  Save & Continue
                </Button>
                {hasCredentials && (
                  <Button variant="outlined" onClick={() => setShowSetup(false)}>
                    Cancel
                  </Button>
                )}
              </Box>
            </Box>
          </Box>
        )}

        <Typography variant="caption" color="text.secondary" textAlign="center" sx={{ opacity: 0.6 }}>
          Credentials are stored locally and never shared.
        </Typography>
      </Box>
    </Box>
  );
}
