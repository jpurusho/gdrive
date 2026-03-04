import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface SyncProgress {
  profileId: number;
  status: 'idle' | 'running' | 'completed' | 'failed';
  progress: number;
  filesProcessed: number;
  totalFiles: number;
  bytesTransferred: number;
  currentFile: string | null;
  errors: Array<{ file: string; error: string }>;
}

interface SyncState {
  activeSync: SyncProgress | null;
  syncHistory: Array<any>;
  loading: boolean;
  error: string | null;
}

const initialState: SyncState = {
  activeSync: null,
  syncHistory: [],
  loading: false,
  error: null,
};

const syncSlice = createSlice({
  name: 'sync',
  initialState,
  reducers: {
    startSync: (state, action: PayloadAction<number>) => {
      state.activeSync = {
        profileId: action.payload,
        status: 'running',
        progress: 0,
        filesProcessed: 0,
        totalFiles: 0,
        bytesTransferred: 0,
        currentFile: null,
        errors: [],
      };
      state.loading = true;
      state.error = null;
    },
    updateSyncProgress: (state, action: PayloadAction<Partial<SyncProgress>>) => {
      if (state.activeSync) {
        state.activeSync = { ...state.activeSync, ...action.payload };
      }
    },
    syncCompleted: (state) => {
      if (state.activeSync) {
        state.activeSync.status = 'completed';
        state.activeSync.progress = 100;
      }
      state.loading = false;
    },
    syncFailed: (state, action: PayloadAction<string>) => {
      if (state.activeSync) {
        state.activeSync.status = 'failed';
      }
      state.loading = false;
      state.error = action.payload;
    },
    clearSync: (state) => {
      state.activeSync = null;
      state.loading = false;
      state.error = null;
    },
    setSyncHistory: (state, action: PayloadAction<Array<any>>) => {
      state.syncHistory = action.payload;
    },
  },
});

export const {
  startSync,
  updateSyncProgress,
  syncCompleted,
  syncFailed,
  clearSync,
  setSyncHistory,
} = syncSlice.actions;

export default syncSlice.reducer;