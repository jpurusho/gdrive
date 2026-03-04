import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Box, CircularProgress, Typography, Alert } from '@mui/material';
import { authService } from '../services/auth';
import { useDispatch } from 'react-redux';
import { loginSuccess, loginFailure } from '../store/slices/authSlice';

const AuthCallback: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const handleCallback = async () => {
      // Check for success params
      const userId = searchParams.get('user_id');
      if (userId) {
        // Authentication successful
        authService.setUserId(parseInt(userId, 10));

        try {
          const user = await authService.getCurrentUser();
          dispatch(loginSuccess(user));
          navigate('/dashboard');
        } catch (error) {
          dispatch(loginFailure('Failed to get user information'));
          navigate('/login');
        }
        return;
      }

      // Check for error
      const error = searchParams.get('message') || searchParams.get('error');
      if (error) {
        dispatch(loginFailure(error));
        setTimeout(() => navigate('/login'), 3000);
        return;
      }

      // No valid params, redirect to login
      navigate('/login');
    };

    handleCallback();
  }, [searchParams, navigate, dispatch]);

  const error = searchParams.get('message') || searchParams.get('error');

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
      }}
    >
      {error ? (
        <>
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
          <Typography>Redirecting to login...</Typography>
        </>
      ) : (
        <>
          <CircularProgress size={48} sx={{ mb: 2 }} />
          <Typography variant="h6">Completing authentication...</Typography>
        </>
      )}
    </Box>
  );
};

export default AuthCallback;