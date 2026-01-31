const { app, BrowserWindow, ipcMain, dialog, nativeImage, clipboard, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { v4: uuidv4 } = require('uuid');

const { readContentJson, extractImages, createZip, createEmptyDocument } = require('./lib/zipHandler');
const { getSession, saveSession, getFullSession, saveFullSession, saveTabContent } = require('./lib/sessionManager');
const { getSettings, saveSettings } = require('./lib/settingsManager');

// Store for temp directories per tab
const tempDirs = new Map();

// Track all open windows
const allWindows = new Set();

// Create a unique temp directory for a tab
function createTempDir(tabId) {
    const tempDir = path.join(os.tmpdir(), 'txti-editor', tabId);
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }
    tempDirs.set(tabId, tempDir);
    return tempDir;
}

// Clean up temp directory
function cleanupTempDir(tabId) {
    const tempDir = tempDirs.get(tabId);
    if (tempDir && fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
    tempDirs.delete(tabId);
}

// Helper to get window from event
function getWindowFromEvent(event) {
    return BrowserWindow.fromWebContents(event.sender);
}

// Get saved window bounds from settings
function getWindowBounds() {
    const settings = getSettings();
    return settings.windowBounds || { width: 1200, height: 800 };
}

// Save window bounds to settings
function saveWindowBounds(bounds) {
    const settings = getSettings();
    settings.windowBounds = bounds;
    saveSettings(settings);
}

function createWindow(isFirstWindow = false) {
    const bounds = getWindowBounds();

    // Calculate cascade offset for new windows
    const CASCADE_OFFSET = 30;
    let x = bounds.x;
    let y = bounds.y;

    if (!isFirstWindow && allWindows.size > 0) {
        // Offset from saved position based on window count
        const offset = allWindows.size * CASCADE_OFFSET;
        x = (bounds.x || 0) + offset;
        y = (bounds.y || 0) + offset;
    }

    const win = new BrowserWindow({
        width: bounds.width,
        height: bounds.height,
        x: x,
        y: y,
        minWidth: 360,
        minHeight: 200,
        backgroundColor: '#f3f3f3',
        frame: false,
        titleBarStyle: 'hidden',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            webSecurity: true
        }
    });

    allWindows.add(win);

    // Load with query parameter to indicate if this is first window
    win.loadFile(path.join(__dirname, 'renderer', 'index.html'), {
        query: { isFirstWindow: isFirstWindow ? '1' : '0' }
    });

    // Notify renderer of window state changes
    win.on('maximize', () => {
        win.webContents.send('window:maximized', true);
    });

    win.on('unmaximize', () => {
        win.webContents.send('window:maximized', false);
    });

    // Save window bounds on resize/move (debounced)
    let boundsTimeout;
    const saveBoundsDebounced = () => {
        clearTimeout(boundsTimeout);
        boundsTimeout = setTimeout(() => {
            if (!win.isMaximized() && !win.isMinimized()) {
                saveWindowBounds(win.getBounds());
            }
        }, 500);
    };
    win.on('resize', saveBoundsDebounced);
    win.on('move', saveBoundsDebounced);

    // Handle window close event
    win.on('close', (e) => {
        // Prevent default close - let renderer handle it
        e.preventDefault();

        const windowCount = allWindows.size;
        const isLastWindow = windowCount === 1;

        // Send close request to renderer with context
        win.webContents.send('window:close-request', { isLastWindow });
    });

    win.on('closed', () => {
        allWindows.delete(win);
    });


    // win.webContents.openDevTools(); // Uncomment to enable DevTools

    return win;
}

app.whenReady().then(() => {
    createWindow(true); // First window - will restore session

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow(true); // Restore session when reactivating with no windows
        }
    });
});

