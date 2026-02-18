import { app, BrowserWindow, ipcMain, dialog, clipboard, nativeImage, Menu, IpcMainInvokeEvent, MessageBoxReturnValue } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';

import { readContentJson, extractImages, createZip, createEmptyDocument } from './lib/zipHandler';
import { getSession, saveSession, getFullSession, saveFullSession, saveTabContent } from './lib/sessionManager';
import { getSettings, saveSettings } from './lib/settingsManager';
import { SessionData, EditorSettings } from '../types/index';

interface WindowBounds {
    width: number;
    height: number;
    x?: number;
    y?: number;
}

interface SaveFileParams {
    tabId: string;
    filePath: string;
    content: any[];
    imageMap: Record<string, string>;
    tempImages: Record<string, string>;
}

interface CloseRequestContext {
    isLastWindow: boolean;
}

// Store for temp directories per tab
const tempDirs = new Map<string, string>();

// Track all open windows
const allWindows = new Set<BrowserWindow>();

// Create a unique temp directory for a tab
function createTempDir(tabId: string): string {
    const tempDir = path.join(os.tmpdir(), 'txti-editor', tabId);
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }
    tempDirs.set(tabId, tempDir);
    return tempDir;
}

// Clean up temp directory
function cleanupTempDir(tabId: string): void {
    const tempDir = tempDirs.get(tabId);
    if (tempDir && fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
    tempDirs.delete(tabId);
}

// Helper to get window from event
function getWindowFromEvent(event: IpcMainInvokeEvent): BrowserWindow | null {
    return BrowserWindow.fromWebContents(event.sender);
}

// Get saved window bounds from settings
function getWindowBounds(): WindowBounds {
    const settings = getSettings();
    return settings.windowBounds || { width: 1200, height: 800 };
}

// Save window bounds to settings
function saveWindowBounds(bounds: WindowBounds): void {
    const settings = getSettings();
    settings.windowBounds = bounds;
    saveSettings(settings);
}

function createWindow(isFirstWindow: boolean = false): BrowserWindow {
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
    win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'), {
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
    let boundsTimeout: NodeJS.Timeout | undefined;
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
        const context: CloseRequestContext = { isLastWindow };
        win.webContents.send('window:close-request', context);
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
ipcMain.handle('menu:show', (event: IpcMainInvokeEvent) => {
    const win = getWindowFromEvent(event);
    if (!win) return;

    const template: Electron.MenuItemConstructorOptions[] = [
        { label: 'New Window', accelerator: 'CmdOrCtrl+N', click: () => win.webContents.send('menu:action', 'new-window') },
        { label: 'Open', accelerator: 'CmdOrCtrl+O', click: () => win.webContents.send('menu:action', 'open') },
        { type: 'separator' },
        { label: 'Save', accelerator: 'CmdOrCtrl+S', click: () => win.webContents.send('menu:action', 'save') },
        { label: 'Save As', accelerator: 'CmdOrCtrl+Shift+S', click: () => win.webContents.send('menu:action', 'save-as') },
        { type: 'separator' },
        { label: 'Preferences', click: () => win.webContents.send('menu:action', 'preferences') },
    ];

    const menu = Menu.buildFromTemplate(template);
    menu.popup({ window: win });
});

// Window controls
ipcMain.handle('window:minimize', (event: IpcMainInvokeEvent) => {
    const win = getWindowFromEvent(event);
    if (win) win.minimize();
});

ipcMain.handle('window:maximize', (event: IpcMainInvokeEvent) => {
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
ipcMain.handle('window:force-close', (event: IpcMainInvokeEvent) => {
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

// Open keyboard shortcuts window
ipcMain.handle('window:keyboard-shortcuts', () => {
    const shortcutsWindow = new BrowserWindow({
        width: 800,
        height: 700,
        minWidth: 600,
        minHeight: 500,
        backgroundColor: '#ffffff',
        frame: false,
        titleBarStyle: 'hidden',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
        }
    });

    shortcutsWindow.loadFile(path.join(__dirname, '../renderer/keyboard-shortcuts.html'));
});

// Open preferences window
let preferencesWindow: BrowserWindow | null = null;

ipcMain.handle('window:preferences', () => {
    // If already open, focus it
    if (preferencesWindow && !preferencesWindow.isDestroyed()) {
        preferencesWindow.focus();
        return;
    }

    preferencesWindow = new BrowserWindow({
        width: 900,
        height: 650,
        minWidth: 700,
        minHeight: 500,
        backgroundColor: '#ffffff',
        frame: false,
        titleBarStyle: 'hidden',
        webPreferences: {
            preload: path.join(__dirname, 'preload-preferences.js'),
            nodeIntegration: false,
            contextIsolation: true,
        }
    });

    preferencesWindow.loadFile(path.join(__dirname, '../renderer/preferences.html'));
    preferencesWindow.on('closed', () => {
        preferencesWindow = null;
    });
});

// Get window count
ipcMain.handle('window:get-count', () => {
    return allWindows.size;
});

ipcMain.handle('window:isMaximized', (event: IpcMainInvokeEvent) => {
    const win = getWindowFromEvent(event);
    return win ? win.isMaximized() : false;
});

// Show unsaved changes dialog
ipcMain.handle('dialog:unsaved-changes', async (event: IpcMainInvokeEvent, filename: string) => {
    const win = getWindowFromEvent(event);
    const result: MessageBoxReturnValue = await dialog.showMessageBox(win!, {
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

// Show multi-file unsaved changes dialog
ipcMain.handle('dialog:unsaved-changes-multiple', async (event: IpcMainInvokeEvent, filenames: string[]) => {
    const win = getWindowFromEvent(event);
    const fileCount = filenames.length;
    const fileList = filenames.join('\n');

    const result: MessageBoxReturnValue = await dialog.showMessageBox(win!, {
        type: 'question',
        buttons: ['Save All', "Don't Save", 'Cancel'],
        defaultId: 0,
        cancelId: 2,
        title: 'Visual Studio Code',
        message: `Do you want to save the changes to the following ${fileCount} file${fileCount > 1 ? 's' : ''}?`,
        detail: `${fileList}\n\nYour changes will be lost if you don't save them.`
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
ipcMain.handle('session:save', (_event: IpcMainInvokeEvent, filePaths: string[]) => {
    saveSession(filePaths);
    return true;
});

// Get full session (with content)
ipcMain.handle('session:get-full', () => {
    return getFullSession();
});

// Save full session (with content)
ipcMain.handle('session:save-full', (_event: IpcMainInvokeEvent, sessionData: SessionData) => {
    saveFullSession(sessionData);
    return true;
});

// Save single tab content (for debounced auto-save)
ipcMain.handle('session:save-tab', (_event: IpcMainInvokeEvent, tabData: any) => {
    saveTabContent(tabData);
    return true;
});

// Get settings
ipcMain.handle('settings:get', () => {
    return getSettings();
});

// Save settings
ipcMain.handle('settings:save', (_event: IpcMainInvokeEvent, settings: EditorSettings) => {
    const result = saveSettings(settings);
    // Broadcast to all editor windows so they reload settings
    for (const win of allWindows) {
        win.webContents.send('settings:changed');
    }
    return result;
});

// Close preferences window
ipcMain.handle('preferences:close', (event: IpcMainInvokeEvent) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) win.close();
});

// Create new document
ipcMain.handle('file:new', (_event: IpcMainInvokeEvent, tabId: string) => {
    createTempDir(tabId);
    return createEmptyDocument();
});

// Open file dialog
ipcMain.handle('file:open-dialog', async (event: IpcMainInvokeEvent) => {
    const win = getWindowFromEvent(event);
    const result = await dialog.showOpenDialog(win!, {
        filters: [{ name: 'TextImg Files', extensions: ['txti'] }],
        properties: ['openFile']
    });

    if (result.canceled || result.filePaths.length === 0) {
        return null;
    }

    return result.filePaths[0];
});

// Open file (lazy - only content.json, no images)
ipcMain.handle('file:open', async (_event: IpcMainInvokeEvent, filePath: string, tabId: string) => {
    try {
        createTempDir(tabId);
        const { content, assetList } = await readContentJson(filePath);
        return { success: true, content, assetList, filePath };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
});

// Load images for active tab (extract to temp)
ipcMain.handle('file:load-images', async (_event: IpcMainInvokeEvent, filePath: string, tabId: string) => {
    try {
        const tempDir = tempDirs.get(tabId) || createTempDir(tabId);
        const imageMap = await extractImages(filePath, tempDir);
        return { success: true, imageMap };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
});

// Save file dialog
ipcMain.handle('file:save-dialog', async (event: IpcMainInvokeEvent, defaultName: string) => {
    const win = getWindowFromEvent(event);
    const result = await dialog.showSaveDialog(win!, {
        filters: [{ name: 'TextImg Files', extensions: ['txti'] }],
        defaultPath: defaultName || 'document.txti'
    });

    if (result.canceled) {
        return null;
    }

    return result.filePath;
});

// Save file
ipcMain.handle('file:save', async (_event: IpcMainInvokeEvent, { filePath, content, imageMap, tempImages }: SaveFileParams) => {
    try {
        // Merge imageMap (existing images) and tempImages (newly added) for saving
        const allImages = { ...imageMap, ...tempImages };
        await createZip(content, allImages, filePath);
        return { success: true };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
});

// Save As dialog (always shows dialog)
ipcMain.handle('file:save-as-dialog', async (event: IpcMainInvokeEvent, currentPath: string) => {
    const win = getWindowFromEvent(event);
    const result = await dialog.showSaveDialog(win!, {
        filters: [{ name: 'TextImg Files', extensions: ['txti'] }],
        defaultPath: currentPath || 'document.txti'
    });

    if (result.canceled) {
        return null;
    }

    return result.filePath;
});

// Handle clipboard image paste
ipcMain.handle('clipboard:paste-image', (_event: IpcMainInvokeEvent, tabId: string, imageDataUrl: string) => {
    try {
        const tempDir = tempDirs.get(tabId) || createTempDir(tabId);
        const filename = `${uuidv4()}.png`;
        const filePath = path.join(tempDir, filename);

        const base64Data = imageDataUrl.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        fs.writeFileSync(filePath, buffer);

        return { success: true, filename, filePath };
    } catch (err: any) {
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

// Write image file to clipboard
ipcMain.handle('clipboard:write-image', (_event: IpcMainInvokeEvent, filePath: string) => {
    try {
        const image = nativeImage.createFromPath(filePath);
        if (image.isEmpty()) {
            return { success: false, error: 'Could not load image from path' };
        }
        clipboard.writeImage(image);
        return { success: true };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
});

// Save buffer to temp file
ipcMain.handle('clipboard:save-buffer', (_event: IpcMainInvokeEvent, tabId: string, buffer: Buffer) => {
    try {
        const tempDir = tempDirs.get(tabId) || createTempDir(tabId);
        const filename = `${uuidv4()}.png`;
        const filePath = path.join(tempDir, filename);

        fs.writeFileSync(filePath, Buffer.from(buffer));

        return { success: true, filename, filePath };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
});

// Close tab - cleanup temp
ipcMain.handle('tab:close', (_event: IpcMainInvokeEvent, tabId: string) => {
    cleanupTempDir(tabId);
    return true;
});

// Get temp directory for a tab
ipcMain.handle('tab:get-temp-dir', (_event: IpcMainInvokeEvent, tabId: string) => {
    return tempDirs.get(tabId) || createTempDir(tabId);
});

// Read temp images as base64 for session persistence
ipcMain.handle('tab:read-temp-images', (_event: IpcMainInvokeEvent, tabId: string, filenames: string[]) => {
    const tempDir = tempDirs.get(tabId);
    if (!tempDir) return {};

    const imageData: Record<string, string> = {};
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
ipcMain.handle('tab:restore-temp-images', (_event: IpcMainInvokeEvent, tabId: string, imageData: Record<string, string>) => {
    const tempDir = tempDirs.get(tabId) || createTempDir(tabId);
    const restoredPaths: Record<string, string> = {};

    for (const [filename, base64] of Object.entries(imageData)) {
        const filePath = path.join(tempDir, filename);
        const buffer = Buffer.from(base64, 'base64');
        fs.writeFileSync(filePath, buffer);
        restoredPaths[filename] = filePath;
    }

    return restoredPaths;
});
