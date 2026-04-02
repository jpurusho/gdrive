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
  Link,
  Divider,
} from '@mui/material';
import CloudSyncIcon from '@mui/icons-material/CloudSync';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import type { UserInfo } from '../../shared/types';

interface LoginProps {
  onLogin: (user: UserInfo) => void;
}

const SETUP_STEPS = ['Configure Google OAuth', 'Sign In'];

export default function Login({ onLogin }: LoginProps) {
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [hasCredentials, setHasCredentials] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [credentialsSaved, setCredentialsSaved] = useState(false);
  const theme = useTheme();

  useEffect(() => {
    window.api.auth.hasCredentials().then((has) => {
      setHasCredentials(has);
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
    setCredentialsSaved(true);
  }

  async function handleLogin() {
    setLoading(true);
    setError(null);
    try {
      const user = await window.api.auth.login();
      onLogin(user);
    } catch (err: any) {
      const msg = err?.message || 'Login failed';
      if (msg === 'Authentication window was closed') {
        // User closed — not an error
      } else if (msg.includes('ENOTFOUND') || msg.includes('ENETUNREACH')) {
        setError('No internet connection. Please check your network.');
      } else if (msg.includes('access_denied')) {
        setError('Access denied. Make sure your email is added as a test user in Google Cloud Console.');
      } else if (msg.includes('client_id') || msg.includes('invalid_client')) {
        setError('Invalid Client ID or Secret. Please check your credentials.');
        setHasCredentials(false);
        setCredentialsSaved(false);
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

  const activeStep = hasCredentials ? 1 : 0;

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
          maxWidth: 520,
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

        <Typography variant="body2" color="text.secondary" textAlign="center" lineHeight={1.6} maxWidth={380}>
          Sync your Google Drive files with local folders. To get started, you need Google OAuth credentials.
        </Typography>

        {/* Stepper */}
        <Stepper activeStep={activeStep} alternativeLabel sx={{ width: '100%' }}>
          {SETUP_STEPS.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {error && (
          <Alert severity="error" sx={{ width: '100%', borderRadius: 2 }}>{error}</Alert>
        )}

        {/* Step 1: Configure credentials */}
        {!hasCredentials && (
          <Box sx={{ width: '100%' }}>
            <Typography variant="subtitle2" fontWeight={600} mb={1}>
              Google Cloud Setup
            </Typography>
            <Box
              sx={{
                p: 2,
                borderRadius: 2,
                bgcolor: alpha(theme.palette.info.main || primary, 0.06),
                border: `1px solid ${alpha(theme.palette.info.main || primary, 0.15)}`,
                mb: 2,
              }}
            >
              <Typography variant="caption" color="text.secondary" component="div" lineHeight={1.8}>
                1. Go to <strong>Google Cloud Console</strong> &gt; APIs &amp; Services &gt; Credentials<br />
                2. Create an <strong>OAuth 2.0 Client ID</strong> (type: <strong>Desktop app</strong>)<br />
                3. Enable the <strong>Google Drive API</strong> in APIs &amp; Services &gt; Library<br />
                4. In OAuth consent screen, add your email as a <strong>test user</strong><br />
                5. Copy the Client ID and Client Secret below
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
              <Button
                variant="contained"
                onClick={handleSaveCredentials}
                disabled={!clientId.trim() || !clientSecret.trim()}
                sx={{
                  background: `linear-gradient(135deg, ${primary}, ${theme.palette.secondary.main})`,
                  '&:hover': { background: `linear-gradient(135deg, ${theme.palette.primary.dark}, ${theme.palette.secondary.dark})` },
                }}
              >
                Save Credentials
              </Button>
            </Box>
          </Box>
        )}

        {/* Step 2: Sign in */}
        {hasCredentials && (
          <Box sx={{ width: '100%', textAlign: 'center' }}>
            {credentialsSaved && (
              <Box display="flex" alignItems="center" justifyContent="center" gap={0.75} mb={1.5}>
                <CheckCircleIcon sx={{ fontSize: 18, color: 'success.main' }} />
                <Typography variant="body2" color="success.main" fontWeight={500}>
                  Credentials saved
                </Typography>
              </Box>
            )}
            <Typography variant="caption" color="text.secondary" mb={2} display="block">
              Your browser will open for Google sign-in. After approval, you'll be redirected back automatically.
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

            <Divider sx={{ my: 2, opacity: 0.3 }} />

            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ cursor: 'pointer', '&:hover': { color: 'primary.main' } }}
              onClick={() => { setHasCredentials(false); setCredentialsSaved(false); }}
            >
              Change OAuth credentials
            </Typography>
          </Box>
        )}

        <Typography variant="caption" color="text.secondary" textAlign="center" sx={{ opacity: 0.7 }}>
          Your credentials are stored locally and never shared.
        </Typography>
      </Box>
    </Box>
  );
}
