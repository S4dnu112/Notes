/**
 * Integration Tests for Main Process - Tab Management
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

describe('Main Process - Tab Management', () => {
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

    describe('Tab Cleanup Handlers', () => {
        test('tab:close should cleanup temp directory', async () => {
            const tabId = 'test-tab-cleanup';
            
            const getTempHandler = handlers['tab:get-temp-dir'];
            const tempDir = await getTempHandler(mockEvent, tabId);
            expect(fs.existsSync(tempDir)).toBe(true);

            const closeHandler = handlers['tab:close'];
            const result = await closeHandler(mockEvent, tabId);

            expect(result).toBe(true);
            expect(fs.existsSync(tempDir)).toBe(false);
        });

        test('tab:get-temp-dir should return existing temp directory', async () => {
            const tabId = 'test-tab-existing';
            const handler = handlers['tab:get-temp-dir'];
            
            const tempDir1 = await handler(mockEvent, tabId);
            const tempDir2 = await handler(mockEvent, tabId);

            expect(tempDir1).toBe(tempDir2);
            expect(fs.existsSync(tempDir1)).toBe(true);
        });

        test('tab:get-temp-dir should create new temp directory if not exists', async () => {
            const tabId = 'test-tab-new-' + Date.now();
            const handler = handlers['tab:get-temp-dir'];
            
            const tempDir = await handler(mockEvent, tabId);

            expect(tempDir).toContain(tabId);
            expect(fs.existsSync(tempDir)).toBe(true);
        });

        test('tab:read-temp-images should read images as base64', async () => {
            const tabId = 'test-tab-read';
            
            const getTempHandler = handlers['tab:get-temp-dir'];
            const tempDir = await getTempHandler(mockEvent, tabId);
            
            const testImagePath = path.join(tempDir, 'test-image.png');
            const testData = Buffer.from('fake image data');
            fs.writeFileSync(testImagePath, testData);

            const readHandler = handlers['tab:read-temp-images'];
            const result = await readHandler(mockEvent, tabId, ['test-image.png']);

            expect(Object.keys(result)).toContain('test-image.png');
            expect(result['test-image.png']).toBe(testData.toString('base64'));
        });

        test('tab:read-temp-images should return empty object for non-existent tab', async () => {
            const handler = handlers['tab:read-temp-images'];
            const result = await handler(mockEvent, 'non-existent-tab', ['image.png']);

            expect(result).toEqual({});
        });

        test('tab:read-temp-images should skip missing files', async () => {
            const tabId = 'test-tab-partial';
            
            const getTempHandler = handlers['tab:get-temp-dir'];
            const tempDir = await getTempHandler(mockEvent, tabId);
            
            const testImagePath = path.join(tempDir, 'exists.png');
            fs.writeFileSync(testImagePath, Buffer.from('data'));

            const readHandler = handlers['tab:read-temp-images'];
            const result = await readHandler(mockEvent, tabId, ['exists.png', 'missing.png']);

            expect(Object.keys(result)).toContain('exists.png');
            expect(Object.keys(result)).not.toContain('missing.png');
        });

        test('tab:restore-temp-images should restore images from base64', async () => {
            const tabId = 'test-tab-restore';
            const testData = Buffer.from('restored image data');
            const base64Data = testData.toString('base64');

            const handler = handlers['tab:restore-temp-images'];
            const result = await handler(mockEvent, tabId, {
                'restored.png': base64Data
            });

            expect(Object.keys(result)).toContain('restored.png');
            expect(fs.existsSync(result['restored.png'])).toBe(true);
            
            const restoredData = fs.readFileSync(result['restored.png']);
            expect(restoredData.toString()).toBe(testData.toString());
        });

        test('tab:restore-temp-images should create temp dir if not exists', async () => {
            const tabId = 'test-tab-restore-new-' + Date.now();
            const base64Data = Buffer.from('data').toString('base64');

            const handler = handlers['tab:restore-temp-images'];
            const result = await handler(mockEvent, tabId, {
                'image.png': base64Data
            });

            expect(Object.keys(result)).toContain('image.png');
            expect(fs.existsSync(result['image.png'])).toBe(true);
        });

        test('tab:restore-temp-images should handle multiple images', async () => {
            const tabId = 'test-tab-restore-multiple';
            const imageData = {
                'image1.png': Buffer.from('data1').toString('base64'),
                'image2.jpg': Buffer.from('data2').toString('base64'),
                'image3.gif': Buffer.from('data3').toString('base64')
            };

            const handler = handlers['tab:restore-temp-images'];
            const result = await handler(mockEvent, tabId, imageData);

            expect(Object.keys(result)).toHaveLength(3);
            expect(Object.keys(result)).toContain('image1.png');
            expect(Object.keys(result)).toContain('image2.jpg');
            expect(Object.keys(result)).toContain('image3.gif');
            
            Object.values(result).forEach(filePath => {
                expect(fs.existsSync(filePath)).toBe(true);
            });
        });
    });
});
