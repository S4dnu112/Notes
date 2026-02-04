/**
 * E2E Tests - Tab Close Confirmation Dialog
 * Tests the unsaved changes dialog when closing tabs
 */

const { test, expect, _electron: electron } = require('@playwright/test');
const path = require('path');
const os = require('os');
const fs = require('fs');

test.describe('Tab Close Confirmation Dialog', () => {
    let electronApp;
    let window;
    let testDir;

    test.beforeEach(async () => {
        // Create test directory
        testDir = path.join(os.tmpdir(), 'teximg-close-dialog-' + Date.now());
        fs.mkdirSync(testDir, { recursive: true });

        // Create a unique user data dir for each test
        const uniqueUserDataDir = path.join(os.tmpdir(), `teximg-test-dialog-${Date.now()}-${Math.random()}`);

        electronApp = await electron.launch({
            args: [path.join(__dirname, '../../dist/main/main.js'), `--user-data-dir=${uniqueUserDataDir}`],
            env: {
                ...process.env,
                NODE_ENV: 'test'
            }
        });
        window = await electronApp.firstWindow();
        await window.waitForLoadState('domcontentloaded');
    });

    test.afterEach(async () => {
        if (electronApp) {
            await electronApp.close();
        }

        // Cleanup test directory
        if (fs.existsSync(testDir)) {
            fs.rmSync(testDir, { recursive: true, force: true });
        }
    });

    test('should close tab without dialog when no unsaved changes', async () => {
        // Create a new tab
        await window.keyboard.press('Control+T');
        await window.waitForTimeout(200);

        const initialCount = await window.locator('.tab').count();

        // Close tab without making any changes
        await window.keyboard.press('Control+W');
        await window.waitForTimeout(300);

        // Tab should close without dialog
        const finalCount = await window.locator('.tab').count();
        expect(finalCount).toBe(initialCount - 1);
    });

    test('should show dialog when closing tab with unsaved changes - Cancel option', async () => {
        // Mock the dialog to respond with 'cancel'
        await electronApp.evaluate(async ({ dialog }) => {
            dialog.showMessageBox = async () => ({
                response: 2 // Cancel button index
            });
        });

        // Close the startup tab first to have a clean state
        await window.keyboard.press('Control+W');
        await window.waitForTimeout(300);

        // Create new tab with content
        await window.keyboard.press('Control+T');
        const editor = await window.locator('#editor');
        await editor.click();
        await editor.type('Unsaved content that should trigger dialog');
        await window.waitForTimeout(300);

        const initialCount = await window.locator('.tab').count();

        // Try to close tab - should show dialog and NOT close
        await window.keyboard.press('Control+W');
        await window.waitForTimeout(800);

        // Tab should still be open (dialog was cancelled)
        const finalCount = await window.locator('.tab').count();
        expect(finalCount).toBe(initialCount);

        // Content should still be there
        const content = await editor.textContent();
        expect(content).toContain('Unsaved content');
    });

    test('should show dialog when closing tab with unsaved changes - Don\'t Save option', async () => {
        // Mock the dialog to respond with 'discard'
        await electronApp.evaluate(async ({ dialog }) => {
            dialog.showMessageBox = async () => ({
                response: 1 // "Don't Save" button index
            });
        });

        // Create tab with content
        await window.keyboard.press('Control+T');
        const editor = await window.locator('#editor');
        await editor.click();
        await editor.type('Content to discard');
        await window.waitForTimeout(300);

        const initialCount = await window.locator('.tab').count();

        // Close tab - should show dialog and close without saving
        await window.keyboard.press('Control+W');
        await window.waitForTimeout(500);

        // Tab should be closed
        const finalCount = await window.locator('.tab').count();
        expect(finalCount).toBe(initialCount - 1);
    });

    test('should show dialog when closing tab with unsaved changes - Save option (new file)', async () => {
        const testFilePath = path.join(testDir, 'saved-from-dialog.txti');

        // Mock both dialogs
        await electronApp.evaluate(async ({ dialog }, filePath) => {
            // Mock the unsaved changes dialog to return 'save'
            dialog.showMessageBox = async () => ({
                response: 0 // "Save" button
            });

            // Mock the save dialog to provide a file path
            dialog.showSaveDialog = async () => ({
                canceled: false,
                filePath: filePath
            });
        }, testFilePath);

        // Close the startup tab first
        await window.keyboard.press('Control+W');
        await window.waitForTimeout(300);

        // Create new tab with content
        await window.keyboard.press('Control+T');
        const editor = await window.locator('#editor');
        await editor.click();
        await editor.type('Content to save');
        await window.waitForTimeout(300);

        const initialCount = await window.locator('.tab').count();

        // Close tab - should show dialog, save, and close
        await window.keyboard.press('Control+W');
        await window.waitForTimeout(1500);

        // Tab should be closed
        const finalCount = await window.locator('.tab').count();
        expect(finalCount).toBe(initialCount - 1);

        // File should exist
        expect(fs.existsSync(testFilePath)).toBe(true);
    });

    test('should show dialog when closing tab with unsaved changes - Save option cancelled', async () => {
        // Mock the unsaved changes dialog to respond with 'save'
        // But then cancel the save dialog
        await electronApp.evaluate(async ({ dialog }) => {
            dialog.showMessageBox = async () => ({
                response: 0 // "Save" button
            });

            dialog.showSaveDialog = async () => ({
                canceled: true,
                filePath: undefined
            });
        });

        // Close the startup tab first
        await window.keyboard.press('Control+W');
        await window.waitForTimeout(300);

        // Create new tab with content
        await window.keyboard.press('Control+T');
        const editor = await window.locator('#editor');
        await editor.click();
        await editor.type('Content that won\'t be saved');
        await window.waitForTimeout(300);

        const initialCount = await window.locator('.tab').count();

        // Try to close tab - should show dialog, try to save, but cancel save dialog
        await window.keyboard.press('Control+W');
        await window.waitForTimeout(1200);

        // Tab should still be open (save was cancelled)
        const finalCount = await window.locator('.tab').count();
        expect(finalCount).toBe(initialCount);
    });

    test('should close tab by clicking close button with unsaved changes', async () => {
        // Mock the dialog to respond with 'discard'
        await electronApp.evaluate(async ({ dialog }) => {
            dialog.showMessageBox = async () => ({
                response: 1 // "Don't Save" button index
            });
        });

        // Create tab with content
        await window.keyboard.press('Control+T');
        const editor = await window.locator('#editor');
        await editor.click();
        await editor.type('Content for close button test');
        await window.waitForTimeout(300);

        const initialCount = await window.locator('.tab').count();

        // Click the close button on the tab
        const closeButton = await window.locator('.tab.active .tab-close');
        await closeButton.click();
        await window.waitForTimeout(500);

        // Tab should be closed
        const finalCount = await window.locator('.tab').count();
        expect(finalCount).toBe(initialCount - 1);
    });

    test('should show modified indicator on tab with unsaved changes', async () => {
        // Create tab with content
        await window.keyboard.press('Control+T');
        const editor = await window.locator('#editor');
        await editor.click();
        await editor.type('Modified content');
        await window.waitForTimeout(300);

        // Check for modified class on active tab
        const activeTab = await window.locator('.tab.active');
        const hasModifiedClass = await activeTab.evaluate(el => el.classList.contains('modified'));

        expect(hasModifiedClass).toBe(true);
    });
});
