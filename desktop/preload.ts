import { contextBridge, ipcRenderer } from 'electron';
import type { ElectronAPI } from '../shared/types';

const api: ElectronAPI = {
  auth: {
    hasCredentials: () => ipcRenderer.invoke('auth:hasCredentials'),
    setCredentials: (clientId: string, clientSecret: string) => ipcRenderer.invoke('auth:setCredentials', clientId, clientSecret),
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
  backup: {
    backup: () => ipcRenderer.invoke('backup:backup'),
    restore: () => ipcRenderer.invoke('backup:restore'),
    syncMerge: () => ipcRenderer.invoke('backup:syncMerge'),
    getInfo: () => ipcRenderer.invoke('backup:getInfo'),
  },
  app: {
    getDataDir: () => ipcRenderer.invoke('app:getDataDir'),
    setDataDir: (dir: string) => ipcRenderer.invoke('app:setDataDir', dir),
    getVersion: () => ipcRenderer.invoke('app:getVersion'),
    checkForUpdates: () => ipcRenderer.invoke('app:checkForUpdates'),
    getPlatform: () => ipcRenderer.invoke('app:getPlatform'),
    getSetting: (key: string) => ipcRenderer.invoke('app:getSetting', key),
    setSetting: (key: string, value: string) => ipcRenderer.invoke('app:setSetting', key, value),
  },
};

contextBridge.exposeInMainWorld('api', api);
