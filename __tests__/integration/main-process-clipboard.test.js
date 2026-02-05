/**
 * Integration Tests for Main Process - Clipboard Operations
 */

const path = require('path');
const fs = require('fs');
const os = require('os');
const { ipcMain, clipboard } = require('electron');

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

describe('Main Process - Clipboard Operations', () => {
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

    describe('Clipboard IPC Handlers', () => {
        test('clipboard:paste-image should save image data', async () => {
            const handler = handlers['clipboard:paste-image'];
            expect(handler).toBeDefined();

            const base64Image = 'data:image/png;base64,iVBORw0KGgoAAAANS';
            const result = await handler(mockEvent, 'tab-123', base64Image);

            expect(result.success).toBe(true);
            expect(result.filename).toMatch(/\.png$/);
            expect(result.filePath).toBeDefined();
        });

        test('clipboard:read-image should return PNG buffer', async () => {
            const mockPNG = Buffer.from('PNG data');
            clipboard.readImage.mockReturnValue({
                isEmpty: () => false,
                toPNG: () => mockPNG
            });

            const handler = handlers['clipboard:read-image'];
            const result = await handler(mockEvent);

            expect(result).toEqual(mockPNG);
        });

        test('clipboard:read-image should return null for empty clipboard', async () => {
            clipboard.readImage.mockReturnValue({
                isEmpty: () => true
            });

            const handler = handlers['clipboard:read-image'];
            const result = await handler(mockEvent);

            expect(result).toBeNull();
        });

        test('clipboard:save-buffer should save buffer to temp file', async () => {
            const handler = handlers['clipboard:save-buffer'];
            const buffer = Buffer.from('Image data');

            const result = await handler(mockEvent, 'tab-456', buffer);

            expect(result.success).toBe(true);
            expect(result.filename).toMatch(/\.png$/);
            expect(fs.existsSync(result.filePath)).toBe(true);
        });
    });
});
