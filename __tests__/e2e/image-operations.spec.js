/**
 * E2E Tests - Image Operations (Consolidated)
 * Tests: paste image, save/restore with images, tab switching with images
 */

const { test, expect, _electron: electron } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { PNG } = require('pngjs');

function createTestImage(width = 100, height = 100, color = { r: 255, g: 0, b: 0, a: 255 }) {
    const png = new PNG({ width, height });
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = (width * y + x) << 2;
            png.data[idx] = color.r;
            png.data[idx + 1] = color.g;
            png.data[idx + 2] = color.b;
            png.data[idx + 3] = color.a;
        }
    }
    return PNG.sync.write(png);
}

test.describe('Image Operations E2E', () => {
    let electronApp;
    let window;
    let testDir;

    test.beforeEach(async () => {
        testDir = path.join(os.tmpdir(), 'textimg-e2e-images-' + Date.now());
        fs.mkdirSync(testDir, { recursive: true });

        const uniqueUserDataDir = path.join(os.tmpdir(), `textimg-test-data-images-${Date.now()}-${Math.random()}`);
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

    test('image lifecycle: paste, save, restore, verify rendering', async () => {
        const testFilePath = path.join(testDir, 'with-image.txti');

        await window.keyboard.press('Control+T');
        await window.waitForTimeout(300);

        const editor = await window.locator('#editor');
        await editor.click();
        await editor.type('Document with image');
        await window.keyboard.press('Enter');

        // Paste image
        const testImageBuffer = createTestImage(60, 60, { r: 0, g: 255, b: 0, a: 255 });
        await electronApp.evaluate(async ({ clipboard, nativeImage }, imageBuffer) => {
            const image = nativeImage.createFromBuffer(Buffer.from(imageBuffer));
            clipboard.writeImage(image);
        }, Array.from(testImageBuffer));

        await window.waitForTimeout(200);
        await window.keyboard.press('Control+V');
        await window.waitForTimeout(500);

        // Verify image is in editor
        let images = await editor.locator('img');
        expect(await images.count()).toBe(1);

        const imgSrc = await images.first().getAttribute('src');
        expect(imgSrc).toMatch(/^file:\/\//);

        const imgFilename = await images.first().getAttribute('data-filename');
        expect(imgFilename).toMatch(/\.png$/);

        // Document should be marked modified
        const modifiedIndicator = await window.locator('.tab.active.modified');
        expect(await modifiedIndicator.count()).toBeGreaterThan(0);

        // Save the file
        await electronApp.evaluate(async ({ dialog }, filePath) => {
            dialog.showSaveDialog = async () => ({ canceled: false, filePath: filePath });
        }, testFilePath);

        await window.keyboard.press('Control+S');
        await window.waitForTimeout(1000);
        expect(fs.existsSync(testFilePath)).toBe(true);

        // Close and reopen
        await window.keyboard.press('Control+W');
        await window.waitForTimeout(300);

        await electronApp.evaluate(async ({ dialog }, filePath) => {
            dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [filePath] });
        }, testFilePath);

        await window.keyboard.press('Control+O');
        await window.waitForTimeout(1500);

        // Verify content and image restored
        expect(await editor.textContent()).toContain('Document with image');

        images = await editor.locator('img');
        expect(await images.count()).toBe(1);

        const restoredSrc = await images.first().getAttribute('src');
        expect(restoredSrc).toMatch(/^file:\/\//);

        // Verify image is rendered (not in loading state)
        const imgAlt = await images.first().getAttribute('alt');
        if (imgAlt) expect(imgAlt).not.toContain('Loading:');
    });

    test('image preserved after tab switch', async () => {
        await window.keyboard.press('Control+T');
        await window.waitForTimeout(300);

        const editor = await window.locator('#editor');
        await editor.click();
        await editor.type('Tab with image');

        // Paste image
        const testImageBuffer = createTestImage(30, 30, { r: 255, g: 255, b: 0, a: 255 });
        await electronApp.evaluate(async ({ clipboard, nativeImage }, imageBuffer) => {
            const image = nativeImage.createFromBuffer(Buffer.from(imageBuffer));
            clipboard.writeImage(image);
        }, Array.from(testImageBuffer));

        await window.waitForTimeout(200);
        await window.keyboard.press('Control+V');
        await window.waitForTimeout(500);

        let images = await editor.locator('img');
        expect(await images.count()).toBe(1);
        const originalSrc = await images.first().getAttribute('src');

        // Remember tab info
        const initialTabCount = await window.locator('.tab').count();
        const imageTabTitle = await window.locator('.tab.active .tab-title').textContent();

        // Create second tab
        await window.keyboard.press('Control+T');
        await window.waitForTimeout(500);
        expect(await window.locator('.tab').count()).toBe(initialTabCount + 1);

        await editor.click();
        await editor.type('Tab without image');
        await window.waitForTimeout(300);

        // Switch back to image tab
        const allTabs = await window.locator('.tab');
        const tabCount = await allTabs.count();
        for (let i = 0; i < tabCount; i++) {
            const title = await allTabs.nth(i).locator('.tab-title').textContent();
            if (title === imageTabTitle) {
                await allTabs.nth(i).click();
                break;
            }
        }
        await window.waitForTimeout(500);

        // Verify image is still there
        images = await editor.locator('img');
        expect(await images.count()).toBe(1);
        expect(await images.first().getAttribute('src')).toBe(originalSrc);
    });
});
