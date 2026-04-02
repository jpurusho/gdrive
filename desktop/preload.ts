import { contextBridge, ipcRenderer } from 'electron';
import type { ElectronAPI } from '../shared/types';

const api: ElectronAPI = {
  auth: {
    login: () => ipcRenderer.invoke('auth:login'),
    logout: () => ipcRenderer.invoke('auth:logout'),
    getUser: () => ipcRenderer.invoke('auth:getUser'),
    isLoggedIn: () => ipcRenderer.invoke('auth:isLoggedIn'),
  },
  drive: {
    listDrives: () => ipcRenderer.invoke('drive:listDrives'),
    listFiles: (driveId: string, folderId: string) =>
      ipcRenderer.invoke('drive:listFiles', driveId, folderId),
  },
  localFs: {
    listDirectory: (dirPath: string) =>
      ipcRenderer.invoke('localFs:listDirectory', dirPath),
    getHomeDir: () => ipcRenderer.invoke('localFs:getHomeDir'),
    selectDirectory: () => ipcRenderer.invoke('localFs:selectDirectory'),
  },
  sync: {
    getProfiles: () => ipcRenderer.invoke('sync:getProfiles'),
    createProfile: (profile) => ipcRenderer.invoke('sync:createProfile', profile),
    updateProfile: (id, updates) => ipcRenderer.invoke('sync:updateProfile', id, updates),
    deleteProfile: (id) => ipcRenderer.invoke('sync:deleteProfile', id),
    startSync: (profileId) => ipcRenderer.invoke('sync:startSync', profileId),
    cancelSync: (sessionId) => ipcRenderer.invoke('sync:cancelSync', sessionId),
    getSessions: (profileId) => ipcRenderer.invoke('sync:getSessions', profileId),
    onSyncProgress: (callback) => {
      const handler = (_event: Electron.IpcRendererEvent, session: any) => callback(session);
      ipcRenderer.on('sync:progress', handler);
      return () => ipcRenderer.removeListener('sync:progress', handler);
    },
  },
  app: {
    getVersion: () => ipcRenderer.invoke('app:getVersion'),
    checkForUpdates: () => ipcRenderer.invoke('app:checkForUpdates'),
    getPlatform: () => ipcRenderer.invoke('app:getPlatform'),
  },
};

contextBridge.exposeInMainWorld('api', api);
