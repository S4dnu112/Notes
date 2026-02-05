/**
 * Integration Tests for Main Process - Window Management
 */

const path = require('path');
const fs = require('fs');
const os = require('os');
const { ipcMain, BrowserWindow } = require('electron');

const mockTmpDir = os.tmpdir();

const mockWindow = {
    loadFile: jest.fn(),
    on: jest.fn(),
    webContents: { send: jest.fn() },
    isMaximized: jest.fn(() => false),
    isMinimized: jest.fn(() => false),
    maximize: jest.fn(),
    unmaximize: jest.fn(),
    minimize: jest.fn(),
    close: jest.fn(),
    removeAllListeners: jest.fn(),
    getBounds: jest.fn(() => ({ width: 1200, height: 800, x: 0, y: 0 }))
};

jest.mock('electron', () => ({
    app: {
        getPath: jest.fn(() => mockTmpDir),
        on: jest.fn(),
        whenReady: jest.fn(() => Promise.resolve())
    },
    BrowserWindow: Object.assign(
        jest.fn().mockImplementation(() => mockWindow),
        {
            fromWebContents: jest.fn(() => mockWindow),
            getAllWindows: jest.fn(() => [mockWindow])
        }
    ),
    ipcMain: {
        handle: jest.fn(),
        on: jest.fn()
    },
    dialog: {
        showOpenDialog: jest.fn(),
        showSaveDialog: jest.fn(),
        showMessageBox: jest.fn()
    },
    nativeImage: {
        createFromBuffer: jest.fn()
    },
    clipboard: {
        readImage: jest.fn(),
        writeText: jest.fn()
    },
    Menu: {
        buildFromTemplate: jest.fn(),
        setApplicationMenu: jest.fn()
    }
}));

