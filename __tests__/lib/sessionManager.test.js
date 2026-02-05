const fs = require('fs');
const path = require('path');

// Mock electron app
jest.mock('electron', () => ({
    app: {
        getPath: jest.fn(() => '/tmp/test-session')
    }
}));

// Import after mocking
const {
    getSession,
    saveSession,
    getFullSession,
    saveFullSession,
    saveTabContent
} = require('../../dist/main/lib/sessionManager');

describe('sessionManager', () => {
    const testSessionPath = '/tmp/test-session/session.json';

    beforeEach(() => {
        // Clean up any existing session file
        if (fs.existsSync(testSessionPath)) {
            fs.unlinkSync(testSessionPath);
        }
    });

    afterEach(() => {
        // Clean up after each test
        if (fs.existsSync(testSessionPath)) {
            fs.unlinkSync(testSessionPath);
        }
    });

    describe('getSession', () => {
        test('should return empty array when no session exists', () => {
            const session = getSession();
            expect(session).toEqual([]);
        });

        test('should return open files from session', () => {
            // Create directory if it doesn't exist
            const dir = path.dirname(testSessionPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            const sessionData = {
                openFiles: ['/path/to/file1.txti', '/path/to/file2.txti'],
                savedAt: new Date().toISOString()
            };
            fs.writeFileSync(testSessionPath, JSON.stringify(sessionData));

            const session = getSession();
            expect(session).toEqual(sessionData.openFiles);
        });

        test('should return empty array for corrupted session file', () => {
            const dir = path.dirname(testSessionPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            fs.writeFileSync(testSessionPath, 'invalid json');
            const session = getSession();
            expect(session).toEqual([]);
        });
    });

    describe('saveSession', () => {
        test('should save file paths to session', () => {
            const filePaths = ['/path/to/file1.txti', '/path/to/file2.txti'];
            saveSession(filePaths);

            expect(fs.existsSync(testSessionPath)).toBe(true);
            const saved = JSON.parse(fs.readFileSync(testSessionPath, 'utf-8'));
            expect(saved.openFiles).toEqual(filePaths);
            expect(saved.savedAt).toBeDefined();
        });

        test('should overwrite existing session', () => {
            const dir = path.dirname(testSessionPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            saveSession(['/old/file.txti']);
            saveSession(['/new/file.txti']);

            const saved = JSON.parse(fs.readFileSync(testSessionPath, 'utf-8'));
            expect(saved.openFiles).toEqual(['/new/file.txti']);
        });

        test('should handle write errors gracefully', () => {
            const originalWriteFileSync = fs.writeFileSync;
            const consoleError = jest.spyOn(console, 'error').mockImplementation();

            fs.writeFileSync = jest.fn(() => {
                throw new Error('Write failed');
            });

            expect(() => saveSession(['/test/file.txti'])).not.toThrow();
            expect(consoleError).toHaveBeenCalled();

            fs.writeFileSync = originalWriteFileSync;
            consoleError.mockRestore();
        });
    });

    describe('getFullSession', () => {
        test('should return null when no session exists', () => {
            const session = getFullSession();
            expect(session).toBeNull();
        });

        test('should return full session with tabs', () => {
            const dir = path.dirname(testSessionPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            const sessionData = {
                tabs: [
                    { id: 'tab-1', filePath: '/test/file1.txti', content: [] },
                    { id: 'tab-2', filePath: null, content: [] }
                ],
                activeTabId: 'tab-1',
                savedAt: new Date().toISOString()
            };
            fs.writeFileSync(testSessionPath, JSON.stringify(sessionData));

            const session = getFullSession();
            expect(session).toEqual(sessionData);
            expect(session.tabs).toHaveLength(2);
        });

        test('should return null for legacy format without tabs', () => {
            const dir = path.dirname(testSessionPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            const legacySession = {
                openFiles: ['/test/file.txti'],
                savedAt: new Date().toISOString()
            };
            fs.writeFileSync(testSessionPath, JSON.stringify(legacySession));

            const session = getFullSession();
            expect(session).toBeNull();
        });
    });

    describe('saveFullSession', () => {
        test('should save complete session data', () => {
            const sessionData = {
                tabs: [
                    { id: 'tab-1', filePath: '/test/file1.txti', content: [] }
                ],
                activeTabId: 'tab-1',
                tabOrder: ['tab-1']
            };

            saveFullSession(sessionData);

            expect(fs.existsSync(testSessionPath)).toBe(true);
            const saved = JSON.parse(fs.readFileSync(testSessionPath, 'utf-8'));
            expect(saved.tabs).toEqual(sessionData.tabs);
            expect(saved.activeTabId).toBe('tab-1');
            expect(saved.savedAt).toBeDefined();
        });
    });

    describe('saveTabContent', () => {
        test('should add new tab to session', () => {
            const tabData = {
                id: 'tab-1',
                filePath: '/test/file.txti',
                content: [{ type: 'text', value: 'Hello' }]
            };

            saveTabContent(tabData);

            const saved = JSON.parse(fs.readFileSync(testSessionPath, 'utf-8'));
            expect(saved.tabs).toHaveLength(1);
            expect(saved.tabs[0]).toEqual(tabData);
        });

        test('should update existing tab in session', () => {
            const dir = path.dirname(testSessionPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            // Create initial session
            const initialSession = {
                tabs: [{ id: 'tab-1', content: [] }],
                savedAt: new Date().toISOString()
            };
            fs.writeFileSync(testSessionPath, JSON.stringify(initialSession));

            // Update tab
            const updatedTab = {
                id: 'tab-1',
                content: [{ type: 'text', value: 'Updated' }]
            };
            saveTabContent(updatedTab);

            const saved = JSON.parse(fs.readFileSync(testSessionPath, 'utf-8'));
            expect(saved.tabs).toHaveLength(1);
            expect(saved.tabs[0].content).toEqual(updatedTab.content);
        });

        test('should initialize tabs array if not present', () => {
            const dir = path.dirname(testSessionPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            // Create session without tabs array
            fs.writeFileSync(testSessionPath, JSON.stringify({}));

            const tabData = { id: 'tab-1', content: [] };
            saveTabContent(tabData);

            const saved = JSON.parse(fs.readFileSync(testSessionPath, 'utf-8'));
            expect(saved.tabs).toHaveLength(1);
        });
    });

    describe('concurrent operations', () => {
        test('should handle rapid successive saves', async () => {
            const saves = [];
            for (let i = 0; i < 50; i++) {
                saves.push(saveSession([`/file${i}.txti`]));
            }
            
            // All should complete without throwing
            await Promise.all(saves);

            // Last write should be available
            const session = getSession();
            expect(Array.isArray(session)).toBe(true);
            expect(session.length).toBe(1);
        });

        test('should handle concurrent full session saves', () => {
            const sessions = [];
            for (let i = 0; i < 30; i++) {
                sessions.push({
                    tabs: [{ id: `tab-${i}`, content: [] }],
                    tabOrder: [`tab-${i}`],
                    activeTabId: `tab-${i}`
                });
            }

            // Save all concurrently
            sessions.forEach(s => saveFullSession(s));

            // Should have a valid session at the end
            const final = getFullSession();
            expect(final).not.toBeNull();
            expect(final.tabs).toHaveLength(1);
            expect(final.activeTabId).toMatch(/^tab-\d+$/);
        });

        test('should handle mixed save operations', () => {
            // Start with a full session first
            saveFullSession({
                tabs: [{ id: 'tab-1', content: [] }],
                tabOrder: ['tab-1'],
                activeTabId: 'tab-1'
            });

            // Mix different types of saves
            saveSession(['/file1.txti']);
            saveFullSession({
                tabs: [{ id: 'tab-1', content: [] }],
                tabOrder: ['tab-1'],
                activeTabId: 'tab-1'
            });
            saveTabContent({ id: 'tab-1', content: [{ type: 'text', value: 'Updated' }] });

            // Should still have a valid state
            const session = getFullSession();
            expect(session).not.toBeNull();
            expect(session.tabs).toBeDefined();
        });

        test('should handle concurrent tab content updates', () => {
            // Initialize session with multiple tabs
            saveFullSession({
                tabs: [
                    { id: 'tab-1', content: [] },
                    { id: 'tab-2', content: [] },
                    { id: 'tab-3', content: [] }
                ],
                tabOrder: ['tab-1', 'tab-2', 'tab-3'],
                activeTabId: 'tab-1'
            });

            // Update all tabs concurrently
            saveTabContent({ id: 'tab-1', content: [{ type: 'text', value: '1' }] });
            saveTabContent({ id: 'tab-2', content: [{ type: 'text', value: '2' }] });
            saveTabContent({ id: 'tab-3', content: [{ type: 'text', value: '3' }] });

            // All tabs should exist in final state
            const session = getFullSession();
            expect(session.tabs.length).toBeGreaterThanOrEqual(3);
        });
    });

    describe('error recovery', () => {
        test('should handle corrupted session file', () => {
            const dir = path.dirname(testSessionPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            // Write corrupted JSON
            fs.writeFileSync(testSessionPath, '{"openFiles": ["/test.t');
            
            const session = getSession();
            expect(session).toEqual([]);
        });

        test('should handle session file with invalid structure', () => {
            const dir = path.dirname(testSessionPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            // Valid JSON but wrong structure
            fs.writeFileSync(testSessionPath, JSON.stringify({ wrongField: 'value' }));
            
            const session = getSession();
            expect(session).toEqual([]);
        });

        test('should handle missing userData directory', () => {
            // This should create the directory automatically
            const testPaths = ['/test/file.txti'];
            expect(() => saveSession(testPaths)).not.toThrow();
        });

        test('should recover from permission errors', () => {
            const originalWriteFileSync = fs.writeFileSync;
            const consoleError = jest.spyOn(console, 'error').mockImplementation();

            fs.writeFileSync = jest.fn(() => {
                const err = new Error('EACCES: permission denied');
                err.code = 'EACCES';
                throw err;
            });

            expect(() => saveSession(['/test/file.txti'])).not.toThrow();
            expect(consoleError).toHaveBeenCalled();

            fs.writeFileSync = originalWriteFileSync;
            consoleError.mockRestore();
        });
    });

    describe('session data integrity', () => {
        test('should preserve tab order across save/load', () => {
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
        });

        test('should preserve complex content structures', () => {
            const complexContent = [
                { type: 'text', value: 'Line 1\nLine 2\nLine 3' },
                { type: 'img', src: 'image.png' },
                { type: 'text', value: 'Special chars: áéíóú ñ 中文 🎉' }
            ];

            saveFullSession({
                tabs: [{ id: 'tab-1', content: complexContent }],
                tabOrder: ['tab-1'],
                activeTabId: 'tab-1'
            });

            const loaded = getFullSession();
            expect(loaded.tabs[0].content).toEqual(complexContent);
        });

        test('should handle large sessions', () => {
            const largeTabs = Array.from({ length: 50 }, (_, i) => ({
                id: `tab-${i}`,
                filePath: `/path/file${i}.txti`,
                content: Array.from({ length: 100 }, (_, j) => ({
                    type: 'text',
                    value: `Content ${j} for tab ${i}`
                }))
            }));

            const session = {
                tabs: largeTabs,
                tabOrder: largeTabs.map(t => t.id),
                activeTabId: 'tab-25'
            };

            const startSave = Date.now();
            saveFullSession(session);
            const saveDuration = Date.now() - startSave;
            expect(saveDuration).toBeLessThan(500); // Should be reasonably fast

            const startLoad = Date.now();
            const loaded = getFullSession();
            const loadDuration = Date.now() - startLoad;
            expect(loadDuration).toBeLessThan(500);

            expect(loaded.tabs).toHaveLength(50);
            expect(loaded.activeTabId).toBe('tab-25');
        });
    });
});
