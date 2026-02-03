/**
 * E2E Tests - Header Display
 * Tests header path display for unsaved and saved files
 */

const { test, expect, _electron: electron } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const os = require('os');

test.describe('Header Display E2E', () => {
    let electronApp;
    let window;
    let testDir;

    test.beforeEach(async () => {
        // Create test directory
        testDir = path.join(os.tmpdir(), 'teximg-e2e-header-' + Date.now());
        fs.mkdirSync(testDir, { recursive: true });

        // Launch Electron app
        const uniqueUserDataDir = path.join(os.tmpdir(), `teximg-test-data-header-${Date.now()}-${Math.random()}`);
        electronApp = await electron.launch({
            args: [path.join(__dirname, '../../dist/main/main.js'), `--user-data-dir=${uniqueUserDataDir}`]
        });

        window = await electronApp.firstWindow();
        await window.waitForLoadState('domcontentloaded');
    });

    test.afterEach(async () => {
        if (electronApp) {
            await electronApp.close();
        }

        if (fs.existsSync(testDir)) {
            fs.rmSync(testDir, { recursive: true, force: true });
        }
    });

    test('should update header display correctly for unsaved and saved files', async () => {
        // Close startup tab to start fresh
        await window.keyboard.press('Control+W');
        await window.waitForTimeout(200);

        // Create new tab
        await window.keyboard.press('Control+T');
        await window.waitForTimeout(200);

        const headerPath = await window.locator('#header-path');

        // Initially should show "Draft - Untitled"
        let headerText = await headerPath.textContent();
        expect(headerText).toBe('Draft - Untitled');

        // Type some content and verify header updates in real-time
        const editor = await window.locator('#editor');
        await editor.click();
        await editor.type('Test Header');
        await window.waitForTimeout(300);

        headerText = await headerPath.textContent();
        expect(headerText).toBe('Draft - Test Header ●');

        // Mock the save dialog to return a test file path
        const testFilePath = path.join(testDir, 'test-file.txti');
        await electronApp.evaluate(async ({ dialog }, filePath) => {
            dialog.showSaveDialog = async () => ({
                canceled: false,
                filePath: filePath
            });
        }, testFilePath);

        // Save the file
        await window.keyboard.press('Control+S');
        await window.waitForTimeout(1000);

        // After saving, header should show directory path + filename
        headerText = await headerPath.textContent();
        expect(headerText).toContain('test-file.txti');

        // Should NOT contain the unsaved indicator
        expect(headerText).not.toContain('●');

        // Should contain some directory path (at least the last directory segment)
        expect(headerText.length).toBeGreaterThan('test-file.txti'.length);

        // Modify saved file - indicator should reappear
        await editor.click();
        await editor.type(' - Modified');
        await window.waitForTimeout(300);

        headerText = await headerPath.textContent();
        expect(headerText).toContain('test-file.txti');
        expect(headerText).toContain('●');

        // Save again using shortcut
        await window.keyboard.press('Control+S');
        await window.waitForTimeout(500);

        headerText = await headerPath.textContent();
        expect(headerText).not.toContain('●');

        // Create another unsaved tab to verify it switches back to "Draft - Untitled"
        await window.keyboard.press('Control+T');
        await window.waitForTimeout(200);

        headerText = await headerPath.textContent();
        expect(headerText).toBe('Draft - Untitled');

        // Switch back to saved tab
        const firstTab = await window.locator('.tab').first();
        await firstTab.click();
        await window.waitForTimeout(200);

        // Header should show the saved file path again (clean state)
        headerText = await headerPath.textContent();
        expect(headerText).toContain('test-file.txti');
        expect(headerText).not.toContain('●');

        // Test 30-char truncation for unsaved file
        await window.keyboard.press('Control+T');
        await window.waitForTimeout(200);
        await editor.click();

        const longTitle = 'This is a very long title that should be truncated in the header';
        await editor.type(longTitle);
        await window.waitForTimeout(500);

        headerText = await headerPath.textContent();
        // 30 chars: "This is a very long title that" + dot
        expect(headerText).toBe('Draft - This is a very long title that ●');

        // Tab title should be more truncated (15 chars)
        const activeTab = await window.locator('.tab.active .tab-title');
        const tabTitleText = await activeTab.textContent();
        expect(tabTitleText).toBe('This is a very ');
    });
});
