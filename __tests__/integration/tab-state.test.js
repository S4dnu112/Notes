const fs = require('fs');
const path = require('path');
const os = require('os');

// Mock electron
jest.mock('electron', () => ({
    app: {
        getPath: jest.fn(() => '/tmp/test-tab-state'),
        whenReady: jest.fn(() => Promise.resolve()),
        on: jest.fn()
    },
    BrowserWindow: {},
    ipcMain: { handle: jest.fn() }
}));

const { getFullSession, saveFullSession, saveTabContent } = require('../../dist/lib/sessionManager');
const { createZip, readContentJson } = require('../../dist/lib/zipHandler');

describe('Integration: Tab State Management', () => {
    const testDir = path.join(os.tmpdir(), 'tab-state-test');

    beforeAll(async () => {
        await fs.promises.mkdir(testDir, { recursive: true });
        await fs.promises.mkdir('/tmp/test-tab-state', { recursive: true });
    });

    afterAll(async () => {
        await fs.promises.rm(testDir, { recursive: true, force: true });
        await fs.promises.rm('/tmp/test-tab-state', { recursive: true, force: true });
    });

    describe('Multiple Tabs Workflow', () => {
        test('should manage multiple open tabs', () => {
            const tabs = [
                {
                    id: 'tab-1',
                    filePath: '/path/to/file1.txti',
                    title: 'file1.txti',
                    modified: false,
                    content: [{ type: 'text', value: 'Content 1' }]
                },
                {
                    id: 'tab-2',
                    filePath: null,
                    title: 'Untitled',
                    modified: true,
                    content: [{ type: 'text', value: 'Content 2' }]
                },
                {
                    id: 'tab-3',
                    filePath: '/path/to/file3.txti',
                    title: 'file3.txti',
                    modified: false,
                    content: [{ type: 'text', value: 'Content 3' }]
                }
            ];

            const session = {
                tabs,
                tabOrder: ['tab-1', 'tab-2', 'tab-3'],
                activeTabId: 'tab-2'
            };

            saveFullSession(session);

            const loaded = getFullSession();
            expect(loaded.tabs).toHaveLength(3);
            expect(loaded.activeTabId).toBe('tab-2');
            expect(loaded.tabOrder).toEqual(['tab-1', 'tab-2', 'tab-3']);
        });

        test('should update individual tab content', () => {
            // Initial session
            saveFullSession({
                tabs: [
                    { id: 'tab-1', content: [{ type: 'text', value: 'Old' }] },
                    { id: 'tab-2', content: [] }
                ],
                tabOrder: ['tab-1', 'tab-2'],
                activeTabId: 'tab-1'
            });

            // Update tab-1 content
            saveTabContent({
                id: 'tab-1',
                content: [{ type: 'text', value: 'New' }]
            });

            const session = getFullSession();
            const tab1 = session.tabs.find(t => t.id === 'tab-1');
            expect(tab1.content).toEqual([{ type: 'text', value: 'New' }]);
        });

        test('should handle tab reordering', () => {
            const tabs = [
                { id: 'tab-1', content: [] },
                { id: 'tab-2', content: [] },
                { id: 'tab-3', content: [] }
            ];

            // Initial order
            saveFullSession({
                tabs,
                tabOrder: ['tab-1', 'tab-2', 'tab-3'],
                activeTabId: 'tab-1'
            });

            // Reorder: move tab-3 to front
            saveFullSession({
                tabs,
                tabOrder: ['tab-3', 'tab-1', 'tab-2'],
                activeTabId: 'tab-3'
            });

            const session = getFullSession();
            expect(session.tabOrder).toEqual(['tab-3', 'tab-1', 'tab-2']);
            expect(session.activeTabId).toBe('tab-3');
        });

        test('should handle tab closure', () => {
            // Initial 3 tabs
            saveFullSession({
                tabs: [
                    { id: 'tab-1', content: [] },
                    { id: 'tab-2', content: [] },
                    { id: 'tab-3', content: [] }
                ],
                tabOrder: ['tab-1', 'tab-2', 'tab-3'],
                activeTabId: 'tab-2'
            });

            // Close tab-2, switch to tab-3
            saveFullSession({
                tabs: [
                    { id: 'tab-1', content: [] },
                    { id: 'tab-3', content: [] }
                ],
                tabOrder: ['tab-1', 'tab-3'],
                activeTabId: 'tab-3'
            });

            const session = getFullSession();
            expect(session.tabs).toHaveLength(2);
            expect(session.tabs.find(t => t.id === 'tab-2')).toBeUndefined();
            expect(session.activeTabId).toBe('tab-3');
        });
    });

    describe('Tab Content Persistence', () => {
        test('should preserve unsaved tab content', () => {
            const unsavedContent = [
                { type: 'text', value: 'This is unsaved' },
                { type: 'text', value: 'Work in progress' }
            ];

            saveFullSession({
                tabs: [{
                    id: 'tab-unsaved',
                    filePath: null,
                    title: 'Untitled',
                    modified: true,
                    content: unsavedContent
                }],
                tabOrder: ['tab-unsaved'],
                activeTabId: 'tab-unsaved'
            });

            const session = getFullSession();
            expect(session.tabs[0].content).toEqual(unsavedContent);
            expect(session.tabs[0].modified).toBe(true);
        });

        test('should track modified state correctly', () => {
            const tab = {
                id: 'tab-1',
                filePath: '/test/file.txti',
                title: 'file.txti',
                modified: false,
                content: [{ type: 'text', value: 'Original' }]
            };

            saveFullSession({
                tabs: [tab],
                tabOrder: ['tab-1'],
                activeTabId: 'tab-1'
            });

            // Simulate modification
            saveTabContent({
                id: 'tab-1',
                modified: true,
                content: [{ type: 'text', value: 'Modified' }]
            });

            const session = getFullSession();
            expect(session.tabs[0].modified).toBe(true);
        });
    });

    describe('File Association with Tabs', () => {
        test('should associate saved files with tabs', async () => {
            const file1 = path.join(testDir, 'doc1.txti');
            const file2 = path.join(testDir, 'doc2.txti');

            // Create files
            await createZip({ content: [{ type: 'text', value: 'Doc 1' }] }, {}, file1);
            await createZip({ content: [{ type: 'text', value: 'Doc 2' }] }, {}, file2);

            // Create session with file associations
            const session = {
                tabs: [
                    {
                        id: 'tab-1',
                        filePath: file1,
                        title: 'doc1.txti',
                        modified: false,
                        content: [{ type: 'text', value: 'Doc 1' }]
                    },
                    {
                        id: 'tab-2',
                        filePath: file2,
                        title: 'doc2.txti',
                        modified: false,
                        content: [{ type: 'text', value: 'Doc 2' }]
                    }
                ],
                tabOrder: ['tab-1', 'tab-2'],
                activeTabId: 'tab-1'
            };

            saveFullSession(session);

            // Verify session
            const loaded = getFullSession();
            expect(loaded.tabs[0].filePath).toBe(file1);
            expect(loaded.tabs[1].filePath).toBe(file2);

            // Verify files are readable
            const content1 = await readContentJson(file1);
            const content2 = await readContentJson(file2);
            expect(content1.content.content[0].value).toBe('Doc 1');
            expect(content2.content.content[0].value).toBe('Doc 2');
        });

        test('should handle mix of saved and unsaved tabs', () => {
            const session = {
                tabs: [
                    {
                        id: 'tab-saved',
                        filePath: '/path/to/saved.txti',
                        title: 'saved.txti',
                        modified: false,
                        content: [{ type: 'text', value: 'Saved' }]
                    },
                    {
                        id: 'tab-unsaved',
                        filePath: null,
                        title: 'Untitled',
                        modified: true,
                        content: [{ type: 'text', value: 'Unsaved' }]
                    },
                    {
                        id: 'tab-modified',
                        filePath: '/path/to/modified.txti',
                        title: 'modified.txti',
                        modified: true,
                        content: [{ type: 'text', value: 'Modified' }]
                    }
                ],
                tabOrder: ['tab-saved', 'tab-unsaved', 'tab-modified'],
                activeTabId: 'tab-unsaved'
            };

            saveFullSession(session);

            const loaded = getFullSession();
            expect(loaded.tabs).toHaveLength(3);
            
            const savedTab = loaded.tabs.find(t => t.id === 'tab-saved');
            const unsavedTab = loaded.tabs.find(t => t.id === 'tab-unsaved');
            const modifiedTab = loaded.tabs.find(t => t.id === 'tab-modified');

            expect(savedTab.filePath).toBe('/path/to/saved.txti');
            expect(savedTab.modified).toBe(false);
            
            expect(unsavedTab.filePath).toBeNull();
            expect(unsavedTab.modified).toBe(true);
            
            expect(modifiedTab.filePath).toBe('/path/to/modified.txti');
            expect(modifiedTab.modified).toBe(true);
        });
    });

    describe('Session Recovery Scenarios', () => {
        test('should recover from empty session', () => {
            // Clear session
            const { app } = require('electron');
            const sessionFile = path.join(app.getPath('userData'), 'session.json');
            
            if (fs.existsSync(sessionFile)) {
                fs.unlinkSync(sessionFile);
            }

            const session = getFullSession();
            expect(session).toBeNull();
        });

        test('should handle session after all tabs closed', () => {
            // Save empty session
            saveFullSession({
                tabs: [],
                tabOrder: [],
                activeTabId: null
            });

            const session = getFullSession();
            expect(session.tabs).toHaveLength(0);
            expect(session.activeTabId).toBeNull();
        });

        test('should recover active tab on restart', () => {
            const tabs = [
                { id: 'tab-1', content: [{ type: 'text', value: '1' }] },
                { id: 'tab-2', content: [{ type: 'text', value: '2' }] },
                { id: 'tab-3', content: [{ type: 'text', value: '3' }] }
            ];

            // Save with tab-2 active
            saveFullSession({
                tabs,
                tabOrder: ['tab-1', 'tab-2', 'tab-3'],
                activeTabId: 'tab-2'
            });

            // Simulate restart
            const session = getFullSession();
            
            // Should restore active tab
            expect(session.activeTabId).toBe('tab-2');
            
            // Active tab content should be available
            const activeTab = session.tabs.find(t => t.id === 'tab-2');
            expect(activeTab.content).toEqual([{ type: 'text', value: '2' }]);
        });
    });

    describe('Performance with Many Tabs', () => {
        test('should handle 10 tabs efficiently', () => {
            const tabs = Array.from({ length: 10 }, (_, i) => ({
                id: `tab-${i}`,
                filePath: i % 2 === 0 ? `/path/file${i}.txti` : null,
                title: i % 2 === 0 ? `file${i}.txti` : 'Untitled',
                modified: i % 3 === 0,
                content: [{ type: 'text', value: `Content ${i}` }]
            }));

            const tabOrder = tabs.map(t => t.id);

            const startTime = Date.now();
            
            saveFullSession({
                tabs,
                tabOrder,
                activeTabId: 'tab-5'
            });

            const saveTime = Date.now() - startTime;
            expect(saveTime).toBeLessThan(100); // Should be fast

            const loadStart = Date.now();
            const session = getFullSession();
            const loadTime = Date.now() - loadStart;
            
            expect(loadTime).toBeLessThan(100); // Should be fast
            expect(session.tabs).toHaveLength(10);
            expect(session.activeTabId).toBe('tab-5');
        });
    });
});
