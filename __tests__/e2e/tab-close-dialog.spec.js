/**
 * E2E Tests - Tab Close Dialog (Consolidated)
 * Tests: unsaved changes dialog with Save, Don't Save, Cancel options
 */

const { test, expect, _electron: electron } = require('@playwright/test');
const path = require('path');
const os = require('os');
const fs = require('fs');

test.describe('Tab Close Dialog E2E', () => {
    let electronApp;
    let window;
    let testDir;

    test.beforeEach(async () => {
        testDir = path.join(os.tmpdir(), 'textimg-close-dialog-' + Date.now());
        fs.mkdirSync(testDir, { recursive: true });

        const uniqueUserDataDir = path.join(os.tmpdir(), `textimg-test-dialog-${Date.now()}-${Math.random()}`);
        electronApp = await electron.launch({
            args: [path.join(__dirname, '../../dist/main/main.js'), `--user-data-dir=${uniqueUserDataDir}`],
            env: { ...process.env, NODE_ENV: 'test' }
        });
        window = await electronApp.firstWindow();
        await window.waitForLoadState('domcontentloaded');
    });

    test.afterEach(async () => {
        if (electronApp) await electronApp.close();
        if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true, force: true });
    });

    test('no dialog when closing unmodified tab', async () => {
        await window.keyboard.press('Control+T');
        await window.waitForTimeout(200);

        const initialCount = await window.locator('.tab').count();

        // Close without changes - should close immediately
        await window.keyboard.press('Control+W');
        await window.waitForTimeout(300);

        expect(await window.locator('.tab').count()).toBe(initialCount - 1);
    });

    test('unsaved changes dialog: Cancel, Don\'t Save, and Save options', async () => {
        const testFilePath = path.join(testDir, 'dialog-save-test.txti');
        const editor = await window.locator('#editor');

        // === Test Cancel option ===
        await electronApp.evaluate(async ({ dialog }) => {
            dialog.showMessageBox = async () => ({ response: 2 }); // Cancel
        });

        await window.keyboard.press('Control+T');
        await window.waitForTimeout(200);
        await editor.click();
        await editor.type('Content for cancel test');
        await window.waitForTimeout(300);

        const countBeforeCancel = await window.locator('.tab').count();
        await window.keyboard.press('Control+W');
        await window.waitForTimeout(800);

        // Tab should still be open
        expect(await window.locator('.tab').count()).toBe(countBeforeCancel);
        expect(await editor.textContent()).toContain('cancel test');

        // Verify modified indicator is present
        const hasModified = await window.locator('.tab.active.modified').count();
        expect(hasModified).toBeGreaterThan(0);

        // === Test Don't Save option ===
        await electronApp.evaluate(async ({ dialog }) => {
            dialog.showMessageBox = async () => ({ response: 1 }); // Don't Save
        });

        const countBeforeDiscard = await window.locator('.tab').count();
        await window.keyboard.press('Control+W');
        await window.waitForTimeout(500);

        // Tab should be closed
        expect(await window.locator('.tab').count()).toBe(countBeforeDiscard - 1);

        // === Test Save option ===
        await electronApp.evaluate(async ({ dialog }, filePath) => {
            dialog.showMessageBox = async () => ({ response: 0 }); // Save
            dialog.showSaveDialog = async () => ({ canceled: false, filePath: filePath });
        }, testFilePath);

        await window.keyboard.press('Control+T');
        await window.waitForTimeout(200);
        await editor.click();
        await editor.type('Content to save');
        await window.waitForTimeout(300);

        const countBeforeSave = await window.locator('.tab').count();
        await window.keyboard.press('Control+W');
        await window.waitForTimeout(1500);

        // Tab should be closed and file saved
        expect(await window.locator('.tab').count()).toBe(countBeforeSave - 1);
        expect(fs.existsSync(testFilePath)).toBe(true);
    });
});
