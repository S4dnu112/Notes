/**
 * E2E Tests - File Operations (Consolidated)
 * Tests: create, edit, save, open, modified state
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
        testDir = path.join(os.tmpdir(), 'textimg-e2e-' + Date.now());
        fs.mkdirSync(testDir, { recursive: true });

        const uniqueUserDataDir = path.join(os.tmpdir(), `textimg-test-data-files-${Date.now()}-${Math.random()}`);
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

    test('core file workflow: create, edit, save, reopen, verify modified state', async () => {
        const testFilePath = path.join(testDir, 'test-doc.txti');

        // Mock save dialog
        await electronApp.evaluate(async ({ dialog }, filePath) => {
            dialog.showSaveDialog = async () => ({ canceled: false, filePath: filePath });
        }, testFilePath);

        // Create new tab and type content
        await window.keyboard.press('Control+T');
        const editor = await window.locator('#editor');
        await editor.click();
        await editor.type('First paragraph');
        await window.keyboard.press('Enter');
        await editor.type('Second paragraph');

        // Verify content
        let content = await editor.textContent();
        expect(content).toContain('First paragraph');
        expect(content).toContain('Second paragraph');

        // Tab should be marked as modified
        let modifiedIndicator = await window.locator('.tab.active.modified');
        expect(await modifiedIndicator.count()).toBeGreaterThan(0);

        // Save the file
        await window.keyboard.press('Control+S');
        await window.waitForTimeout(1000);
        expect(fs.existsSync(testFilePath)).toBe(true);

        // Tab title should contain filename after save
        const tabTitle = await window.locator('.tab.active .tab-title').textContent();
        expect(tabTitle).toContain('test-doc');

        // Modified indicator should be gone after save
        modifiedIndicator = await window.locator('.tab.active.modified');
        expect(await modifiedIndicator.count()).toBe(0);

        // Close tab
        await window.keyboard.press('Control+W');
        await window.waitForTimeout(300);

        // Mock open dialog and reopen file
        await electronApp.evaluate(async ({ dialog }, filePath) => {
            dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [filePath] });
        }, testFilePath);

        await window.keyboard.press('Control+O');
        await window.waitForTimeout(1000);

        // Verify content restored
        content = await editor.textContent();
        expect(content).toContain('First paragraph');
        expect(content).toContain('Second paragraph');
    });

    test('unsaved changes prompt on window close', async () => {
        // Open second window (last window auto-closes without prompt for session persistence)
        await window.keyboard.press('Control+N');
        await window.waitForTimeout(500);

        const windows = electronApp.windows();
        expect(windows.length).toBeGreaterThanOrEqual(2);
        const secondWindow = windows[windows.length - 1];
        await secondWindow.waitForLoadState('domcontentloaded');

        // Mock dialog to auto-discard
        await electronApp.evaluate(async ({ dialog }) => {
            dialog.showMessageBox = async () => ({ response: 1 }); // Don't Save
        });

        // Create unsaved content
        const editor = await secondWindow.locator('#editor');
        await editor.click();
        await editor.type('Unsaved content');
        await secondWindow.waitForTimeout(300);

        // Close window
        await secondWindow.locator('#btn-close').click();

        try {
            await secondWindow.waitForTimeout(500);
        } catch (e) { /* Window closed */ }

        expect(await secondWindow.isClosed()).toBe(true);
    });

    test('header display: draft vs saved, modification indicator', async () => {
        const testFilePath = path.join(testDir, 'header-test.txti');
        await electronApp.evaluate(async ({ dialog }, filePath) => {
            dialog.showSaveDialog = async () => ({ canceled: false, filePath: filePath });
        }, testFilePath);

        await window.keyboard.press('Control+T');
        await window.waitForTimeout(200);

        const headerPath = await window.locator('#header-path');
        const editor = await window.locator('#editor');

        // Initially "Draft - Untitled"
        let headerText = await headerPath.textContent();
        expect(headerText).toBe('Draft - Untitled');

        // Type content - header updates with title and modification indicator
        await editor.click();
        await editor.type('My Document Title');
        await window.waitForTimeout(300);

        headerText = await headerPath.textContent();
        expect(headerText).toContain('Draft');
        expect(headerText).toContain('●');

        // Save - header shows file path, no indicator
        await window.keyboard.press('Control+S');
        await window.waitForTimeout(1000);

        headerText = await headerPath.textContent();
        expect(headerText).toContain('header-test.txti');
        expect(headerText).not.toContain('●');

        // Edit again - indicator reappears
        await editor.click();
        await editor.type(' - edited');
        await window.waitForTimeout(300);

        headerText = await headerPath.textContent();
        expect(headerText).toContain('●');
    });

});
