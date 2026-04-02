import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

interface AppSettingsContextValue {
  appTitle: string;
  setAppTitle: (title: string) => Promise<void>;
}

const AppSettingsContext = createContext<AppSettingsContextValue>(null!);

export function useAppSettings() {
  return useContext(AppSettingsContext);
}

const DEFAULT_TITLE = 'GDrive Sync App';

export function AppSettingsProvider({ children }: { children: React.ReactNode }) {
  const [appTitle, setAppTitleState] = useState(DEFAULT_TITLE);

  useEffect(() => {
    window.api.app.getSetting('app_title').then((val) => {
      if (val) setAppTitleState(val);
    });
  }, []);

  const setAppTitle = useCallback(async (title: string) => {
    const value = title.trim() || DEFAULT_TITLE;
    await window.api.app.setSetting('app_title', value);
    setAppTitleState(value);
  }, []);

  const value = useMemo(() => ({ appTitle, setAppTitle }), [appTitle, setAppTitle]);

  return (
    <AppSettingsContext.Provider value={value}>
      {children}
    </AppSettingsContext.Provider>
  );
}
