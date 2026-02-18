import { contextBridge, ipcRenderer } from 'electron';

// Expose IPC API to renderer process
contextBridge.exposeInMainWorld('textimg', {
    // Window controls
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    forceClose: () => ipcRenderer.invoke('window:force-close'),
    newWindow: () => ipcRenderer.invoke('window:new'),
    openKeyboardShortcuts: () => ipcRenderer.invoke('window:keyboard-shortcuts'),
    openPreferences: () => ipcRenderer.invoke('window:preferences'),
    showMenu: () => ipcRenderer.invoke('menu:show'),
    getWindowCount: () => ipcRenderer.invoke('window:get-count'),
    isMaximized: () => ipcRenderer.invoke('window:isMaximized'),

    // File operations
    newFile: (tabId: string) => ipcRenderer.invoke('file:new', tabId),
    openDialog: () => ipcRenderer.invoke('file:open-dialog'),
    openFile: (filePath: string, tabId: string) => ipcRenderer.invoke('file:open', filePath, tabId),
    saveDialog: (defaultName: string) => ipcRenderer.invoke('file:save-dialog', defaultName),
    saveAsDialog: (currentPath: string) => ipcRenderer.invoke('file:save-as-dialog', currentPath),
    saveFile: (data: { tabId: string; filePath: string; content: any; imageMap: Record<string, string>; tempImages: Record<string, string> }) =>
        ipcRenderer.invoke('file:save', data),
    loadImages: (data: { filePath: string; tabId: string }) =>
        ipcRenderer.invoke('file:load-images', data.filePath, data.tabId),

    // Session management
    getSession: () => ipcRenderer.invoke('session:get'),
    saveSession: (filePaths: string[]) => ipcRenderer.invoke('session:save', filePaths),
    getFullSession: () => ipcRenderer.invoke('session:get-full'),
    saveFullSession: (sessionData: any) => ipcRenderer.invoke('session:save-full', sessionData),
    saveTabContent: (tabData: any) => ipcRenderer.invoke('session:save-tab', tabData),

    // Settings
    getSettings: () => ipcRenderer.invoke('settings:get'),
    saveSettings: (settings: any) => ipcRenderer.invoke('settings:save', settings),

    // Dialogs
    showUnsavedChangesDialog: (filename: string) => ipcRenderer.invoke('dialog:unsaved-changes', filename),
    showMultipleUnsavedChangesDialog: (filenames: string[]) => ipcRenderer.invoke('dialog:unsaved-changes-multiple', filenames),

    // Tab management
    closeTab: (tabId: string) => ipcRenderer.invoke('tab:close', tabId),
    readTempImages: (tabId: string, filenames: string[]) => ipcRenderer.invoke('tab:read-temp-images', tabId, filenames),
    restoreTempImages: (tabId: string, imageData: Record<string, string>) => ipcRenderer.invoke('tab:restore-temp-images', tabId, imageData),

    // Clipboard & images
    readClipboardImage: () => ipcRenderer.invoke('clipboard:read-image'),
    saveClipboardBuffer: (tabId: string, buffer: Buffer) => ipcRenderer.invoke('clipboard:save-buffer', tabId, buffer),
    pasteImage: (tabId: string, imageDataUrl: string) => ipcRenderer.invoke('clipboard:paste-image', tabId, imageDataUrl),

    // Event listeners
    onMaximizedChange: (callback: (isMaximized: boolean) => void) => {
        ipcRenderer.on('window:maximized', (_event, isMaximized) => callback(isMaximized));
    },
    onMenuAction: (callback: (action: string) => void) => {
        ipcRenderer.on('menu:action', (_event, action) => callback(action));
    },
    onCloseRequest: (callback: (data: { isLastWindow: boolean }) => void) => {
        ipcRenderer.on('window:close-request', (_event, data) => callback(data));
    },
    onSettingsChanged: (callback: () => void) => {
        ipcRenderer.on('settings:changed', () => callback());
    }
});
