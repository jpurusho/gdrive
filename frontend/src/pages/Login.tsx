import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Paper,
  Box,
  Typography,
  Button,
  CircularProgress,
  Alert,
  Stack,
  Divider,
} from '@mui/material';
import { Google as GoogleIcon, QrCode as QrCodeIcon } from '@mui/icons-material';
import { authService } from '../services/auth';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [showQrCode, setShowQrCode] = useState(false);

  useEffect(() => {
    // Check if already authenticated
    const checkAuth = async () => {
      const authenticated = await authService.isAuthenticated();
      if (authenticated) {
        navigate('/dashboard');
      }
    };
    checkAuth();
  }, [navigate]);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);

    try {
      const { authorization_url } = await authService.initiateLogin();
      window.location.href = authorization_url;
    } catch (err: any) {
      setError(err.message || 'Failed to initiate login');
      setLoading(false);
    }
  };

  const handleQrCodeLogin = async () => {
    setLoading(true);
    setError(null);
    setShowQrCode(true);

    try {
      const qrData = await authService.getQrCode();
      setQrCodeUrl(qrData.url);
    } catch (err: any) {
      setError(err.message || 'Failed to generate QR code');
      setShowQrCode(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          marginTop: 8,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <Paper elevation={3} sx={{ padding: 4, width: '100%' }}>
          <Typography component="h1" variant="h4" align="center" gutterBottom>
            Google Drive Sync
          </Typography>
          <Typography variant="body1" align="center" color="text.secondary" paragraph>
            Sign in with your Google account to start syncing files
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {!showQrCode ? (
            <Stack spacing={2}>
              <Button
                fullWidth
                variant="contained"
                size="large"
                startIcon={loading ? <CircularProgress size={20} /> : <GoogleIcon />}
                onClick={handleGoogleLogin}
                disabled={loading}
              >
                Sign in with Google
              </Button>

              <Divider>OR</Divider>

              <Button
                fullWidth
                variant="outlined"
                size="large"
                startIcon={loading ? <CircularProgress size={20} /> : <QrCodeIcon />}
                onClick={handleQrCodeLogin}
                disabled={loading}
              >
                Sign in with QR Code
              </Button>

              <Typography variant="caption" align="center" color="text.secondary">
                By signing in, you agree to grant this application access to your Google Drive files
              </Typography>
            </Stack>
          ) : (
            <Box>
              <Typography variant="h6" align="center" gutterBottom>
                Scan QR Code with your mobile device
              </Typography>
              {qrCodeUrl ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', my: 3 }}>
                  <img src={qrCodeUrl} alt="QR Code for login" style={{ maxWidth: '100%' }} />
                </Box>
              ) : (
                <Box sx={{ display: 'flex', justifyContent: 'center', my: 3 }}>
                  <CircularProgress />
                </Box>
              )}
              <Button
                fullWidth
                variant="outlined"
                onClick={() => {
                  setShowQrCode(false);
                  setQrCodeUrl(null);
                }}
              >
                Back to Login Options
              </Button>
            </Box>
          )}
        </Paper>

        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" color="text.secondary" align="center">
            This application requires access to:
          </Typography>
          <Typography variant="body2" color="text.secondary" align="center">
            • View and manage your Google Drive files
          </Typography>
          <Typography variant="body2" color="text.secondary" align="center">
            • View and manage files created by this app
          </Typography>
        </Box>
      </Box>
    </Container>
  );
};

export default Login;