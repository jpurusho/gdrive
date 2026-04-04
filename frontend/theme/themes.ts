import { alpha } from '@mui/material/styles';
import type { ThemeOptions } from '@mui/material/styles';

export interface ThemeDefinition {
  id: string;
  name: string;
  mode: 'dark' | 'light';
  colors: {
    primary: string;
    primaryLight: string;
    primaryDark: string;
    secondary: string;
    secondaryLight: string;
    secondaryDark: string;
    background: string;
    paper: string;
    text: string;
    textSecondary: string;
    success: string;
    warning: string;
    error: string;
    divider: string;
  };
}

export const themes: ThemeDefinition[] = [
  {
    id: 'midnight',
    name: 'Midnight',
    mode: 'dark',
    colors: {
      primary: '#6366f1',
      primaryLight: '#818cf8',
      primaryDark: '#4f46e5',
      secondary: '#8b5cf6',
      secondaryLight: '#a78bfa',
      secondaryDark: '#7c3aed',
      background: '#0f0f23',
      paper: '#1a1a2e',
      text: '#e2e8f0',
      textSecondary: '#94a3b8',
      success: '#10b981',
      warning: '#f59e0b',
      error: '#ef4444',
      divider: '#94a3b8',
    },
  },
  {
    id: 'github-dark',
    name: 'GitHub Dark',
    mode: 'dark',
    colors: {
      primary: '#58a6ff',
      primaryLight: '#79c0ff',
      primaryDark: '#388bfd',
      secondary: '#bc8cff',
      secondaryLight: '#d2a8ff',
      secondaryDark: '#a371f7',
      background: '#0d1117',
      paper: '#161b22',
      text: '#c9d1d9',
      textSecondary: '#8b949e',
      success: '#3fb950',
      warning: '#d29922',
      error: '#f85149',
      divider: '#30363d',
    },
  },
  {
    id: 'ocean',
    name: 'Ocean',
    mode: 'dark',
    colors: {
      primary: '#22d3ee',
      primaryLight: '#67e8f9',
      primaryDark: '#0891b2',
      secondary: '#06b6d4',
      secondaryLight: '#22d3ee',
      secondaryDark: '#0e7490',
      background: '#0c1222',
      paper: '#122035',
      text: '#e2e8f0',
      textSecondary: '#7494b8',
      success: '#34d399',
      warning: '#fbbf24',
      error: '#f87171',
      divider: '#1e3a5f',
    },
  },
  {
    id: 'sunset',
    name: 'Sunset',
    mode: 'dark',
    colors: {
      primary: '#f59e0b',
      primaryLight: '#fbbf24',
      primaryDark: '#d97706',
      secondary: '#f97316',
      secondaryLight: '#fb923c',
      secondaryDark: '#ea580c',
      background: '#1a1008',
      paper: '#261a0e',
      text: '#fef3c7',
      textSecondary: '#b49a6e',
      success: '#4ade80',
      warning: '#fbbf24',
      error: '#ef4444',
      divider: '#3d2a14',
    },
  },
  {
    id: 'light',
    name: 'Light',
    mode: 'light',
    colors: {
      primary: '#0969da',
      primaryLight: '#218bff',
      primaryDark: '#0550ae',
      secondary: '#8250df',
      secondaryLight: '#a475f9',
      secondaryDark: '#6639ba',
      background: '#f6f8fa',
      paper: '#ffffff',
      text: '#1f2328',
      textSecondary: '#656d76',
      success: '#1a7f37',
      warning: '#9a6700',
      error: '#cf222e',
      divider: '#d0d7de',
    },
  },
];

export function buildThemeOptions(def: ThemeDefinition): ThemeOptions {
  const { colors, mode } = def;
  const isLight = mode === 'light';

  return {
    palette: {
      mode,
      primary: { main: colors.primary, light: colors.primaryLight, dark: colors.primaryDark },
      secondary: { main: colors.secondary, light: colors.secondaryLight, dark: colors.secondaryDark },
      background: { default: colors.background, paper: colors.paper },
      success: { main: colors.success },
      warning: { main: colors.warning },
      error: { main: colors.error },
      text: { primary: colors.text, secondary: colors.textSecondary },
      divider: isLight ? colors.divider : alpha(colors.divider, 0.5),
    },
    typography: {
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      h4: { fontWeight: 700 },
      h5: { fontWeight: 600 },
      h6: { fontWeight: 600 },
      subtitle1: { fontWeight: 500 },
      button: { textTransform: 'none' as const, fontWeight: 600 },
    },
    shape: { borderRadius: 12 },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          '::-webkit-scrollbar': { width: 6, height: 6 },
          '::-webkit-scrollbar-track': { background: 'transparent' },
          '::-webkit-scrollbar-thumb': {
            background: alpha(colors.textSecondary, 0.3),
            borderRadius: 3,
          },
          '::-webkit-scrollbar-thumb:hover': {
            background: alpha(colors.textSecondary, 0.5),
          },
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
          root: {
            backgroundImage: 'none',
            border: `1px solid ${isLight ? colors.divider : alpha(colors.divider, 0.3)}`,
          },
        },
      },
    },
  };
}
