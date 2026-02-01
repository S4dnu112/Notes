/**
 * Integration Tests for Main Process IPC Handlers
 * Tests main.js IPC handlers with real module integration
 */

const path = require('path');
const fs = require('fs');
const os = require('os');
const { ipcMain } = require('electron');

// Store os.tmpdir() before mocking to avoid scope issues
const mockTmpDir = os.tmpdir();

// Create a mock window instance
const mockWindow = {
    loadFile: jest.fn(),
    on: jest.fn(),
    webContents: {
        send: jest.fn()
    },
    isMaximized: jest.fn(() => false),
    maximize: jest.fn(),
    unmaximize: jest.fn(),
    minimize: jest.fn(),
    close: jest.fn(),
    removeAllListeners: jest.fn()
};

// Mock electron modules
jest.mock('electron', () => ({
    app: {
        getPath: jest.fn(() => mockTmpDir),
        on: jest.fn(),
        whenReady: jest.fn(() => Promise.resolve())
    },
    BrowserWindow: Object.assign(
        jest.fn().mockImplementation(() => mockWindow),
        {
            fromWebContents: jest.fn(() => mockWindow)
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

const { getSession, saveSession, getFullSession, saveFullSession, saveTabContent } = require('../../dist/lib/sessionManager');
const { getSettings, saveSettings } = require('../../dist/lib/settingsManager');
const { readContentJson, extractImages, createZip, createEmptyDocument } = require('../../dist/lib/zipHandler');

describe('Main Process - IPC Integration Tests', () => {
    let handlers;
    let mockEvent;
    let testDir;

    beforeEach(() => {
        // Setup test directory
        testDir = path.join(os.tmpdir(), 'txti-test-' + Date.now());
        fs.mkdirSync(testDir, { recursive: true });

        // Collect registered IPC handlers
        handlers = {};
        ipcMain.handle.mockImplementation((channel, handler) => {
            handlers[channel] = handler;
        });

        // Mock event object
        mockEvent = {
            sender: {
                getOwnerBrowserWindow: jest.fn()
            }
        };

        // Clear mocks
        jest.clearAllMocks();
    });

    afterEach(() => {
        // Cleanup test directory
        if (fs.existsSync(testDir)) {
            fs.rmSync(testDir, { recursive: true, force: true });
        }
    });

    describe('Session Management IPC Handlers', () => {
        beforeEach(() => {
            // Load main.js to register handlers
            jest.isolateModules(() => {
                require('../../main.js');
            });
        });

        test('session:get should return session data', async () => {
            // Create test session
            const testPaths = ['/path/to/file1.txti', '/path/to/file2.txti'];
            saveSession(testPaths);

            const handler = handlers['session:get'];
            expect(handler).toBeDefined();

            const result = await handler(mockEvent);
            expect(result).toEqual(testPaths);
        });

        test('session:save should persist file paths', async () => {
            const handler = handlers['session:save'];
            expect(handler).toBeDefined();

            const testPaths = ['/new/path1.txti', '/new/path2.txti'];
            const result = await handler(mockEvent, testPaths);

            expect(result).toBe(true);
            
            // Verify persistence
            const saved = getSession();
            expect(saved).toEqual(testPaths);
        });

        test('session:get-full should return complete session with tabs', async () => {
            // Setup full session data
            const sessionData = {
                tabs: [
                    {
                        id: 'tab1',
                        filePath: '/path/to/doc.txti',
                        content: [{ type: 'text', val: 'Test' }],
                        modified: false
                    }
                ],
                activeTabId: 'tab1'
            };
            saveFullSession(sessionData);

            const handler = handlers['session:get-full'];
            expect(handler).toBeDefined();

            const result = await handler(mockEvent);
            expect(result).toMatchObject(sessionData);
        });

        test('session:save-full should persist complete session', async () => {
            const handler = handlers['session:save-full'];
            expect(handler).toBeDefined();

            const sessionData = {
                tabs: [
                    {
                        id: 'tab1',
                        filePath: null,
                        content: [{ type: 'text', val: 'Content' }],
                        modified: true
                    },
                    {
                        id: 'tab2',
                        filePath: '/path/file.txti',
                        content: [],
                        modified: false
                    }
                ],
                activeTabId: 'tab2'
            };

            const result = await handler(mockEvent, sessionData);
            expect(result).toBe(true);

            // Verify persistence
            const saved = getFullSession();
            expect(saved).toMatchObject(sessionData);
        });

        test('session:save-tab should save individual tab content', async () => {
            // Setup initial session
            saveFullSession({
                tabs: [{ id: 'tab1', content: [], modified: false }],
                activeTabId: 'tab1'
            });

            const handler = handlers['session:save-tab'];
            expect(handler).toBeDefined();

            const tabData = {
                id: 'tab1',
                content: [{ type: 'text', val: 'Updated' }],
                modified: true
            };

            const result = await handler(mockEvent, tabData);
            expect(result).toBe(true);

            // Verify tab was updated
            const session = getFullSession();
            const tab = session.tabs.find(t => t.id === 'tab1');
            expect(tab.content).toEqual(tabData.content);
            expect(tab.modified).toBe(true);
        });
    });

    describe('Settings Management IPC Handlers', () => {
        beforeEach(() => {
            jest.isolateModules(() => {
                require('../../main.js');
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

            // Verify persistence
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
            expect(saved).toHaveProperty('autoIndent'); // Other defaults preserved
            expect(saved).toHaveProperty('tabSize');
        });
    });

    describe('File Operations IPC Handlers', () => {
        let testFile;

        beforeEach(() => {
            jest.isolateModules(() => {
                require('../../main.js');
            });

            testFile = path.join(testDir, 'test.txti');
        });

        test('file:new should create empty document', async () => {
            const handler = handlers['file:new'];
            expect(handler).toBeDefined();

            const result = await handler(mockEvent, 'tab-123');
            
            expect(result).toHaveProperty('content');
            expect(Array.isArray(result.content)).toBe(true);
        });

        test('file:open should read .txti file content', async () => {
            // Create test .txti file
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
            // Create corrupted file
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
            const imageFiles = [];

            const result = await handler(mockEvent, {
                filePath: testFile,
                content,
                imageFiles
            });

            expect(result.success).toBe(true);
            expect(fs.existsSync(testFile)).toBe(true);

            // Verify content
            const { content: savedContent } = await readContentJson(testFile);
            expect(savedContent).toEqual(content);
        });

        test('file:save should include images in .txti', async () => {
            const handler = handlers['file:save'];

            // Create test image
            const imagePath = path.join(testDir, 'test.png');
            fs.writeFileSync(imagePath, Buffer.from('fake png data'));

            const content = [
                { type: 'img', src: 'test.png' }
            ];
            const imageFiles = [imagePath];

            const result = await handler(mockEvent, {
                filePath: testFile,
                content,
                imageFiles
            });

            expect(result.success).toBe(true);

            // Verify image in archive
            const { assetList } = await readContentJson(testFile);
            expect(assetList).toContain('test.png');
        });

        test('file:load-images should extract images from .txti', async () => {
            // Create .txti with image
            const imagePath = path.join(testDir, 'image.png');
            const imageData = Buffer.from('PNG data');
            fs.writeFileSync(imagePath, imageData);

            const content = [{ type: 'img', src: 'image.png' }];
            await createZip(content, [imagePath], testFile);

            const handler = handlers['file:load-images'];
            const result = await handler(mockEvent, testFile, 'tab-xyz');

            expect(result.success).toBe(true);
            expect(result.imageMap).toHaveProperty('image.png');
            expect(fs.existsSync(result.imageMap['image.png'])).toBe(true);
        });
    });

    describe('Dialog IPC Handlers', () => {
        const { dialog } = require('electron');

        beforeEach(() => {
            jest.isolateModules(() => {
                require('../../main.js');
            });
        });

        test('dialog:unsaved-changes should show confirmation dialog', async () => {
            dialog.showMessageBox.mockResolvedValue({ response: 0 }); // Save

            const handler = handlers['dialog:unsaved-changes'];
            const result = await handler(mockEvent, 'document.txti');

            expect(result).toBe('save');
            expect(dialog.showMessageBox).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    type: 'question',
                    message: expect.stringContaining('document.txti')
                })
            );
        });

        test('dialog:unsaved-changes should handle discard option', async () => {
            dialog.showMessageBox.mockResolvedValue({ response: 1 }); // Don't Save

            const handler = handlers['dialog:unsaved-changes'];
            const result = await handler(mockEvent, 'test.txti');

            expect(result).toBe('discard');
        });

        test('dialog:unsaved-changes should handle cancel option', async () => {
            dialog.showMessageBox.mockResolvedValue({ response: 2 }); // Cancel

            const handler = handlers['dialog:unsaved-changes'];
            const result = await handler(mockEvent, 'test.txti');

            expect(result).toBe('cancel');
        });

        test('file:open-dialog should return selected file path', async () => {
            const selectedPath = '/user/selected/file.txti';
            dialog.showOpenDialog.mockResolvedValue({
                canceled: false,
                filePaths: [selectedPath]
            });

            const handler = handlers['file:open-dialog'];
            const result = await handler(mockEvent);

            expect(result).toBe(selectedPath);
            expect(dialog.showOpenDialog).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    filters: expect.arrayContaining([
                        expect.objectContaining({ extensions: ['txti'] })
                    ])
                })
            );
        });

        test('file:open-dialog should return null when canceled', async () => {
            dialog.showOpenDialog.mockResolvedValue({
                canceled: true,
                filePaths: []
            });

            const handler = handlers['file:open-dialog'];
            const result = await handler(mockEvent);

            expect(result).toBeNull();
        });

        test('file:save-dialog should return save path', async () => {
            const savePath = '/user/save/doc.txti';
            dialog.showSaveDialog.mockResolvedValue({
                canceled: false,
                filePath: savePath
            });

            const handler = handlers['file:save-dialog'];
            const result = await handler(mockEvent, 'doc.txti');

            expect(result).toBe(savePath);
        });

        test('file:save-dialog should use default name', async () => {
            dialog.showSaveDialog.mockResolvedValue({
                canceled: false,
                filePath: '/path/custom.txti'
            });

            const handler = handlers['file:save-dialog'];
            await handler(mockEvent, 'custom.txti');

            expect(dialog.showSaveDialog).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    defaultPath: 'custom.txti'
                })
            );
        });
    });

    describe('Clipboard IPC Handlers', () => {
        const { clipboard } = require('electron');

        beforeEach(() => {
            jest.isolateModules(() => {
                require('../../main.js');
            });
        });

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

    describe('Window Management IPC Handlers', () => {
        beforeEach(() => {
            jest.isolateModules(() => {
                require('../../main.js');
            });
        });

        test('window:isMaximized should return window state', async () => {
            const mockWindow = {
                isMaximized: jest.fn(() => true)
            };
            mockEvent.sender.getOwnerBrowserWindow = jest.fn(() => mockWindow);

            const handler = handlers['window:isMaximized'];
            const result = await handler(mockEvent);

            expect(result).toBe(true);
            expect(mockWindow.isMaximized).toHaveBeenCalled();
        });

        test('window:get-count should return number of windows', async () => {
            const handler = handlers['window:get-count'];
            
            // This will depend on implementation
            const result = await handler(mockEvent);
            
            expect(typeof result).toBe('number');
            expect(result).toBeGreaterThanOrEqual(0);
        });
    });

    describe('Error Handling', () => {
        beforeEach(() => {
            jest.isolateModules(() => {
                require('../../main.js');
            });
        });

        test('should handle file system errors gracefully', async () => {
            const handler = handlers['file:open'];
            const result = await handler(mockEvent, '/non/existent/path.txti', 'tab-123');

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });

        test('should handle invalid image data', async () => {
            const handler = handlers['clipboard:paste-image'];
            const result = await handler(mockEvent, 'tab-123', 'invalid-data');

            // Should either succeed with handling or return error
            expect(result).toHaveProperty('success');
        });
    });
});
