import React, { useState, useEffect } from 'react';
import { Box, CircularProgress, Typography, Button } from '@mui/material';
import ErrorBoundary from './components/ErrorBoundary/ErrorBoundary';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import type { UserInfo } from '../shared/types';

export default function App() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    setError(null);
    setLoading(true);
    try {
      const loggedIn = await window.api.auth.isLoggedIn();
      if (loggedIn) {
        const userInfo = await window.api.auth.getUser();
        setUser(userInfo);
      }
    } catch (err: any) {
      console.error('Auth check failed:', err);
      // Don't show error — just fall through to login screen
    } finally {
      setLoading(false);
    }
  }

  function handleLogin(userInfo: UserInfo) {
    setUser(userInfo);
  }

  async function handleLogout() {
    try {
      await window.api.auth.logout();
    } catch {
      // Still clear local state even if revoke fails
    }
    setUser(null);
  }

  if (loading) {
    return (
      <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" height="100vh" gap={2} bgcolor="background.default">
        <CircularProgress size={36} />
        <Typography variant="caption" color="text.secondary">Loading...</Typography>
      </Box>
    );
  }

  if (!user) {
    return (
      <ErrorBoundary fallbackTitle="Login error">
        <Login onLogin={handleLogin} />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary fallbackTitle="Application error">
      <Dashboard user={user} onLogout={handleLogout} />
    </ErrorBoundary>
  );
}
