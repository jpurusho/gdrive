import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import syncReducer from './slices/syncSlice';
import filesReducer from './slices/filesSlice';
import profilesReducer from './slices/profilesSlice';
import settingsReducer from './slices/settingsSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    sync: syncReducer,
    files: filesReducer,
    profiles: profilesReducer,
    settings: settingsReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;