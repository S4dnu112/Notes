/**
 * Integration Tests for Main Process - Settings Management
 */

const path = require('path');
const fs = require('fs');
const os = require('os');
const { ipcMain } = require('electron');

const mockTmpDir = os.tmpdir();

jest.mock('electron', () => ({
    app: {
        getPath: jest.fn(() => mockTmpDir),
        on: jest.fn(),
        whenReady: jest.fn(() => Promise.resolve())
    },
    BrowserWindow: Object.assign(
        jest.fn().mockImplementation(() => ({
            loadFile: jest.fn(),
            on: jest.fn(),
            webContents: { send: jest.fn() }
        })),
        {
            fromWebContents: jest.fn(() => ({}))
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

const { getSettings, saveSettings } = require('../../dist/main/lib/settingsManager');

describe('Main Process - Settings Management', () => {
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
    });

    afterEach(() => {
        if (fs.existsSync(testDir)) {
            fs.rmSync(testDir, { recursive: true, force: true });
        }
    });

    describe('Settings IPC Handlers', () => {
        beforeEach(() => {
            jest.isolateModules(() => {
                require('../../dist/main/main.js');
            });
        });

        test('settings:get should return current settings', async () => {
            const handler = handlers['settings:get'];
            expect(handler).toBeDefined();

            const result = await handler(mockEvent);
            
            expect(result).toHaveProperty('wordWrap');
            expect(result).toHaveProperty('autoIndent');
            expect(result).toHaveProperty('tabSize');
            expect(result).toHaveProperty('indentSize');
        });

        test('settings:save should persist settings', async () => {
            const handler = handlers['settings:save'];
            expect(handler).toBeDefined();

            const newSettings = {
                wordWrap: false,
                autoIndent: false,
                tabSize: 4,
                indentSize: 4,
                lineFeed: 'CRLF'
            };

            const result = await handler(mockEvent, newSettings);
            expect(result).toBe(true);

            const saved = getSettings();
            expect(saved.wordWrap).toBe(false);
            expect(saved.tabSize).toBe(4);
            expect(saved.lineFeed).toBe('CRLF');
        });

        test('settings:save should merge with defaults', async () => {
            const handler = handlers['settings:save'];

            const partialSettings = {
                wordWrap: false
            };

            await handler(mockEvent, partialSettings);

            const saved = getSettings();
            expect(saved.wordWrap).toBe(false);
            expect(saved).toHaveProperty('autoIndent');
            expect(saved).toHaveProperty('tabSize');
        });
    });

    describe('Settings Persistence', () => {
        test('should persist settings across multiple updates', () => {
            saveSettings({ tabSize: 2 });
            let settings = getSettings();
            expect(settings.tabSize).toBe(2);

            saveSettings({ tabSize: 8, wordWrap: true });
            settings = getSettings();
            expect(settings.tabSize).toBe(8);
            expect(settings.wordWrap).toBe(true);

            saveSettings({ lineFeed: 'LF' });
            settings = getSettings();
            expect(settings.tabSize).toBe(8);
            expect(settings.lineFeed).toBe('LF');
        });

        test('should handle custom window bounds', () => {
            const bounds = {
                width: 1440,
                height: 900,
                x: 200,
                y: 150
            };
            
            saveSettings({ windowBounds: bounds });
            const settings = getSettings();
            
            expect(settings.windowBounds).toEqual(bounds);
        });
    });
});
