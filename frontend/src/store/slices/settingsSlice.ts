import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface Settings {
  sync: {
    chunkSizeMb: number;
    maxParallelTransfers: number;
    conflictResolutionDefault: string;
    autoRetryFailed: boolean;
    maxRetries: number;
  };
  permissions: {
    allowDeletions: boolean;
    requireDeletionConfirmation: boolean;
    allowSharedDrives: boolean;
    allowWorkspaceExport: boolean;
    exportFormats: {
      [key: string]: string[];
    };
  };
  ui: {
    autoOpenBrowser: boolean;
    showQrCode: boolean;
    theme: string;
    dualPaneDefault: boolean;
  };
}

interface SettingsState {
  settings: Settings | null;
  loading: boolean;
  error: string | null;
}

const initialState: SettingsState = {
  settings: null,
  loading: false,
  error: null,
};

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    setSettings: (state, action: PayloadAction<Settings>) => {
      state.settings = action.payload;
      state.loading = false;
      state.error = null;
    },
    updateSetting: (state, action: PayloadAction<{ path: string; value: any }>) => {
      if (state.settings) {
        const { path, value } = action.payload;
        const keys = path.split('.');
        let current: any = state.settings;

        for (let i = 0; i < keys.length - 1; i++) {
          current = current[keys[i]];
        }

        current[keys[keys.length - 1]] = value;
      }
    },
    setSettingsLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setSettingsError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
      state.loading = false;
    },
  },
});

export const {
  setSettings,
  updateSetting,
  setSettingsLoading,
  setSettingsError,
} = settingsSlice.actions;

export default settingsSlice.reducer;