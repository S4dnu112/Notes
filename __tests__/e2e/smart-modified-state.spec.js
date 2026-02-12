/**
 * E2E Tests - Smart Modified State
 * Tests: modified state based on content comparison
 */

const { test, expect, _electron: electron } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const os = require('os');

test.describe('Smart Modified State', () => {
    let electronApp;
    let window;
    let testDir;

    test.beforeEach(async () => {
        testDir = path.join(os.tmpdir(), 'textimg-smart-mod-' + Date.now());
        fs.mkdirSync(testDir, { recursive: true });

        const uniqueUserDataDir = path.join(os.tmpdir(), `textimg-test-data-smart-${Date.now()}-${Math.random()}`);
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

    test('should mark as modified only when content differs from saved state', async () => {
        // 1. Initial State: Untitled, Empty. Not modified.
        let modifiedIndicator = await window.locator('.tab.active.modified');
        expect(await modifiedIndicator.count()).toBe(0);

        // 2. Type content -> Modified
        const editor = await window.locator('#editor');
        await editor.click();
        await editor.type('ABC');
        await window.waitForTimeout(300);

        modifiedIndicator = await window.locator('.tab.active.modified');
        expect(await modifiedIndicator.count()).toBe(1);

        // 3. Undo/Backspace to match initial -> Not Modified
        await editor.press('Backspace');
        await editor.press('Backspace');
        await editor.press('Backspace');
        await window.waitForTimeout(300);

        expect(await editor.textContent()).toBe('');
        modifiedIndicator = await window.locator('.tab.active.modified');
        expect(await modifiedIndicator.count()).toBe(0);
    });

    test('should clear modified state after reverting to saved file content', async () => {
        const testFilePath = path.join(testDir, 'saved-doc.txti');

        // Mock save dialog
        await electronApp.evaluate(async ({ dialog }, filePath) => {
            dialog.showSaveDialog = async () => ({ canceled: false, filePath: filePath });
        }, testFilePath);

        // Type 'Hello'
        const editor = await window.locator('#editor');
        await editor.click();
        await editor.type('Hello');
        await window.waitForTimeout(300);

        // Save
        await window.keyboard.press('Control+S');
        await window.waitForTimeout(1000);

        // Verify clean state
        let modifiedIndicator = await window.locator('.tab.active.modified');
        expect(await modifiedIndicator.count()).toBe(0);

        // Add ' World' -> Modified
        await editor.type(' World');
        await window.waitForTimeout(300);

        modifiedIndicator = await window.locator('.tab.active.modified');
        expect(await modifiedIndicator.count()).toBe(1);

        // Undo ' World' -> Not Modified
        for (let i = 0; i < 6; i++) {
            await editor.press('Backspace');
        }
        await window.waitForTimeout(300);

        expect(await editor.textContent()).toBe('Hello');
        modifiedIndicator = await window.locator('.tab.active.modified');
        expect(await modifiedIndicator.count()).toBe(0);
    });
});
