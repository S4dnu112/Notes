import { contextBridge, ipcRenderer } from 'electron';

// Minimal preload for the preferences window
contextBridge.exposeInMainWorld('prefs', {
    getSettings: () => ipcRenderer.invoke('settings:get'),
    saveSettings: (settings: any) => ipcRenderer.invoke('settings:save', settings),
    closeWindow: () => ipcRenderer.invoke('preferences:close')
});
