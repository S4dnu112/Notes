/**
 * Integration Tests for Main Process - File Operations
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

const { readContentJson, createZip } = require('../../dist/main/lib/zipHandler');

describe('Main Process - File Operations', () => {
    let handlers;
    let mockEvent;
    let testDir;
    let testFile;

    beforeEach(() => {
        testDir = path.join(os.tmpdir(), 'txti-test-' + Date.now());
        fs.mkdirSync(testDir, { recursive: true });
        testFile = path.join(testDir, 'test.txti');

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

    describe('File IPC Handlers', () => {
        test('file:new should create empty document', async () => {
            const handler = handlers['file:new'];
            expect(handler).toBeDefined();

            const result = await handler(mockEvent, 'tab-123');
            
            expect(result).toHaveProperty('content');
            expect(Array.isArray(result.content)).toBe(true);
        });

        test('file:open should read .txti file content', async () => {
            const content = [{ type: 'text', val: 'Test content' }];
            const imageFiles = [];
            await createZip(content, imageFiles, testFile);

            const handler = handlers['file:open'];
            const result = await handler(mockEvent, testFile, 'tab-123');

            expect(result.success).toBe(true);
            expect(result.content).toEqual(content);
            expect(result.filePath).toBe(testFile);
        });

        test('file:open should handle corrupted files gracefully', async () => {
            fs.writeFileSync(testFile, 'not a valid zip file');

            const handler = handlers['file:open'];
            const result = await handler(mockEvent, testFile, 'tab-123');

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });

        test('file:save should create .txti file', async () => {
            const handler = handlers['file:save'];
            expect(handler).toBeDefined();

            const content = [
                { type: 'text', val: 'Line 1' },
                { type: 'text', val: 'Line 2' }
            ];
            const imageMap = {};
            const tempImages = {};

            const result = await handler(mockEvent, {
                filePath: testFile,
                content,
                imageMap,
                tempImages
            });

            expect(result.success).toBe(true);
            expect(fs.existsSync(testFile)).toBe(true);

            const { content: savedContent } = await readContentJson(testFile);
            expect(savedContent).toEqual(content);
        });

        test('file:save should include images in .txti', async () => {
            const handler = handlers['file:save'];

            const imagePath = path.join(testDir, 'test.png');
            fs.writeFileSync(imagePath, Buffer.from('fake png data'));

            const content = [
                { type: 'img', src: 'test.png' }
            ];
            const imageMap = { 'test.png': imagePath };
            const tempImages = {};

            const result = await handler(mockEvent, {
                filePath: testFile,
                content,
                imageMap,
                tempImages
            });

            expect(result.success).toBe(true);

            const { assetList } = await readContentJson(testFile);
            expect(assetList).toContain('test.png');
        });

        test('file:load-images should extract images from .txti', async () => {
            const imagePath = path.join(testDir, 'image.png');
            const imageData = Buffer.from('PNG data');
            fs.writeFileSync(imagePath, imageData);

            const content = [{ type: 'img', src: 'image.png' }];
            await createZip(content, { 'image.png': imagePath }, testFile);

            const handler = handlers['file:load-images'];
            const result = await handler(mockEvent, testFile, 'tab-xyz');

            expect(result.success).toBe(true);
            expect(result.imageMap).toBeDefined();
            expect(typeof result.imageMap).toBe('object');
            expect(Object.keys(result.imageMap)).toContain('image.png');
            expect(fs.existsSync(result.imageMap['image.png'])).toBe(true);
        });
    });

    describe('Error Handling', () => {
        test('should handle non-existent file paths', async () => {
            const handler = handlers['file:open'];
            const result = await handler(mockEvent, '/non/existent/path.txti', 'tab-123');

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });

        test('should handle save to invalid path', async () => {
            const handler = handlers['file:save'];
            const result = await handler(mockEvent, {
                filePath: '/invalid/readonly/path/file.txti',
                content: [],
                imageMap: {},
                tempImages: {}
            });

            expect(result.success).toBe(false);
        });
    });
});
