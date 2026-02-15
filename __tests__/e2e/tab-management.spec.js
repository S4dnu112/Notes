/**
 * E2E Tests - Tab Management (Consolidated)
 * Tests: tab creation, switching, closing, content isolation, keyboard navigation
 */

const { test, expect, _electron: electron } = require('@playwright/test');
const path = require('path');
const os = require('os');

test.describe('Tab Management E2E', () => {
    let electronApp;
    let window;

    test.beforeEach(async () => {
        const uniqueUserDataDir = path.join(os.tmpdir(), `textimg-test-data-${Date.now()}-${Math.random()}`);
        electronApp = await electron.launch({
            args: [path.join(__dirname, '../../dist/main/main.js'), `--user-data-dir=${uniqueUserDataDir}`]
        });
        window = await electronApp.firstWindow();
        await window.waitForLoadState('domcontentloaded');
    });

    test.afterEach(async () => {
        if (electronApp) await electronApp.close();
    });

    test('tab lifecycle: create, switch, close, welcome screen, tab bar visibility', async () => {
        const tabsRow = await window.locator('#tabs-row');
        const editor = await window.locator('#editor');

        // Initially 1 tab - bar should be hidden
        let isHidden = await tabsRow.evaluate(el =>
            el.classList.contains('hidden') || getComputedStyle(el).display === 'none'
        );
        expect(isHidden).toBe(true);

        // Create tabs
        await window.keyboard.press('Control+T');
        await window.waitForTimeout(200);
        await window.keyboard.press('Control+T');
        await window.waitForTimeout(200);
        await window.keyboard.press('Control+T');
        await window.waitForTimeout(200);

        // Tab bar should be visible with multiple tabs
        isHidden = await tabsRow.evaluate(el =>
            el.classList.contains('hidden') || getComputedStyle(el).display === 'none'
        );
        expect(isHidden).toBe(false);

        // Verify multiple tabs exist
        let tabs = await window.locator('.tab');
        expect(await tabs.count()).toBeGreaterThanOrEqual(3);

        // Only one tab should be active
        let activeTabs = await window.locator('.tab.active').count();
        expect(activeTabs).toBe(1);

        // Tab should have a title
        const tabTitle = await window.locator('.tab .tab-title').first().textContent();
        expect(tabTitle).toBeTruthy();

        // Click another tab to switch
        const firstTab = tabs.first();
        await firstTab.click();
        await window.waitForTimeout(200);

        // Verify it's now active
        const firstTabClass = await firstTab.getAttribute('class');
        expect(firstTabClass).toContain('active');

        // Close tabs until only welcome screen
        let tabCount = await window.locator('.tab').count();
        while (tabCount > 0) {
            await window.keyboard.press('Control+W');
            await window.waitForTimeout(300);
            tabCount = await window.locator('.tab').count();
        }

        // Welcome screen should be visible
        const welcomeScreen = await window.locator('#welcome-screen');
        expect(await welcomeScreen.isVisible()).toBe(true);

        // Editor should be hidden
        const editorContainer = await window.locator('#editor-container');
        expect(await editorContainer.isVisible()).toBe(false);
    });

    test('content isolation: each tab maintains separate content', async () => {
        // Mock dialog to auto-discard any unsaved changes
        await electronApp.evaluate(async ({ dialog }) => {
            dialog.showMessageBox = async () => ({ response: 1 });
        });

        const editor = await window.locator('#editor');

        // Create tabs with different content
        await window.keyboard.press('Control+T');
        await window.waitForTimeout(200);
        await editor.click();
        await editor.type('Content for Tab A');

        await window.keyboard.press('Control+T');
        await window.waitForTimeout(200);
        await editor.click();
        await editor.type('Content for Tab B');

        await window.keyboard.press('Control+T');
        await window.waitForTimeout(200);
        await editor.click();
        await editor.type('Content for Tab C');

        // Get tab positions
        const totalTabs = await window.locator('.tab').count();

        // Switch to Tab A and verify content
        const tabA = await window.locator('.tab').nth(totalTabs - 3);
        await tabA.click();
        await window.waitForTimeout(300);
        expect(await editor.textContent()).toContain('Content for Tab A');

        // Switch to Tab B and verify content
        const tabB = await window.locator('.tab').nth(totalTabs - 2);
        await tabB.click();
        await window.waitForTimeout(300);
        expect(await editor.textContent()).toContain('Content for Tab B');

        // Switch to Tab C and verify content
        const tabC = await window.locator('.tab').nth(totalTabs - 1);
        await tabC.click();
        await window.waitForTimeout(300);
        expect(await editor.textContent()).toContain('Content for Tab C');
    });

});
