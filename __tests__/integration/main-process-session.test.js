/**
 * Integration Tests for Main Process - Session Management
 */

const path = require('path');
const fs = require('fs');
const os = require('os');
const { ipcMain } = require('electron');

// Store os.tmpdir() before mocking
const mockTmpDir = os.tmpdir();

// Mock electron modules
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

const { getSession, saveSession, getFullSession, saveFullSession, saveTabContent } = require('../../dist/main/lib/sessionManager');

describe('Main Process - Session Management', () => {
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

    describe('Session IPC Handlers', () => {
        beforeEach(() => {
            jest.isolateModules(() => {
                require('../../dist/main/main.js');
            });
        });

        test('session:get should return session data', async () => {
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
            
            const saved = getSession();
            expect(saved).toEqual(testPaths);
        });

        test('session:get-full should return complete session with tabs', async () => {
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

            const saved = getFullSession();
            expect(saved).toMatchObject(sessionData);
        });

        test('session:save-tab should save individual tab content', async () => {
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

            const session = getFullSession();
            const tab = session.tabs.find(t => t.id === 'tab1');
            expect(tab.content).toEqual(tabData.content);
            expect(tab.modified).toBe(true);
        });
    });

    describe('Session State Management', () => {
        test('should handle multiple tab updates', () => {
            saveFullSession({
                tabs: [
                    { id: 'tab-1', content: [] },
                    { id: 'tab-2', content: [] }
                ],
                tabOrder: ['tab-1', 'tab-2'],
                activeTabId: 'tab-1'
            });

            saveTabContent({ id: 'tab-1', content: [{ type: 'text', val: 'Update 1' }] });
            saveTabContent({ id: 'tab-2', content: [{ type: 'text', val: 'Update 2' }] });

            const session = getFullSession();
            expect(session.tabs[0].content[0].val).toBe('Update 1');
            expect(session.tabs[1].content[0].val).toBe('Update 2');
        });

        test('should maintain tab order', () => {
            const session = {
                tabs: [
                    { id: 'tab-3', content: [] },
                    { id: 'tab-1', content: [] },
                    { id: 'tab-2', content: [] }
                ],
                tabOrder: ['tab-3', 'tab-1', 'tab-2'],
                activeTabId: 'tab-2'
            };

            saveFullSession(session);
            const loaded = getFullSession();

            expect(loaded.tabOrder).toEqual(['tab-3', 'tab-1', 'tab-2']);
            expect(loaded.activeTabId).toBe('tab-2');
        });

        test('should handle empty session', () => {
            saveFullSession({
                tabs: [],
                tabOrder: [],
                activeTabId: null
            });

            const session = getFullSession();
            expect(session.tabs).toHaveLength(0);
            expect(session.activeTabId).toBeNull();
        });
    });
});
