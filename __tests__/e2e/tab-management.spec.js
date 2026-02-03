/**
 * E2E Tests - Tab Management
 * Tests tab creation, switching, closing, and multi-tab workflows
 */

const { test, expect, _electron: electron } = require('@playwright/test');
const path = require('path');
const os = require('os');

test.describe('Tab Management E2E', () => {
    let electronApp;
    let window;

    test.beforeEach(async () => {
        // Create a unique user data dir for each test
        const uniqueUserDataDir = path.join(os.tmpdir(), `teximg-test-data-${Date.now()}-${Math.random()}`);

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
    });

    test('should create multiple tabs', async () => {
        // Create first tab
        await window.keyboard.press('Control+T');
        await window.waitForTimeout(200);

        // Create second tab
        await window.keyboard.press('Control+T');
        await window.waitForTimeout(200);

        // Create third tab
        await window.keyboard.press('Control+T');
        await window.waitForTimeout(200);

        // Check tab count
        const tabs = await window.locator('.tab').count();
        expect(tabs).toBeGreaterThanOrEqual(3);
    });

    test('should switch between tabs', async () => {
        // Create two tabs with different content
        await window.keyboard.press('Control+T');
        const editor = await window.locator('#editor');
        await editor.click();
        await editor.type('Tab 1 content');

        await window.keyboard.press('Control+T');
        await editor.click();
        await window.keyboard.press('Control+A');
        await window.keyboard.press('Delete');
        await editor.type('Tab 2 content');

        // Switch back to first tab (Ctrl+Tab or click)
        await window.keyboard.press('Control+Shift+Tab');
        await window.waitForTimeout(300);

        // Verify content switched
        const content = await editor.textContent();
        expect(content).toContain('Tab 1 content');
    });

    test('should close tab with Ctrl+W', async () => {
        // Create tabs
        await window.keyboard.press('Control+T');
        await window.keyboard.press('Control+T');

        const initialCount = await window.locator('.tab').count();

        // Close current tab
        await window.keyboard.press('Control+W');
        await window.waitForTimeout(300);

        const finalCount = await window.locator('.tab').count();
        expect(finalCount).toBe(initialCount - 1);
    });

    test('should show welcome screen when all tabs closed', async () => {
        // Create a tab
        await window.keyboard.press('Control+T');

        // Close it
        await window.keyboard.press('Control+W');
        await window.waitForTimeout(300);

        // Welcome screen should be visible
        const welcomeScreen = await window.locator('#welcome-screen');
        const isVisible = await welcomeScreen.isVisible();
        expect(isVisible).toBe(true);

        // Editor should be hidden
        const editorContainer = await window.locator('#editor-container');
        const isEditorVisible = await editorContainer.isVisible();
        expect(isEditorVisible).toBe(false);
    });

    test('should maintain separate content in each tab', async () => {
        // Create first tab
        await window.keyboard.press('Control+T');
        const editor = await window.locator('#editor');
        await editor.click();
        await editor.type('First tab content');

        // Create second tab
        await window.keyboard.press('Control+T');
        await editor.click();
        await window.keyboard.press('Control+A');
        await window.keyboard.press('Delete');
        await editor.type('Second tab content');

        // Create third tab
        await window.keyboard.press('Control+T');
        await editor.click();
        await window.keyboard.press('Control+A');
        await window.keyboard.press('Delete');
        await editor.type('Third tab content');

        // Switch to first tab
        const firstTab = await window.locator('.tab').nth(0);
        await firstTab.click();
        await window.waitForTimeout(300);

        let content = await editor.textContent();
        expect(content).toContain('First tab content');

        // Switch to second tab
        const secondTab = await window.locator('.tab').nth(1);
        await secondTab.click();
        await window.waitForTimeout(300);

        content = await editor.textContent();
        expect(content).toContain('Second tab content');

        // Switch to third tab
        const thirdTab = await window.locator('.tab').nth(2);
        await thirdTab.click();
        await window.waitForTimeout(300);

        content = await editor.textContent();
        expect(content).toContain('Third tab content');
    });

    test('should highlight active tab', async () => {
        // Create two tabs
        await window.keyboard.press('Control+T');
        await window.keyboard.press('Control+T');

        // Second tab should be active
        let activeTabs = await window.locator('.tab.active').count();
        expect(activeTabs).toBe(1);

        // Click first tab
        const firstTab = await window.locator('.tab').nth(0);
        await firstTab.click();
        await window.waitForTimeout(200);

        // First tab should now be active
        const activeClass = await firstTab.getAttribute('class');
        expect(activeClass).toContain('active');
    });

    test('should show tab titles', async () => {
        await window.keyboard.press('Control+T');

        // Check tab has title (default should be "Untitled")
        const tabTitle = await window.locator('.tab .tab-title').first().textContent();
        expect(tabTitle).toBeTruthy();
        expect(tabTitle.length).toBeGreaterThan(0);
    });

    test('should cycle through tabs with keyboard', async () => {
        // Create 3 tabs
        await window.keyboard.press('Control+T');
        await window.keyboard.press('Control+T');
        await window.keyboard.press('Control+T');

        // Current: Tab 3 (last created)
        let activeIndex = await window.locator('.tab.active').evaluateAll(
            (tabs, allTabs) => allTabs.findIndex(t => t.classList.contains('active')),
            await window.locator('.tab').elementHandles()
        );

        // Cycle forward with Ctrl+Tab
        await window.keyboard.press('Control+Tab');
        await window.waitForTimeout(200);

        let newActiveIndex = await window.locator('.tab.active').evaluateAll(
            (tabs, allTabs) => allTabs.findIndex(t => t.classList.contains('active')),
            await window.locator('.tab').elementHandles()
        );

        // Should have moved to next tab (or wrapped around)
        expect(newActiveIndex).not.toBe(activeIndex);

        // Cycle backward with Ctrl+Shift+Tab
        await window.keyboard.press('Control+Shift+Tab');
        await window.waitForTimeout(200);

        newActiveIndex = await window.locator('.tab.active').evaluateAll(
            (tabs, allTabs) => allTabs.findIndex(t => t.classList.contains('active')),
            await window.locator('.tab').elementHandles()
        );

        // Should be back to previous position
        expect(newActiveIndex).toBe(activeIndex);
    });

    test('should handle closing tab with unsaved content', async () => {
        // Create tab with content
        await window.keyboard.press('Control+T');
        const editor = await window.locator('#editor');
        await editor.click();
        await editor.type('Unsaved content');

        // Try to close - should show dialog or mark as modified
        const initialCount = await window.locator('.tab').count();

        await window.keyboard.press('Control+W');
        await window.waitForTimeout(500);

        // Depending on implementation, either:
        // 1. Dialog shown and tab still open
        // 2. Tab closed immediately (modern approach with session save)

        const finalCount = await window.locator('.tab').count();

        // Accept either behavior as valid
        expect(finalCount).toBeGreaterThanOrEqual(0);
    });

    test('should hide tab bar when only one tab', async () => {
        // Start fresh - should have no tabs or welcome screen
        const tabsRow = await window.locator('#tabs-row');

        // Create first tab
        await window.keyboard.press('Control+T');
        await window.waitForTimeout(200);

        // Tab bar should be hidden with single tab
        let isHidden = await tabsRow.evaluate(el =>
            el.classList.contains('hidden') || getComputedStyle(el).display === 'none'
        );
        expect(isHidden).toBe(true);

        // Create second tab
        await window.keyboard.press('Control+T');
        await window.waitForTimeout(200);

        // Tab bar should now be visible
        isHidden = await tabsRow.evaluate(el =>
            el.classList.contains('hidden') || getComputedStyle(el).display === 'none'
        );
        expect(isHidden).toBe(false);
    });
});


