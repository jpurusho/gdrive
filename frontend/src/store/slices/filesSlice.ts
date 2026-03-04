import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface FileItem {
  name: string;
  path: string;
  type: 'file' | 'folder';
  size?: number;
  modified?: string;
  mimeType?: string;
  isGoogleWorkspace?: boolean;
  googleId?: string;
}

interface FilesState {
  localFiles: FileItem[];
  localPath: string;
  driveFiles: FileItem[];
  drivePath: string;
  selectedLocalFiles: string[];
  selectedDriveFiles: string[];
  loading: {
    local: boolean;
    drive: boolean;
  };
  error: {
    local: string | null;
    drive: string | null;
  };
}

const initialState: FilesState = {
  localFiles: [],
  localPath: '/sync/local',
  driveFiles: [],
  drivePath: 'root',
  selectedLocalFiles: [],
  selectedDriveFiles: [],
  loading: {
    local: false,
    drive: false,
  },
  error: {
    local: null,
    drive: null,
  },
};

const filesSlice = createSlice({
  name: 'files',
  initialState,
  reducers: {
    setLocalFiles: (state, action: PayloadAction<FileItem[]>) => {
      state.localFiles = action.payload;
      state.loading.local = false;
      state.error.local = null;
    },
    setDriveFiles: (state, action: PayloadAction<FileItem[]>) => {
      state.driveFiles = action.payload;
      state.loading.drive = false;
      state.error.drive = null;
    },
    setLocalPath: (state, action: PayloadAction<string>) => {
      state.localPath = action.payload;
      state.selectedLocalFiles = [];
    },
    setDrivePath: (state, action: PayloadAction<string>) => {
      state.drivePath = action.payload;
      state.selectedDriveFiles = [];
    },
    selectLocalFiles: (state, action: PayloadAction<string[]>) => {
      state.selectedLocalFiles = action.payload;
    },
    selectDriveFiles: (state, action: PayloadAction<string[]>) => {
      state.selectedDriveFiles = action.payload;
    },
    setLocalLoading: (state, action: PayloadAction<boolean>) => {
      state.loading.local = action.payload;
    },
    setDriveLoading: (state, action: PayloadAction<boolean>) => {
      state.loading.drive = action.payload;
    },
    setLocalError: (state, action: PayloadAction<string | null>) => {
      state.error.local = action.payload;
      state.loading.local = false;
    },
    setDriveError: (state, action: PayloadAction<string | null>) => {
      state.error.drive = action.payload;
      state.loading.drive = false;
    },
  },
});

export const {
  setLocalFiles,
  setDriveFiles,
  setLocalPath,
  setDrivePath,
  selectLocalFiles,
  selectDriveFiles,
  setLocalLoading,
  setDriveLoading,
  setLocalError,
  setDriveError,
} = filesSlice.actions;

export default filesSlice.reducer;