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
    id: 'dracula',
    name: 'Dracula',
    mode: 'dark',
    colors: {
      primary: '#bd93f9',
      primaryLight: '#d6bcfa',
      primaryDark: '#9b6dff',
      secondary: '#ff79c6',
      secondaryLight: '#ff92d0',
      secondaryDark: '#ff5fba',
      background: '#282a36',
      paper: '#343746',
      text: '#f8f8f2',
      textSecondary: '#6272a4',
      success: '#50fa7b',
      warning: '#f1fa8c',
      error: '#ff5555',
      divider: '#44475a',
    },
  },
  {
    id: 'nord',
    name: 'Nord',
    mode: 'dark',
    colors: {
      primary: '#88c0d0',
      primaryLight: '#8fbcbb',
      primaryDark: '#5e81ac',
      secondary: '#81a1c1',
      secondaryLight: '#88c0d0',
      secondaryDark: '#5e81ac',
      background: '#2e3440',
      paper: '#3b4252',
      text: '#eceff4',
      textSecondary: '#d8dee9',
      success: '#a3be8c',
      warning: '#ebcb8b',
      error: '#bf616a',
      divider: '#434c5e',
    },
  },
  {
    id: 'one-dark',
    name: 'One Dark Pro',
    mode: 'dark',
    colors: {
      primary: '#61afef',
      primaryLight: '#82c4f8',
      primaryDark: '#4d8fcc',
      secondary: '#c678dd',
      secondaryLight: '#d898e8',
      secondaryDark: '#a855c7',
      background: '#282c34',
      paper: '#21252b',
      text: '#abb2bf',
      textSecondary: '#5c6370',
      success: '#98c379',
      warning: '#e5c07b',
      error: '#e06c75',
      divider: '#3e4452',
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
