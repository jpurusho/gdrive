import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';
import { createTheme, ThemeProvider as MuiThemeProvider, CssBaseline } from '@mui/material';
import { themes, buildThemeOptions } from './themes';
import type { ThemeDefinition } from './themes';

const STORAGE_KEY = 'gdrive-sync-theme';

interface ThemeContextValue {
  currentTheme: ThemeDefinition;
  themeId: string;
  setThemeId: (id: string) => void;
  availableThemes: ThemeDefinition[];
}

const ThemeContext = createContext<ThemeContextValue>(null!);

export function useThemeContext() {
  return useContext(ThemeContext);
}

function getInitialThemeId(): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && themes.some((t) => t.id === stored)) return stored;
  } catch {}
  return 'midnight';
}

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeId, setThemeIdState] = useState(getInitialThemeId);

  const setThemeId = useCallback((id: string) => {
    setThemeIdState(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {}
  }, []);

  const currentTheme = useMemo(
    () => themes.find((t) => t.id === themeId) || themes[0],
    [themeId],
  );

  const muiTheme = useMemo(
    () => createTheme(buildThemeOptions(currentTheme)),
    [currentTheme],
  );

  const value = useMemo(
    () => ({ currentTheme, themeId, setThemeId, availableThemes: themes }),
    [currentTheme, themeId, setThemeId],
  );

  return (
    <ThemeContext.Provider value={value}>
      <MuiThemeProvider theme={muiTheme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </ThemeContext.Provider>
  );
}
