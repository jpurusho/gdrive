import { createTheme, alpha } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#6366f1',
      light: '#818cf8',
      dark: '#4f46e5',
    },
    secondary: {
      main: '#8b5cf6',
      light: '#a78bfa',
      dark: '#7c3aed',
    },
    background: {
      default: '#0f0f23',
      paper: '#1a1a2e',
    },
    success: { main: '#10b981' },
    warning: { main: '#f59e0b' },
    error: { main: '#ef4444' },
    text: {
      primary: '#e2e8f0',
      secondary: '#94a3b8',
    },
    divider: alpha('#94a3b8', 0.12),
  },
  typography: {
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    h4: { fontWeight: 700 },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
    subtitle1: { fontWeight: 500 },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  shape: { borderRadius: 12 },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        '::-webkit-scrollbar': { width: 6, height: 6 },
        '::-webkit-scrollbar-track': { background: 'transparent' },
        '::-webkit-scrollbar-thumb': { background: alpha('#94a3b8', 0.3), borderRadius: 3 },
        '::-webkit-scrollbar-thumb:hover': { background: alpha('#94a3b8', 0.5) },
      },
    },
    MuiButton: {
      styleOverrides: { root: { borderRadius: 10, padding: '10px 24px' } },
    },
    MuiPaper: {
      styleOverrides: { root: { backgroundImage: 'none' } },
    },
    MuiCard: {
      styleOverrides: {
        root: { backgroundImage: 'none', border: `1px solid ${alpha('#94a3b8', 0.1)}` },
      },
    },
  },
});
