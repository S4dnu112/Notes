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
} = require('../../lib/sessionManager');

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
});
