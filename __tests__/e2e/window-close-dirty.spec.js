/**
 * E2E Tests - Window Close with Multiple Dirty Tabs
 * Tests: discard, cancel, and save-all behaviors when closing a non-last window
 */

const { test, expect, _electron: electron } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const os = require('os');

test.describe('Window Close with Dirty Tabs E2E', () => {
    let electronApp;
    let window;
    let testDir;

    test.beforeEach(async () => {
        testDir = path.join(os.tmpdir(), 'textimg-e2e-dirty-' + Date.now());
        fs.mkdirSync(testDir, { recursive: true });

        const uniqueUserDataDir = path.join(os.tmpdir(), `textimg-test-dirty-${Date.now()}-${Math.random()}`);
        electronApp = await electron.launch({
            args: [path.join(__dirname, '../../dist/main/main.js'), `--user-data-dir=${uniqueUserDataDir}`],
            env: { ...process.env, NODE_ENV: 'test' }
        });

        window = await electronApp.firstWindow();
        await window.waitForLoadState('domcontentloaded');
    });

    test.afterEach(async () => {
        if (electronApp) {
            // Force-close all windows to avoid the close handler intercepting
            await electronApp.evaluate(({ BrowserWindow }) => {
                for (const win of BrowserWindow.getAllWindows()) {
                    win.removeAllListeners('close');
                    win.close();
                }
            });
            await electronApp.close();
        }
        if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true, force: true });
    });

    /**
     * Helper: open a second window and create dirty tabs in it.
     * Returns the second window reference.
     */
    async function openSecondWindowWithDirtyTabs(contents) {
        // Open second window
        await window.keyboard.press('Control+N');
        await window.waitForTimeout(800);

        const windows = electronApp.windows();
        expect(windows.length).toBeGreaterThanOrEqual(2);
        const secondWindow = windows[windows.length - 1];
        await secondWindow.waitForLoadState('domcontentloaded');
        await secondWindow.waitForTimeout(300);

        const editor = secondWindow.locator('#editor');

        for (const content of contents) {
            await secondWindow.keyboard.press('Control+T');
            await secondWindow.waitForTimeout(300);
            await editor.click();
            await editor.type(content);
            await secondWindow.waitForTimeout(300);
        }

        return secondWindow;
    }

    test('window close with dirty tabs: discard closes window', async () => {
        const secondWindow = await openSecondWindowWithDirtyTabs([
            'Dirty content one',
            'Dirty content two'
        ]);

        // Mock dialog to "Don't Save"
        await electronApp.evaluate(async ({ dialog }) => {
            dialog.showMessageBox = async () => ({ response: 1 }); // Don't Save
        });

        // Click close button
        await secondWindow.locator('#btn-close').click();

        try {
            await secondWindow.waitForTimeout(1000);
        } catch (e) { /* Window closed */ }

        expect(await secondWindow.isClosed()).toBe(true);
    });

    test('window close with dirty tabs: cancel keeps window open', async () => {
        const secondWindow = await openSecondWindowWithDirtyTabs([
            'Important unsaved work'
        ]);

        // Mock dialog to "Cancel"
        await electronApp.evaluate(async ({ dialog }) => {
            dialog.showMessageBox = async () => ({ response: 2 }); // Cancel
        });

        // Click close button
        await secondWindow.locator('#btn-close').click();
        await secondWindow.waitForTimeout(800);

        // Window should still be open
        expect(await secondWindow.isClosed()).toBe(false);

        // Content should still be there
        const editor = secondWindow.locator('#editor');
        expect(await editor.textContent()).toContain('Important unsaved work');
    });

    test('window close with dirty tabs: save all then close', async () => {
        const filePath1 = path.join(testDir, 'dirty-save-1.txti');
        const filePath2 = path.join(testDir, 'dirty-save-2.txti');

        const secondWindow = await openSecondWindowWithDirtyTabs([
            'Content to save one',
            'Content to save two'
        ]);

        // Mock dialog: "Save All", then provide save paths
        let saveCallCount = 0;
        const savePaths = [filePath1, filePath2];
        await electronApp.evaluate(async ({ dialog }, paths) => {
            dialog.showMessageBox = async () => ({ response: 0 }); // Save All
            dialog.showSaveDialog = async () => {
                // Use a counter stored in global to provide different paths
                if (!global._saveCallCount) global._saveCallCount = 0;
                const idx = global._saveCallCount++;
                const filePath = paths[idx] || paths[paths.length - 1];
                return { canceled: false, filePath };
            };
        }, savePaths);

        // Click close button
        await secondWindow.locator('#btn-close').click();

        try {
            await secondWindow.waitForTimeout(3000);
        } catch (e) { /* Window closed */ }

        expect(await secondWindow.isClosed()).toBe(true);

        // At least one file should have been saved
        const anyFileSaved = fs.existsSync(filePath1) || fs.existsSync(filePath2);
        expect(anyFileSaved).toBe(true);
    });
});