app.on('window-all-closed', () => {
    // Cleanup all temp directories
    for (const tabId of tempDirs.keys()) {
        cleanupTempDir(tabId);
    }

    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// ============== IPC HANDLERS ==============

// Native popup menu
ipcMain.handle('menu:show', (event) => {
    const win = getWindowFromEvent(event);
    if (!win) return;

    const template = [
        { label: 'New Window', accelerator: 'CmdOrCtrl+N', click: () => win.webContents.send('menu:action', 'new-window') },
        { label: 'New Tab', accelerator: 'CmdOrCtrl+T', click: () => win.webContents.send('menu:action', 'new-tab') },
        { type: 'separator' },
        { label: 'Open', accelerator: 'CmdOrCtrl+O', click: () => win.webContents.send('menu:action', 'open') },
        { label: 'Save', accelerator: 'CmdOrCtrl+S', click: () => win.webContents.send('menu:action', 'save') },
        { label: 'Save As', accelerator: 'CmdOrCtrl+Shift+S', click: () => win.webContents.send('menu:action', 'save-as') },
        { type: 'separator' },
        { label: 'Undo', accelerator: 'CmdOrCtrl+Z', click: () => win.webContents.send('menu:action', 'undo') },
        { label: 'Redo', accelerator: 'CmdOrCtrl+Y', click: () => win.webContents.send('menu:action', 'redo') },
        { type: 'separator' },
        { label: 'Close Tab', accelerator: 'CmdOrCtrl+W', click: () => win.webContents.send('menu:action', 'close-tab') },
        { type: 'separator' },
        { label: 'Settings', click: () => win.webContents.send('menu:action', 'settings') },
    ];

    const menu = Menu.buildFromTemplate(template);
    menu.popup({ window: win });
});

// Window controls
ipcMain.handle('window:minimize', (event) => {
    const win = getWindowFromEvent(event);
    if (win) win.minimize();
});

ipcMain.handle('window:maximize', (event) => {
    const win = getWindowFromEvent(event);
    if (win) {
        if (win.isMaximized()) {
            win.unmaximize();
        } else {
            win.maximize();
        }
    }
});

// Force close - called by renderer after handling dirty tabs or for session save
ipcMain.handle('window:force-close', (event) => {
    const win = getWindowFromEvent(event);
    if (win) {
        // Remove close event handler to allow actual close
        win.removeAllListeners('close');
        win.close();
    }
});

// Create a new window
ipcMain.handle('window:new', () => {
    createWindow();
});

// Get window count
ipcMain.handle('window:get-count', () => {
    return allWindows.size;
});

ipcMain.handle('window:isMaximized', (event) => {
    const win = getWindowFromEvent(event);
    return win ? win.isMaximized() : false;
});

// Show unsaved changes dialog
ipcMain.handle('dialog:unsaved-changes', async (event, filename) => {
    const win = getWindowFromEvent(event);
    const result = await dialog.showMessageBox(win, {
        type: 'question',
        buttons: ['Save', "Don't Save", 'Cancel'],
        defaultId: 0,
        cancelId: 2,
        title: 'Unsaved Changes',
        message: `Do you want to save changes to ${filename}?`,
        detail: 'Your changes will be lost if you close without saving.'
    });

    switch (result.response) {
        case 0: return 'save';
        case 1: return 'discard';
        default: return 'cancel';
    }
});

// Get session (previously opened files)
ipcMain.handle('session:get', () => {
    return getSession();
});

// Save session
ipcMain.handle('session:save', (event, filePaths) => {
    saveSession(filePaths);
    return true;
});

// Get full session (with content)
ipcMain.handle('session:get-full', () => {
    return getFullSession();
});

// Save full session (with content)
ipcMain.handle('session:save-full', (event, sessionData) => {
    saveFullSession(sessionData);
    return true;
});

// Save single tab content (for debounced auto-save)
ipcMain.handle('session:save-tab', (event, tabData) => {
    saveTabContent(tabData);
    return true;
});

// Get settings
ipcMain.handle('settings:get', () => {
    return getSettings();
});

// Save settings
ipcMain.handle('settings:save', (event, settings) => {
    return saveSettings(settings);
});

// Create new document
ipcMain.handle('file:new', (event, tabId) => {
    createTempDir(tabId);
    return createEmptyDocument();
});

// Open file dialog
ipcMain.handle('file:open-dialog', async (event) => {
    const win = getWindowFromEvent(event);
    const result = await dialog.showOpenDialog(win, {
        filters: [{ name: 'TexImg Files', extensions: ['txti'] }],
        properties: ['openFile']
    });

    if (result.canceled || result.filePaths.length === 0) {
        return null;
    }

    return result.filePaths[0];
});

// Open file (lazy - only content.json, no images)
ipcMain.handle('file:open', async (event, filePath, tabId) => {
    try {
        createTempDir(tabId);
        const { content, assetList } = await readContentJson(filePath);
        return { success: true, content, assetList, filePath };
    } catch (err) {
        return { success: false, error: err.message };
    }
});

// Load images for active tab (extract to temp)
ipcMain.handle('file:load-images', async (event, filePath, tabId) => {
    try {
        const tempDir = tempDirs.get(tabId) || createTempDir(tabId);
        const imageMap = await extractImages(filePath, tempDir);
        return { success: true, imageMap };
    } catch (err) {
        return { success: false, error: err.message };
    }
});

// Save file dialog
ipcMain.handle('file:save-dialog', async (event, defaultName) => {
    const win = getWindowFromEvent(event);
    const result = await dialog.showSaveDialog(win, {
        filters: [{ name: 'TexImg Files', extensions: ['txti'] }],
        defaultPath: defaultName || 'document.txti'
    });

    if (result.canceled) {
        return null;
    }

    return result.filePath;
});

// Save file
ipcMain.handle('file:save', async (event, { filePath, content, imageFiles }) => {
    try {
        await createZip(content, imageFiles, filePath);
        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
});

// Save As dialog (always shows dialog)
ipcMain.handle('file:save-as-dialog', async (event, currentPath) => {
    const win = getWindowFromEvent(event);
    const result = await dialog.showSaveDialog(win, {
        filters: [{ name: 'TexImg Files', extensions: ['txti'] }],
        defaultPath: currentPath || 'document.txti'
    });

    if (result.canceled) {
        return null;
    }

    return result.filePath;
});

// Handle clipboard image paste
ipcMain.handle('clipboard:paste-image', (event, tabId, imageDataUrl) => {
    try {
        const tempDir = tempDirs.get(tabId) || createTempDir(tabId);
        const filename = `${uuidv4()}.png`;
        const filePath = path.join(tempDir, filename);

        const base64Data = imageDataUrl.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        fs.writeFileSync(filePath, buffer);

        return { success: true, filename, filePath };
    } catch (err) {
        return { success: false, error: err.message };
    }
});

// Read clipboard for images (native)
ipcMain.handle('clipboard:read-image', () => {
    const image = clipboard.readImage();
    if (image.isEmpty()) {
        return null;
    }
    return image.toPNG();
});

// Save buffer to temp file
ipcMain.handle('clipboard:save-buffer', (event, tabId, buffer) => {
    try {
        const tempDir = tempDirs.get(tabId) || createTempDir(tabId);
        const filename = `${uuidv4()}.png`;
        const filePath = path.join(tempDir, filename);

        fs.writeFileSync(filePath, Buffer.from(buffer));

        return { success: true, filename, filePath };
    } catch (err) {
        return { success: false, error: err.message };
    }
});

// Close tab - cleanup temp
ipcMain.handle('tab:close', (event, tabId) => {
    cleanupTempDir(tabId);
    return true;
});

// Get temp directory for a tab
ipcMain.handle('tab:get-temp-dir', (event, tabId) => {
    return tempDirs.get(tabId) || createTempDir(tabId);
});

// Read temp images as base64 for session persistence
ipcMain.handle('tab:read-temp-images', (event, tabId, filenames) => {
    const tempDir = tempDirs.get(tabId);
    if (!tempDir) return {};

    const imageData = {};
    for (const filename of filenames) {
        const filePath = path.join(tempDir, filename);
        if (fs.existsSync(filePath)) {
            const buffer = fs.readFileSync(filePath);
            imageData[filename] = buffer.toString('base64');
        }
    }
    return imageData;
});

// Restore temp images from base64 (session restore)
ipcMain.handle('tab:restore-temp-images', (event, tabId, imageData) => {
    const tempDir = tempDirs.get(tabId) || createTempDir(tabId);
    const restoredPaths = {};

    for (const [filename, base64] of Object.entries(imageData)) {
        const filePath = path.join(tempDir, filename);
        const buffer = Buffer.from(base64, 'base64');
        fs.writeFileSync(filePath, buffer);
        restoredPaths[filename] = filePath;
    }

    return restoredPaths;
});
