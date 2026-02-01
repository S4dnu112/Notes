const fs = require('fs');
const path = require('path');
const os = require('os');

// Mock electron modules
const mockDialog = {
    showOpenDialog: jest.fn(),
    showSaveDialog: jest.fn()
};

const mockBrowserWindow = {
    fromWebContents: jest.fn(() => ({}))
};

jest.mock('electron', () => ({
    app: {
        getPath: jest.fn(() => '/tmp/test-integration'),
        whenReady: jest.fn(() => Promise.resolve()),
        on: jest.fn()
    },
    BrowserWindow: mockBrowserWindow,
    ipcMain: {
        handle: jest.fn(),
        on: jest.fn()
    },
    dialog: mockDialog,
    nativeImage: {},
    clipboard: {},
    Menu: { setApplicationMenu: jest.fn() }
}));

// Import modules after mocking
const { readContentJson, extractImages, createZip } = require('../../dist/lib/zipHandler');
const { getSettings, saveSettings } = require('../../dist/lib/settingsManager');
const { getFullSession, saveFullSession } = require('../../dist/lib/sessionManager');

describe('Integration: IPC Handlers', () => {
    const testDir = path.join(os.tmpdir(), 'integration-test');
    const testFile = path.join(testDir, 'test.txti');

    beforeAll(async () => {
        await fs.promises.mkdir(testDir, { recursive: true });
        await fs.promises.mkdir('/tmp/test-integration', { recursive: true });
    });

    afterAll(async () => {
        await fs.promises.rm(testDir, { recursive: true, force: true });
        await fs.promises.rm('/tmp/test-integration', { recursive: true, force: true });
    });

    beforeEach(async () => {
        // Clean test file
        try {
            await fs.promises.unlink(testFile);
        } catch (err) {
            // Ignore if doesn't exist
        }
    });

    describe('File Operations Workflow', () => {
        test('should create, save, and read a .txti file', async () => {
            const content = {
                content: [
                    { type: 'text', value: 'Hello World' },
                    { type: 'text', value: 'Integration test' }
                ]
            };
            const imageFiles = {};

            // Save file
            await createZip(content, imageFiles, testFile);

            // Verify file exists
            expect(fs.existsSync(testFile)).toBe(true);

            // Read file back
            const result = await readContentJson(testFile);

            expect(result.content).toEqual(content);
            expect(result.assetList).toEqual([]);
        });

        test('should save and retrieve file with images', async () => {
            const imageDir = path.join(testDir, 'images');
            await fs.promises.mkdir(imageDir, { recursive: true });

            // Create dummy image
            const imagePath = path.join(imageDir, 'test-image.png');
            await fs.promises.writeFile(imagePath, 'fake-image-data');

            const content = {
                content: [
                    { type: 'text', value: 'Document with image' },
                    { type: 'image', filename: 'test-image.png' }
                ]
            };
            const imageFiles = { 'test-image.png': imagePath };

            // Save file with image
            await createZip(content, imageFiles, testFile);

            // Read file back
            const result = await readContentJson(testFile);

            expect(result.content).toEqual(content);
            expect(result.assetList).toContain('test-image.png');

            // Extract images
            const extractDir = path.join(testDir, 'extracted');
            const imageMap = await extractImages(testFile, extractDir);

            expect(imageMap['test-image.png']).toBeDefined();
            expect(fs.existsSync(imageMap['test-image.png'])).toBe(true);

            const extractedContent = await fs.promises.readFile(
                imageMap['test-image.png'],
                'utf-8'
            );
            expect(extractedContent).toBe('fake-image-data');
        });
    });

    describe('Settings Persistence Workflow', () => {
        test('should save and restore settings across operations', async () => {
            const customSettings = {
                lineFeed: 'CRLF',
                autoIndent: false,
                tabSize: 4,
                wordWrap: false
            };

            // Save settings
            const saveResult = saveSettings(customSettings);
            expect(saveResult).toBe(true);

            // Read settings back
            const loadedSettings = getSettings();

            expect(loadedSettings.lineFeed).toBe('CRLF');
            expect(loadedSettings.autoIndent).toBe(false);
            expect(loadedSettings.tabSize).toBe(4);
            expect(loadedSettings.wordWrap).toBe(false);
            // Should still have defaults for unspecified settings
            expect(loadedSettings.indentChar).toBe('tab');
        });

        test('should handle multiple settings updates', async () => {
            // Initial settings
            saveSettings({ tabSize: 2 });
            let settings = getSettings();
            expect(settings.tabSize).toBe(2);

            // Update settings
            saveSettings({ tabSize: 8, wordWrap: true });
            settings = getSettings();
            expect(settings.tabSize).toBe(8);
            expect(settings.wordWrap).toBe(true);

            // Update again
            saveSettings({ lineFeed: 'LF' });
            settings = getSettings();
            expect(settings.tabSize).toBe(8); // Should preserve previous
            expect(settings.lineFeed).toBe('LF');
        });
    });

    describe('Session Management Workflow', () => {
        test('should save and restore complete session', async () => {
            const sessionData = {
                tabs: [
                    {
                        id: 'tab-1',
                        filePath: '/test/file1.txti',
                        title: 'file1.txti',
                        modified: false,
                        content: [{ type: 'text', value: 'Tab 1 content' }]
                    },
                    {
                        id: 'tab-2',
                        filePath: null,
                        title: 'Untitled',
                        modified: true,
                        content: [{ type: 'text', value: 'Tab 2 content' }]
                    }
                ],
                tabOrder: ['tab-1', 'tab-2'],
                activeTabId: 'tab-1'
            };

            // Save session
            saveFullSession(sessionData);

            // Load session back
            const loadedSession = getFullSession();

            expect(loadedSession).not.toBeNull();
            expect(loadedSession.tabs).toHaveLength(2);
            expect(loadedSession.tabOrder).toEqual(['tab-1', 'tab-2']);
            expect(loadedSession.activeTabId).toBe('tab-1');
            expect(loadedSession.tabs[0].content).toEqual([
                { type: 'text', value: 'Tab 1 content' }
            ]);
        });

        test('should handle session updates', async () => {
            // Initial session
            saveFullSession({
                tabs: [{ id: 'tab-1', content: [] }],
                tabOrder: ['tab-1'],
                activeTabId: 'tab-1'
            });

            // Update session with new tab
            saveFullSession({
                tabs: [
                    { id: 'tab-1', content: [] },
                    { id: 'tab-2', content: [] }
                ],
                tabOrder: ['tab-1', 'tab-2'],
                activeTabId: 'tab-2'
            });

            const session = getFullSession();
            expect(session.tabs).toHaveLength(2);
            expect(session.activeTabId).toBe('tab-2');
        });
    });

    describe('End-to-End File Workflow', () => {
        test('should complete full file lifecycle', async () => {
            // 1. Create new document
            const initialContent = {
                content: [{ type: 'text', value: 'Initial content' }]
            };

            await createZip(initialContent, {}, testFile);

            // 2. Open and modify
            const openedContent = await readContentJson(testFile);
            expect(openedContent.content).toEqual(initialContent);

            // 3. Modify content
            const modifiedContent = {
                content: [
                    { type: 'text', value: 'Initial content' },
                    { type: 'text', value: 'Modified content' }
                ]
            };

            // 4. Save again
            await createZip(modifiedContent, {}, testFile);

            // 5. Read back
            const finalContent = await readContentJson(testFile);
            expect(finalContent.content.content).toHaveLength(2);
            expect(finalContent.content.content[1].value).toBe('Modified content');
        });

        test('should handle save with new images', async () => {
            const imageDir = path.join(testDir, 'new-images');
            await fs.promises.mkdir(imageDir, { recursive: true });

            // Create initial file
            const initialContent = { content: [{ type: 'text', value: 'Doc' }] };
            await createZip(initialContent, {}, testFile);

            // Add image
            const imagePath = path.join(imageDir, 'new-image.png');
            await fs.promises.writeFile(imagePath, 'new-image-data');

            const updatedContent = {
                content: [
                    { type: 'text', value: 'Doc' },
                    { type: 'image', filename: 'new-image.png' }
                ]
            };
            const imageFiles = { 'new-image.png': imagePath };

            // Save with image
            await createZip(updatedContent, imageFiles, testFile);

            // Verify image is included
            const result = await readContentJson(testFile);
            expect(result.assetList).toContain('new-image.png');
        });
    });

    describe('Error Recovery', () => {
        test('should handle corrupted file gracefully', async () => {
            // Write corrupted data
            await fs.promises.writeFile(testFile, 'corrupted zip data');

            // Attempt to read
            await expect(readContentJson(testFile)).rejects.toThrow();
        });

        test('should handle missing image files during save', async () => {
            const content = {
                content: [{ type: 'image', filename: 'missing.png' }]
            };
            const imageFiles = {
                'missing.png': '/nonexistent/path/missing.png'
            };

            const consoleWarn = jest.spyOn(console, 'warn').mockImplementation();

            // Should not throw, but warn
            await createZip(content, imageFiles, testFile);

            expect(consoleWarn).toHaveBeenCalled();
            expect(fs.existsSync(testFile)).toBe(true);

            consoleWarn.mockRestore();
        });
    });

    describe('Concurrent Operations', () => {
        test('should handle multiple settings writes', async () => {
            const operations = [
                saveSettings({ tabSize: 2 }),
                saveSettings({ tabSize: 4 }),
                saveSettings({ tabSize: 8 })
            ];

            await Promise.all(operations);

            // Last write should win
            const settings = getSettings();
            expect([2, 4, 8]).toContain(settings.tabSize);
        });

        test('should handle multiple session saves', async () => {
            const sessions = [
                { tabs: [{ id: 'tab-1' }], tabOrder: ['tab-1'], activeTabId: 'tab-1' },
                { tabs: [{ id: 'tab-2' }], tabOrder: ['tab-2'], activeTabId: 'tab-2' },
                { tabs: [{ id: 'tab-3' }], tabOrder: ['tab-3'], activeTabId: 'tab-3' }
            ];

            sessions.forEach(s => saveFullSession(s));

            const final = getFullSession();
            expect(final).not.toBeNull();
            expect(['tab-1', 'tab-2', 'tab-3']).toContain(final.activeTabId);
        });
    });
});