describe('Main Process - Window Management', () => {
    let handlers;
    let mockEvent;
    let testDir;

    beforeEach(() => {
        testDir = path.join(os.tmpdir(), 'txti-test-' + Date.now());
        fs.mkdirSync(testDir, { recursive: true });

        handlers = {};
        ipcMain.handle.mockImplementation((channel, handler) => {
            handlers[channel] = handler;
        });

        mockEvent = {
            sender: {
                getOwnerBrowserWindow: jest.fn()
            }
        };

        jest.clearAllMocks();
        jest.isolateModules(() => {
            require('../../dist/main/main.js');
        });
    });

    afterEach(() => {
        if (fs.existsSync(testDir)) {
            fs.rmSync(testDir, { recursive: true, force: true });
        }
    });

    describe('Window State Handlers', () => {
        test('window:isMaximized should return window state', async () => {
            const testWindow = {
                isMaximized: jest.fn(() => true)
            };
            BrowserWindow.fromWebContents.mockReturnValueOnce(testWindow);

            const handler = handlers['window:isMaximized'];
            const result = await handler(mockEvent);

            expect(result).toBe(true);
            expect(testWindow.isMaximized).toHaveBeenCalled();
        });

        test('window:get-count should return number of windows', async () => {
            const handler = handlers['window:get-count'];
            
            const result = await handler(mockEvent);
            
            expect(typeof result).toBe('number');
            expect(result).toBeGreaterThanOrEqual(0);
        });

        test('window:minimize should minimize window', async () => {
            const testWindow = {
                minimize: jest.fn()
            };
            BrowserWindow.fromWebContents.mockReturnValueOnce(testWindow);

            const handler = handlers['window:minimize'];
            await handler(mockEvent);

            expect(testWindow.minimize).toHaveBeenCalled();
        });

        test('window:maximize should toggle maximize state', async () => {
            const testWindow = {
                isMaximized: jest.fn(() => false),
                maximize: jest.fn(),
                unmaximize: jest.fn()
            };
            BrowserWindow.fromWebContents.mockReturnValueOnce(testWindow);

            const handler = handlers['window:maximize'];
            await handler(mockEvent);

            expect(testWindow.isMaximized).toHaveBeenCalled();
            expect(testWindow.maximize).toHaveBeenCalled();
            expect(testWindow.unmaximize).not.toHaveBeenCalled();
        });

        test('window:maximize should unmaximize when already maximized', async () => {
            const testWindow = {
                isMaximized: jest.fn(() => true),
                maximize: jest.fn(),
                unmaximize: jest.fn()
            };
            BrowserWindow.fromWebContents.mockReturnValueOnce(testWindow);

            const handler = handlers['window:maximize'];
            await handler(mockEvent);

            expect(testWindow.isMaximized).toHaveBeenCalled();
            expect(testWindow.unmaximize).toHaveBeenCalled();
            expect(testWindow.maximize).not.toHaveBeenCalled();
        });

        test('window:force-close should remove listeners and close window', async () => {
            const testWindow = {
                removeAllListeners: jest.fn(),
                close: jest.fn()
            };
            BrowserWindow.fromWebContents.mockReturnValueOnce(testWindow);

            const handler = handlers['window:force-close'];
            await handler(mockEvent);

            expect(testWindow.removeAllListeners).toHaveBeenCalledWith('close');
            expect(testWindow.close).toHaveBeenCalled();
        });

        test('window:new should create a new window', async () => {
            BrowserWindow.mockClear();

            const handler = handlers['window:new'];
            await handler(mockEvent);

            expect(BrowserWindow).toHaveBeenCalled();
        });
    });

    describe('Window Creation', () => {
        test('should create window with correct configuration', async () => {
            BrowserWindow.mockClear();
            
            const handler = handlers['window:new'];
            await handler(mockEvent);

            expect(BrowserWindow).toHaveBeenCalledWith(
                expect.objectContaining({
                    minWidth: 360,
                    minHeight: 200,
                    backgroundColor: '#f3f3f3',
                    frame: false,
                    titleBarStyle: 'hidden',
                    webPreferences: expect.objectContaining({
                        contextIsolation: true,
                        nodeIntegration: false,
                        webSecurity: true
                    })
                })
            );
        });

        test('should load renderer with correct file', async () => {
            mockWindow.loadFile.mockClear();
            
            const handler = handlers['window:new'];
            await handler(mockEvent);

            expect(mockWindow.loadFile).toHaveBeenCalledWith(
                expect.stringContaining('index.html'),
                expect.anything()
            );
        });
    });

    describe('Window Bounds Persistence', () => {
        const { getSettings, saveSettings } = require('../../dist/main/lib/settingsManager');

        test('should save window bounds to settings', async () => {
            const testBounds = {
                width: 1024,
                height: 768,
                x: 100,
                y: 100
            };

            const mockWin = {
                loadFile: jest.fn(),
                on: jest.fn(),
                webContents: { send: jest.fn() },
                getBounds: jest.fn(() => testBounds),
                isMaximized: jest.fn(() => false),
                isMinimized: jest.fn(() => false)
            };
            BrowserWindow.mockImplementation(() => mockWin);

            const handler = handlers['window:new'];
            await handler(mockEvent);

            const resizeCallback = mockWin.on.mock.calls.find(call => call[0] === 'resize')?.[1];
            if (resizeCallback) {
                resizeCallback();
                
                await new Promise(resolve => setTimeout(resolve, 600));
                
                const settings = getSettings();
                expect(settings.windowBounds).toBeDefined();
            }
        });

        test('should use default bounds when no saved bounds exist', () => {
            saveSettings({ windowBounds: undefined });

            BrowserWindow.mockClear();
            
            const handler = handlers['window:new'];
            handler(mockEvent);

            expect(BrowserWindow).toHaveBeenCalledWith(
                expect.objectContaining({
                    width: 1200,
                    height: 800
                })
            );
        });

        test('should restore saved window bounds on creation', () => {
            const savedBounds = {
                width: 1440,
                height: 900,
                x: 200,
                y: 150
            };
            saveSettings({ windowBounds: savedBounds });

            BrowserWindow.mockClear();
            
            const handler = handlers['window:new'];
            handler(mockEvent);

            const lastCall = BrowserWindow.mock.calls[BrowserWindow.mock.calls.length - 1];
            expect(lastCall[0]).toMatchObject({
                width: savedBounds.width,
                height: savedBounds.height
            });
        });

        test('should not save bounds when window is maximized', async () => {
            const currentSettings = getSettings();
            const initialBounds = currentSettings.windowBounds;

            const mockWin = {
                loadFile: jest.fn(),
                on: jest.fn(),
                webContents: { send: jest.fn() },
                getBounds: jest.fn(() => ({ width: 999, height: 999 })),
                isMaximized: jest.fn(() => true),
                isMinimized: jest.fn(() => false)
            };
            BrowserWindow.mockImplementation(() => mockWin);

            const handler = handlers['window:new'];
            await handler(mockEvent);

            const resizeCallback = mockWin.on.mock.calls.find(call => call[0] === 'resize')?.[1];
            if (resizeCallback) {
                resizeCallback();
                await new Promise(resolve => setTimeout(resolve, 600));
                
                const settings = getSettings();
                expect(settings.windowBounds).toEqual(initialBounds);
            }
        });

        test('should not save bounds when window is minimized', async () => {
            const currentSettings = getSettings();
            const initialBounds = currentSettings.windowBounds;

            const mockWin = {
                loadFile: jest.fn(),
                on: jest.fn(),
                webContents: { send: jest.fn() },
                getBounds: jest.fn(() => ({ width: 999, height: 999 })),
                isMaximized: jest.fn(() => false),
                isMinimized: jest.fn(() => true)
            };
            BrowserWindow.mockImplementation(() => mockWin);

            const handler = handlers['window:new'];
            await handler(mockEvent);

            const resizeCallback = mockWin.on.mock.calls.find(call => call[0] === 'resize')?.[1];
            if (resizeCallback) {
                resizeCallback();
                await new Promise(resolve => setTimeout(resolve, 600));
                
                const settings = getSettings();
                expect(settings.windowBounds).toEqual(initialBounds);
            }
        });
    });
});
