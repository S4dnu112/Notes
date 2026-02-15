/**
 * E2E Tests - Session Persistence
 * Tests: tabs, content, active tab, and modified state survive app restart
 */

const { test, expect, _electron: electron } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const os = require('os');

test.describe('Session Persistence E2E', () => {
    let testDir;
    let userDataDir;

    test.beforeEach(() => {
        testDir = path.join(os.tmpdir(), 'textimg-e2e-session-' + Date.now());
        fs.mkdirSync(testDir, { recursive: true });
        // Shared user data dir so session persists across app restarts
        userDataDir = path.join(os.tmpdir(), `textimg-test-session-${Date.now()}-${Math.random()}`);
    });

    test.afterEach(() => {
        if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true, force: true });
        if (fs.existsSync(userDataDir)) fs.rmSync(userDataDir, { recursive: true, force: true });
    });

    async function launchApp() {
        const electronApp = await electron.launch({
            args: [path.join(__dirname, '../../dist/main/main.js'), `--user-data-dir=${userDataDir}`],
            env: { ...process.env, NODE_ENV: 'test' }
        });
        const window = await electronApp.firstWindow();
        await window.waitForLoadState('domcontentloaded');
        return { electronApp, window };
    }

    test('session restore: tabs, content, and active tab survive restart', async () => {
        // --- First launch: create content ---
        let { electronApp, window } = await launchApp();
        const editor = window.locator('#editor');

        // Create Tab A with content
        await window.keyboard.press('Control+T');
        await window.waitForTimeout(300);
        await editor.click();
        await editor.type('Content for Tab A');
        await window.waitForTimeout(300);

        // Remember Tab A's title for later identification
        const tabATitle = await window.locator('.tab.active .tab-title').textContent();

        // Create Tab B with content
        await window.keyboard.press('Control+T');
        await window.waitForTimeout(300);
        await editor.click();
        await editor.type('Content for Tab B');
        await window.waitForTimeout(300);

        // Switch back to Tab A so it's the active tab
        const allTabs = window.locator('.tab');
        const tabCount = await allTabs.count();
        for (let i = 0; i < tabCount; i++) {
            const title = await allTabs.nth(i).locator('.tab-title').textContent();
            if (title === tabATitle) {
                await allTabs.nth(i).click();
                break;
            }
        }
        await window.waitForTimeout(500);

        // Verify Tab A is active and showing
        expect(await editor.textContent()).toContain('Content for Tab A');

        // Wait for debounced session save
        await window.waitForTimeout(1500);

        // Close app
        await electronApp.close();

        // --- Second launch: verify restore ---
        ({ electronApp, window } = await launchApp());
        await window.waitForTimeout(1500); // Allow session restore

        // Should have at least the 2 tabs we created (plus possibly the initial one)
        const restoredTabs = window.locator('.tab');
        expect(await restoredTabs.count()).toBeGreaterThanOrEqual(2);

        // Active tab should contain Tab A's content
        const restoredEditor = window.locator('#editor');
        const activeContent = await restoredEditor.textContent();
        expect(activeContent).toContain('Content for Tab A');

        // Find and switch to Tab B to verify its content
        const restoredTabCount = await restoredTabs.count();
        let foundTabB = false;
        for (let i = 0; i < restoredTabCount; i++) {
            await restoredTabs.nth(i).click();
            await window.waitForTimeout(400);
            const content = await restoredEditor.textContent();
            if (content.includes('Content for Tab B')) {
                foundTabB = true;
                break;
            }
        }
        expect(foundTabB).toBe(true);

        await electronApp.close();
    });

    test('session restore: modified state preserved', async () => {
        const testFilePath = path.join(testDir, 'session-mod-test.txti');

        // --- First launch: save then modify ---
        let { electronApp, window } = await launchApp();

        // Mock save dialog
        await electronApp.evaluate(async ({ dialog }, filePath) => {
            dialog.showSaveDialog = async () => ({ canceled: false, filePath: filePath });
        }, testFilePath);

        const editor = window.locator('#editor');

        // Create tab, type, save
        await window.keyboard.press('Control+T');
        await window.waitForTimeout(300);
        await editor.click();
        await editor.type('Saved content');
        await window.keyboard.press('Control+S');
        await window.waitForTimeout(1000);

        // Verify clean state
        expect(await window.locator('.tab.active.modified').count()).toBe(0);

        // Edit again to make it modified
        await editor.type(' plus edits');
        await window.waitForTimeout(500);

        // Verify modified state
        expect(await window.locator('.tab.active.modified').count()).toBe(1);

        // Wait for session save
        await window.waitForTimeout(1500);
        await electronApp.close();

        // --- Second launch: verify modified state ---
        ({ electronApp, window } = await launchApp());
        await window.waitForTimeout(1500);

        // Find the tab with our content
        const restoredTabs = window.locator('.tab');
        const restoredEditor = window.locator('#editor');
        const tabCount = await restoredTabs.count();
        let foundModifiedTab = false;

        for (let i = 0; i < tabCount; i++) {
            await restoredTabs.nth(i).click();
            await window.waitForTimeout(400);
            const content = await restoredEditor.textContent();
            if (content.includes('Saved content')) {
                // This tab should be modified
                const isModified = await restoredTabs.nth(i).evaluate(
                    el => el.classList.contains('modified')
                );
                expect(isModified).toBe(true);
                foundModifiedTab = true;
                break;
            }
        }
        expect(foundModifiedTab).toBe(true);

        await electronApp.close();
    });
});
