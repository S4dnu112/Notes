/**
 * E2E Tests - File Operations
 * Tests complete file lifecycle: create, edit, save, open
 */

const { test, expect, _electron: electron } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const os = require('os');

test.describe('File Operations E2E', () => {
    let electronApp;
    let window;
    let testDir;

    test.beforeEach(async () => {
        // Create test directory
        testDir = path.join(os.tmpdir(), 'teximg-e2e-' + Date.now());
        fs.mkdirSync(testDir, { recursive: true });

        // Launch Electron app
        const uniqueUserDataDir = path.join(os.tmpdir(), `teximg-test-data-files-${Date.now()}-${Math.random()}`);
        electronApp = await electron.launch({
            args: [path.join(__dirname, '../../dist/main/main.js'), `--user-data-dir=${uniqueUserDataDir}`],
            env: {
                ...process.env,
                NODE_ENV: 'test'
            }
        });

        // Use a unique context for each test to avoid session overlap
        const context = await electronApp.context();
        await context.tracing.start({ screenshots: true, snapshots: true });

        // Get first window
        window = await electronApp.firstWindow();

        // Wait for app to be ready
        await window.waitForLoadState('domcontentloaded');
    });

    test.afterEach(async () => {
        // Close app
        if (electronApp) {
            await electronApp.close();
        }

        // Cleanup test directory
        if (fs.existsSync(testDir)) {
            fs.rmSync(testDir, { recursive: true, force: true });
        }
    });

    test('should create new tab and type content', async () => {
        // Click new tab or use keyboard shortcut
        const welcomeScreen = await window.locator('#welcome-screen');
        const isVisible = await welcomeScreen.isVisible();

        if (isVisible) {
            // Click "New Document" on welcome screen
            await window.click('[data-action="new-file"]').catch(() => {
                // If button not found, use keyboard shortcut
                return window.keyboard.press('Control+T');
            });
        }

        // Type in editor
        const editor = await window.locator('#editor');
        await editor.click();
        await editor.type('Hello World\nThis is a test document');

        // Verify content
        const content = await editor.textContent();
        expect(content).toContain('Hello World');
        expect(content).toContain('This is a test document');
    });

    test('should save and reopen file', async () => {
        // Create new tab if needed
        await window.keyboard.press('Control+T').catch(() => { });

        // Type content
        const editor = await window.locator('#editor');
        await editor.click();
        await editor.type('Test content for save');

        // Save file (Ctrl+S will trigger save dialog)
        const testFilePath = path.join(testDir, 'test-save.txti');

        // Mock save dialog - the first argument to evaluate IS the electron module
        await electronApp.evaluate(async ({ dialog }, filePath) => {
            dialog.showSaveDialog = async () => ({
                canceled: false,
                filePath: filePath
            });
            return true;
        }, testFilePath);

        await window.keyboard.press('Control+S');

        // Wait for save to complete
        await window.waitForTimeout(1000);

        // Verify file exists
        expect(fs.existsSync(testFilePath)).toBe(true);

        // Close and reopen
        await window.keyboard.press('Control+W'); // Close tab

        // Open file - mock the open dialog
        await electronApp.evaluate(async ({ dialog }, filePath) => {
            dialog.showOpenDialog = async () => ({
                canceled: false,
                filePaths: [filePath]
            });
        }, testFilePath);

        await window.keyboard.press('Control+O');
        await window.waitForTimeout(1000);

        // Verify content restored
        const content = await editor.textContent();
        expect(content).toContain('Test content for save');
    });

    test('should handle unsaved changes prompt', async () => {
        // First, open a new window so we have 2 windows
        // (The last window auto-closes for session persistence without prompting)
        await window.keyboard.press('Control+N');
        await window.waitForTimeout(500);

        // Get the new window
        const windows = electronApp.windows();
        expect(windows.length).toBeGreaterThanOrEqual(2);
        const secondWindow = windows[windows.length - 1];
        await secondWindow.waitForLoadState('domcontentloaded');

        // Mock the unsaved changes dialog to auto-respond with 'discard'
        await electronApp.evaluate(async ({ dialog }) => {
            dialog.showMessageBox = async () => ({
                response: 1 // "Don't Save" button index
            });
        });

        // Create unsaved content in the second window
        const editor = await secondWindow.locator('#editor');
        await editor.click();
        await editor.type('Unsaved content');

        // Wait for content to register as modified
        await secondWindow.waitForTimeout(300);

        // Try to close the second window via the close button
        // This should trigger the unsaved changes dialog (now mocked)
        await secondWindow.locator('#btn-close').click();

        // Wait for close to complete - catch error if window already closed
        try {
            await secondWindow.waitForTimeout(500);
        } catch (e) {
            // Window closed before timeout completed - this is expected
        }

        // The window should have closed after dialog was auto-dismissed
        const isSecondWindowClosed = await secondWindow.isClosed();

        // Test passes if window closed - the dialog was handled automatically
        expect(isSecondWindowClosed).toBe(true);
    });

    test('should create file with multiple paragraphs', async () => {
        await window.keyboard.press('Control+T').catch(() => { });

        const editor = await window.locator('#editor');
        await editor.click();

        // Type multiple lines
        await editor.type('First paragraph');
        await window.keyboard.press('Enter');
        await editor.type('Second paragraph');
        await window.keyboard.press('Enter');
        await editor.type('Third paragraph');

        // Verify structure - check for newlines in content
        const content = await editor.innerText();
        const lines = content.split('\n').filter(line => line.trim().length > 0);
        expect(lines.length).toBeGreaterThanOrEqual(3);
    });

    test('should show file name in tab title', async () => {
        // Use a short filename to avoid truncation in the tab title
        const testFilePath = path.join(testDir, 'doc.txti');

        // Create and save file
        await window.keyboard.press('Control+T').catch(() => { });
        const editor = await window.locator('#editor');
        await editor.click();
        await editor.type('Document content');

        // Mock save dialog - the first argument to evaluate IS the electron module
        await electronApp.evaluate(async ({ dialog }, filePath) => {
            dialog.showSaveDialog = async () => ({
                canceled: false,
                filePath: filePath
            });
        }, testFilePath);

        await window.keyboard.press('Control+S');
        await window.waitForTimeout(1000);

        // Check tab title - should contain the filename (may be truncated for long names)
        const tabTitle = await window.locator('.tab.active .tab-title').textContent();
        expect(tabTitle).toContain('doc.txti');
    });

    test('should mark tab as modified when editing', async () => {
        await window.keyboard.press('Control+T').catch(() => { });

        const editor = await window.locator('#editor');
        await editor.click();
        await editor.type('Modified content');

        // Check for modified indicator (usually a dot or asterisk)
        const modifiedIndicator = await window.locator('.tab.active.modified, .tab.active [data-modified="true"]');
        const count = await modifiedIndicator.count();

        expect(count).toBeGreaterThan(0);
    });
});

