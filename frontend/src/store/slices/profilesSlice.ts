import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface FilterRules {
  include: string[];
  exclude: string[];
}

interface ScheduleConfig {
  cron?: string;
  eventTriggers: string[];
}

interface SyncProfile {
  id: number;
  name: string;
  description?: string;
  sourcePath: string;
  destinationPath: string;
  syncDirection: 'bidirectional' | 'upload_only' | 'download_only';
  allowDeletions: boolean;
  conflictResolution: 'prompt' | 'keep_newer' | 'keep_both' | 'keep_local' | 'keep_remote';
  filterRules: FilterRules;
  scheduleConfig: ScheduleConfig;
  lastSyncTimestamp?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ProfilesState {
  profiles: SyncProfile[];
  selectedProfile: SyncProfile | null;
  loading: boolean;
  error: string | null;
}

const initialState: ProfilesState = {
  profiles: [],
  selectedProfile: null,
  loading: false,
  error: null,
};

const profilesSlice = createSlice({
  name: 'profiles',
  initialState,
  reducers: {
    setProfiles: (state, action: PayloadAction<SyncProfile[]>) => {
      state.profiles = action.payload;
      state.loading = false;
      state.error = null;
    },
    selectProfile: (state, action: PayloadAction<SyncProfile | null>) => {
      state.selectedProfile = action.payload;
    },
    addProfile: (state, action: PayloadAction<SyncProfile>) => {
      state.profiles.push(action.payload);
    },
    updateProfile: (state, action: PayloadAction<SyncProfile>) => {
      const index = state.profiles.findIndex(p => p.id === action.payload.id);
      if (index !== -1) {
        state.profiles[index] = action.payload;
      }
      if (state.selectedProfile?.id === action.payload.id) {
        state.selectedProfile = action.payload;
      }
    },
    deleteProfile: (state, action: PayloadAction<number>) => {
      state.profiles = state.profiles.filter(p => p.id !== action.payload);
      if (state.selectedProfile?.id === action.payload) {
        state.selectedProfile = null;
      }
    },
    setProfilesLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setProfilesError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
      state.loading = false;
    },
  },
});

export const {
  setProfiles,
  selectProfile,
  addProfile,
  updateProfile,
  deleteProfile,
  setProfilesLoading,
  setProfilesError,
} = profilesSlice.actions;

export default profilesSlice.reducer;