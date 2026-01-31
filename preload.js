const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('teximg', {
    // Window controls
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    forceClose: () => ipcRenderer.invoke('window:force-close'),
    newWindow: () => ipcRenderer.invoke('window:new'),
    getWindowCount: () => ipcRenderer.invoke('window:get-count'),
    isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
    onMaximizedChange: (callback) => {
        ipcRenderer.on('window:maximized', (event, isMaximized) => callback(isMaximized));
    },
    onCloseRequest: (callback) => {
        ipcRenderer.on('window:close-request', (event, data) => callback(data));
    },

    // Native menu
    showMenu: () => ipcRenderer.invoke('menu:show'),
    onMenuAction: (callback) => {
        ipcRenderer.on('menu:action', (event, action) => callback(action));
    },

    showUnsavedChangesDialog: (filename) => ipcRenderer.invoke('dialog:unsaved-changes', filename),

    // Session management
    getSession: () => ipcRenderer.invoke('session:get'),
    saveSession: (filePaths) => ipcRenderer.invoke('session:save', filePaths),
    getFullSession: () => ipcRenderer.invoke('session:get-full'),
    saveFullSession: (sessionData) => ipcRenderer.invoke('session:save-full', sessionData),
    saveTabContent: (tabData) => ipcRenderer.invoke('session:save-tab', tabData),

    // Settings management
    getSettings: () => ipcRenderer.invoke('settings:get'),
    saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),

    // File operations
    newFile: (tabId) => ipcRenderer.invoke('file:new', tabId),
    openDialog: () => ipcRenderer.invoke('file:open-dialog'),
    openFile: (filePath, tabId) => ipcRenderer.invoke('file:open', filePath, tabId),
    loadImages: (filePath, tabId) => ipcRenderer.invoke('file:load-images', filePath, tabId),
    saveDialog: (defaultName) => ipcRenderer.invoke('file:save-dialog', defaultName),
    saveAsDialog: (currentPath) => ipcRenderer.invoke('file:save-as-dialog', currentPath),
    saveFile: (data) => ipcRenderer.invoke('file:save', data),

    // Clipboard
    readClipboardImage: () => ipcRenderer.invoke('clipboard:read-image'),
    saveClipboardBuffer: (tabId, buffer) => ipcRenderer.invoke('clipboard:save-buffer', tabId, buffer),

    // Tab management
    closeTab: (tabId) => ipcRenderer.invoke('tab:close', tabId),
    getTempDir: (tabId) => ipcRenderer.invoke('tab:get-temp-dir', tabId),
    readTempImages: (tabId, filenames) => ipcRenderer.invoke('tab:read-temp-images', tabId, filenames),
    restoreTempImages: (tabId, imageData) => ipcRenderer.invoke('tab:restore-temp-images', tabId, imageData)
});
