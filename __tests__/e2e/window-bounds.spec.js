/**
 * E2E Tests - Window Bounds Persistence
 * Tests: window size persists across restarts via settings.json
 */

const { test, expect, _electron: electron } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const os = require('os');

test.describe('Window Bounds Persistence E2E', () => {
    let userDataDir;

    test.beforeEach(() => {
        userDataDir = path.join(os.tmpdir(), `textimg-test-bounds-${Date.now()}-${Math.random()}`);
    });

    test.afterEach(() => {
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

    test('window bounds persist across restarts', async () => {
        const TARGET_WIDTH = 900;
        const TARGET_HEIGHT = 600;

        // --- First launch: resize window ---
        let { electronApp, window } = await launchApp();

        // Resize window to target dimensions
        await electronApp.evaluate(({ BrowserWindow }, { w, h }) => {
            const win = BrowserWindow.getAllWindows()[0];
            win.setSize(w, h);
        }, { w: TARGET_WIDTH, h: TARGET_HEIGHT });

        // Wait for debounced save (500ms debounce + buffer)
        await window.waitForTimeout(1500);

        // Verify settings file was written with bounds
        const settingsPath = path.join(userDataDir, 'settings.json');
        expect(fs.existsSync(settingsPath)).toBe(true);

        const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
        expect(settings.windowBounds).toBeDefined();
        expect(settings.windowBounds.width).toBeGreaterThanOrEqual(TARGET_WIDTH - 50);
        expect(settings.windowBounds.width).toBeLessThanOrEqual(TARGET_WIDTH + 50);
        expect(settings.windowBounds.height).toBeGreaterThanOrEqual(TARGET_HEIGHT - 50);
        expect(settings.windowBounds.height).toBeLessThanOrEqual(TARGET_HEIGHT + 50);

        await electronApp.close();

        // --- Second launch: verify window uses saved bounds ---
        ({ electronApp, window } = await launchApp());
        await window.waitForTimeout(500);

        // Read the actual window size
        const bounds = await electronApp.evaluate(({ BrowserWindow }) => {
            const win = BrowserWindow.getAllWindows()[0];
            return win.getBounds();
        });

        // Should be approximately our target size (WM may adjust slightly)
        expect(bounds.width).toBeGreaterThanOrEqual(TARGET_WIDTH - 50);
        expect(bounds.width).toBeLessThanOrEqual(TARGET_WIDTH + 50);
        expect(bounds.height).toBeGreaterThanOrEqual(TARGET_HEIGHT - 50);
        expect(bounds.height).toBeLessThanOrEqual(TARGET_HEIGHT + 50);

        await electronApp.close();
    });
});