test.describe('File Operations - Error Handling', () => {
    let electronApp;
    let window;
    let testDataDir;

    test.beforeEach(async () => {
        testDataDir = path.join(os.tmpdir(), `teximg-test-error-${Date.now()}-${Math.random()}`);

        electronApp = await electron.launch({
            args: [path.join(__dirname, '../../dist/main/main.js'), `--user-data-dir=${testDataDir}`]
        });
        window = await electronApp.firstWindow();
        await window.waitForLoadState('domcontentloaded');
    });

    test.afterEach(async () => {
        if (electronApp) {
            await electronApp.close();
        }

        if (testDataDir && fs.existsSync(testDataDir)) {
            try {
                fs.rmSync(testDataDir, { recursive: true, force: true });
            } catch (e) {
                console.error(`Failed to cleanup test data dir: ${testDataDir}`, e);
            }
        }
    });

    test('should handle opening non-existent file gracefully', async () => {
        // Mock dialog - the first argument to evaluate IS the electron module
        await electronApp.evaluate(async ({ dialog }) => {
            dialog.showOpenDialog = async () => ({
                canceled: false,
                filePaths: ['/non/existent/file.txti']
            });
        });

        await window.keyboard.press('Control+O');
        await window.waitForTimeout(1000);

        // App should still be running, error should be shown
        const isClosed = await window.isClosed();
        expect(isClosed).toBe(false);

        // Could check for error message in UI
        // const errorMsg = await window.locator('.error-message').textContent();
        // expect(errorMsg).toContain('error');
    });

    test('should handle save errors gracefully', async () => {
        await window.keyboard.press('Control+T').catch(() => { });

        const editor = await window.locator('#editor');
        await editor.click();
        await editor.type('Content');

        // Mock save dialog - the first argument to evaluate IS the electron module
        await electronApp.evaluate(async ({ dialog }) => {
            dialog.showSaveDialog = async () => ({
                canceled: false,
                filePath: '/invalid/permissions/file.txti'
            });
        });

        await window.keyboard.press('Control+S');
        await window.waitForTimeout(1000);

        // Should still have content in editor
        const content = await editor.textContent();
        expect(content).toContain('Content');
    });
});
