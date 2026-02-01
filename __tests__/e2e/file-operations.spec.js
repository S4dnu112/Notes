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
        electronApp = await electron.launch({
            args: [path.join(__dirname, '../../main.js')],
            env: {
                ...process.env,
                NODE_ENV: 'test'
            }
        });

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
                return window.keyboard.press('Control+N');
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
        await window.keyboard.press('Control+N').catch(() => {});
        
        // Type content
        const editor = await window.locator('#editor');
        await editor.click();
        await editor.type('Test content for save');

        // Save file (Ctrl+S will trigger save dialog)
        const testFilePath = path.join(testDir, 'test-save.txti');
        
        // Mock save dialog to return our test path
        await electronApp.evaluate(async ({ dialog }, filePath) => {
            const originalShowSaveDialog = dialog.showSaveDialog;
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
        
        // Open file
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
        // Create content
        await window.keyboard.press('Control+N').catch(() => {});
        const editor = await window.locator('#editor');
        await editor.click();
        await editor.type('Unsaved content');

        // Attempt to close window
        // Should show unsaved changes dialog
        const closePromise = window.close();

        // Wait for dialog (this is handled by main process)
        await window.waitForTimeout(500);

        // In real test, you'd interact with the dialog
        // For now, just verify app didn't close immediately
        const isClosed = await window.isClosed();
        expect(isClosed).toBe(false);

        // Cancel close
        await window.keyboard.press('Escape');
    });

    test('should create file with multiple paragraphs', async () => {
        await window.keyboard.press('Control+N').catch(() => {});
        
        const editor = await window.locator('#editor');
        await editor.click();

        // Type multiple lines
        await editor.type('First paragraph');
        await window.keyboard.press('Enter');
        await editor.type('Second paragraph');
        await window.keyboard.press('Enter');
        await editor.type('Third paragraph');

        // Verify structure
        const paragraphs = await window.locator('#editor p').count();
        expect(paragraphs).toBeGreaterThanOrEqual(3);
    });

    test('should show file name in tab title', async () => {
        const testFilePath = path.join(testDir, 'my-document.txti');
        
        // Create and save file
        await window.keyboard.press('Control+N').catch(() => {});
        const editor = await window.locator('#editor');
        await editor.click();
        await editor.type('Document content');

        // Mock save dialog
        await electronApp.evaluate(async ({ dialog }, filePath) => {
            dialog.showSaveDialog = async () => ({
                canceled: false,
                filePath: filePath
            });
        }, testFilePath);

        await window.keyboard.press('Control+S');
        await window.waitForTimeout(1000);

        // Check tab title
        const tabTitle = await window.locator('.tab.active .tab-title').textContent();
        expect(tabTitle).toContain('my-document.txti');
    });

    test('should mark tab as modified when editing', async () => {
        await window.keyboard.press('Control+N').catch(() => {});
        
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

    test.beforeEach(async () => {
        electronApp = await electron.launch({
            args: [path.join(__dirname, '../../main.js')]
        });
        window = await electronApp.firstWindow();
        await window.waitForLoadState('domcontentloaded');
    });

    test.afterEach(async () => {
        if (electronApp) {
            await electronApp.close();
        }
    });

    test('should handle opening non-existent file gracefully', async () => {
        // Mock dialog to return non-existent file
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
        await window.keyboard.press('Control+N').catch(() => {});
        
        const editor = await window.locator('#editor');
        await editor.click();
        await editor.type('Content');

        // Mock save to return invalid path
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
