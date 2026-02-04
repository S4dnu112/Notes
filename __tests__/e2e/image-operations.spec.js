/**
 * E2E Tests - Image Operations
 * Tests image pasting and rendering functionality
 */

const { test, expect, _electron: electron } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { PNG } = require('pngjs');

/**
 * Create a test PNG image buffer
 * @param {number} width 
 * @param {number} height 
 * @param {object} color - {r, g, b, a}
 * @returns {Buffer}
 */
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
        // Create test directory
        testDir = path.join(os.tmpdir(), 'teximg-e2e-images-' + Date.now());
        fs.mkdirSync(testDir, { recursive: true });

        // Launch Electron app
        const uniqueUserDataDir = path.join(os.tmpdir(), `teximg-test-data-images-${Date.now()}-${Math.random()}`);
        electronApp = await electron.launch({
            args: [path.join(__dirname, '../../dist/main/main.js'), `--user-data-dir=${uniqueUserDataDir}`],
            env: {
                ...process.env,
                NODE_ENV: 'test'
            }
        });

        // Get first window
        window = await electronApp.firstWindow();

        // Wait for app to be ready
        await window.waitForLoadState('domcontentloaded');
    });

    test.afterEach(async () => {
        // Close app
        if (electronApp) {
            await electronApp.close();
        }

        // Cleanup test directory
        if (fs.existsSync(testDir)) {
            fs.rmSync(testDir, { recursive: true, force: true });
        }
    });

    test('should paste image from clipboard', async () => {
        // Create a new tab
        await window.keyboard.press('Control+T').catch(() => { });
        await window.waitForTimeout(300);

        // Focus on editor
        const editor = await window.locator('#editor');
        await editor.click();

        // Create test image and write to clipboard using Electron's clipboard API
        const testImageBuffer = createTestImage(50, 50, { r: 255, g: 0, b: 0, a: 255 });

        await electronApp.evaluate(async ({ clipboard, nativeImage }, imageBuffer) => {
            const image = nativeImage.createFromBuffer(Buffer.from(imageBuffer));
            clipboard.writeImage(image);
        }, Array.from(testImageBuffer));

        // Wait a moment for clipboard to be ready
        await window.waitForTimeout(200);

        // Paste the image
        await window.keyboard.press('Control+V');

        // Wait for image to be inserted
        await window.waitForTimeout(500);

        // Check that an image element was added to the editor
        const images = await editor.locator('img');
        const imageCount = await images.count();
        expect(imageCount).toBe(1);

        // Verify image has a valid src attribute (file:// protocol)
        const imgSrc = await images.first().getAttribute('src');
        expect(imgSrc).toMatch(/^file:\/\//);

        // Verify image has a filename data attribute
        const imgFilename = await images.first().getAttribute('data-filename');
        expect(imgFilename).toBeTruthy();
        expect(imgFilename).toMatch(/\.png$/);
    });

    test('should save and restore image in document', async () => {
        const testFilePath = path.join(testDir, 'with-image.txti');

        // Create a new tab
        await window.keyboard.press('Control+T').catch(() => { });
        await window.waitForTimeout(300);

        const editor = await window.locator('#editor');
        await editor.click();

        // Add some text
        await editor.type('Document with image');
        await window.keyboard.press('Enter');

        // Paste an image
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

        // Save the file
        await electronApp.evaluate(async ({ dialog }, filePath) => {
            dialog.showSaveDialog = async () => ({
                canceled: false,
                filePath: filePath
            });
        }, testFilePath);

        await window.keyboard.press('Control+S');
        await window.waitForTimeout(1000);

        // Verify file was created
        expect(fs.existsSync(testFilePath)).toBe(true);

        // Close the tab
        await window.keyboard.press('Control+W');
        await window.waitForTimeout(300);

        // Reopen the file
        await electronApp.evaluate(async ({ dialog }, filePath) => {
            dialog.showOpenDialog = async () => ({
                canceled: false,
                filePaths: [filePath]
            });
        }, testFilePath);

        await window.keyboard.press('Control+O');
        await window.waitForTimeout(1500); // Extra time for image loading

        // Verify content is restored
        const content = await editor.textContent();
        expect(content).toContain('Document with image');

        // Verify image is restored and rendered (not showing "Loading:")
        images = await editor.locator('img');
        expect(await images.count()).toBe(1);

        const imgSrc = await images.first().getAttribute('src');
        expect(imgSrc).toMatch(/^file:\/\//);

        // Check that the image is not in a loading state
        const imgAlt = await images.first().getAttribute('alt');
        if (imgAlt) {
            expect(imgAlt).not.toContain('Loading:');
        }

        // Verify the image doesn't have the "loading" class
        const imgClass = await images.first().getAttribute('class');
        if (imgClass) {
            expect(imgClass).not.toContain('loading');
        }
    });

    test('should handle multiple images in document', async () => {
        await window.keyboard.press('Control+T').catch(() => { });
        await window.waitForTimeout(300);

        const editor = await window.locator('#editor');
        await editor.click();

        // Add text and first image
        await editor.type('First image:');
        await window.keyboard.press('Enter');

        const redImageBuffer = createTestImage(40, 40, { r: 255, g: 0, b: 0, a: 255 });
        await electronApp.evaluate(async ({ clipboard, nativeImage }, imageBuffer) => {
            const image = nativeImage.createFromBuffer(Buffer.from(imageBuffer));
            clipboard.writeImage(image);
        }, Array.from(redImageBuffer));

        await window.waitForTimeout(200);
        await window.keyboard.press('Control+V');
        await window.waitForTimeout(500);

        // Add second image
        await window.keyboard.press('Enter');
        await editor.type('Second image:');
        await window.keyboard.press('Enter');

        const blueImageBuffer = createTestImage(40, 40, { r: 0, g: 0, b: 255, a: 255 });
        await electronApp.evaluate(async ({ clipboard, nativeImage }, imageBuffer) => {
            const image = nativeImage.createFromBuffer(Buffer.from(imageBuffer));
            clipboard.writeImage(image);
        }, Array.from(blueImageBuffer));

        await window.waitForTimeout(200);
        await window.keyboard.press('Control+V');
        await window.waitForTimeout(500);

        // Verify both images are present
        const images = await editor.locator('img');
        const imageCount = await images.count();
        expect(imageCount).toBe(2);

        // Verify both have valid sources
        for (let i = 0; i < imageCount; i++) {
            const img = images.nth(i);
            const src = await img.getAttribute('src');
            expect(src).toMatch(/^file:\/\//);
        }
    });

    test('should preserve image after tab switch', async () => {
        // Create first tab with image
        await window.keyboard.press('Control+T').catch(() => { });
        await window.waitForTimeout(300);

        const editor = await window.locator('#editor');
        await editor.click();
        await editor.type('Tab 1 with image');

        // Paste image
        const testImageBuffer = createTestImage(30, 30, { r: 255, g: 255, b: 0, a: 255 });
        await electronApp.evaluate(async ({ clipboard, nativeImage }, imageBuffer) => {
            const image = nativeImage.createFromBuffer(Buffer.from(imageBuffer));
            clipboard.writeImage(image);
        }, Array.from(testImageBuffer));

        await window.waitForTimeout(200);
        await window.keyboard.press('Control+V');
        await window.waitForTimeout(500);

        // Verify image exists
        let images = await editor.locator('img');
        expect(await images.count()).toBe(1);
        const firstImageSrc = await images.first().getAttribute('src');

        // Get the current tab count and active tab (which has the image)
        const initialTabCount = await window.locator('.tab').count();
        const activeTabWithImage = await window.locator('.tab.active');
        const imageTabText = await activeTabWithImage.locator('.tab-title').textContent();

        // Create second tab
        await window.keyboard.press('Control+T');
        await window.waitForTimeout(500);

        // Verify we now have one more tab than before
        expect(await window.locator('.tab').count()).toBe(initialTabCount + 1);

        await editor.click();
        await editor.type('Tab 2 without image');
        await window.waitForTimeout(300);

        // Switch back to the tab with image by clicking on it directly
        // Find the tab that has our text
        const allTabs = await window.locator('.tab');
        const tabCount = await allTabs.count();
        let imageTab = null;
        for (let i = 0; i < tabCount; i++) {
            const tab = allTabs.nth(i);
            const title = await tab.locator('.tab-title').textContent();
            if (title === imageTabText) {
                imageTab = tab;
                break;
            }
        }
        expect(imageTab).not.toBeNull();
        await imageTab.click();
        await window.waitForTimeout(500);

        // Verify the correct tab is now active
        const activeTabTitle = await window.locator('.tab.active .tab-title').textContent();
        expect(activeTabTitle).toBe(imageTabText);

        // Verify image is still there with same src
        images = await editor.locator('img');
        expect(await images.count()).toBe(1);
        const restoredImageSrc = await images.first().getAttribute('src');
        expect(restoredImageSrc).toBe(firstImageSrc);
    });

    test('should mark document as modified after pasting image', async () => {
        // Create a saved file first
        const testFilePath = path.join(testDir, 'for-modification.txti');

        await window.keyboard.press('Control+T').catch(() => { });
        await window.waitForTimeout(300);

        const editor = await window.locator('#editor');
        await editor.click();
        await editor.type('Initial content');

        // Save the file
        await electronApp.evaluate(async ({ dialog }, filePath) => {
            dialog.showSaveDialog = async () => ({
                canceled: false,
                filePath: filePath
            });
        }, testFilePath);

        await window.keyboard.press('Control+S');
        await window.waitForTimeout(1000);

        // Verify not modified after save
        let modifiedIndicator = await window.locator('.tab.active.modified');
        expect(await modifiedIndicator.count()).toBe(0);

        // Paste an image
        const testImageBuffer = createTestImage(20, 20, { r: 128, g: 128, b: 128, a: 255 });
        await electronApp.evaluate(async ({ clipboard, nativeImage }, imageBuffer) => {
            const image = nativeImage.createFromBuffer(Buffer.from(imageBuffer));
            clipboard.writeImage(image);
        }, Array.from(testImageBuffer));

        await window.waitForTimeout(200);
        await window.keyboard.press('Control+V');
        await window.waitForTimeout(500);

        // Verify document is now marked as modified
        modifiedIndicator = await window.locator('.tab.active.modified');
        expect(await modifiedIndicator.count()).toBeGreaterThan(0);
    });
});

test.describe('Image Operations - Error Handling', () => {
    let electronApp;
    let window;
    let testDataDir;

    test.beforeEach(async () => {
        testDataDir = path.join(os.tmpdir(), `teximg-test-image-error-${Date.now()}-${Math.random()}`);

        electronApp = await electron.launch({
            args: [path.join(__dirname, '../../dist/main/main.js'), `--user-data-dir=${testDataDir}`]
        });
        window = await electronApp.firstWindow();
        await window.waitForLoadState('domcontentloaded');
    });

    test.afterEach(async () => {
        if (electronApp) {
            await electronApp.close();
        }

        if (testDataDir && fs.existsSync(testDataDir)) {
            try {
                fs.rmSync(testDataDir, { recursive: true, force: true });
            } catch (e) {
                console.error(`Failed to cleanup test data dir: ${testDataDir}`, e);
            }
        }
    });

    test('should handle empty clipboard gracefully', async () => {
        await window.keyboard.press('Control+T').catch(() => { });
        await window.waitForTimeout(300);

        const editor = await window.locator('#editor');
        await editor.click();

        // Clear clipboard
        await electronApp.evaluate(async ({ clipboard }) => {
            clipboard.clear();
        });

        await window.waitForTimeout(200);

        // Try to paste (should not crash)
        await window.keyboard.press('Control+V');
        await window.waitForTimeout(300);

        // App should still be running
        const isClosed = await window.isClosed();
        expect(isClosed).toBe(false);

        // No images should be added
        const images = await editor.locator('img');
        expect(await images.count()).toBe(0);
    });

    test('should handle text paste when no image in clipboard', async () => {
        await window.keyboard.press('Control+T').catch(() => { });
        await window.waitForTimeout(300);

        const editor = await window.locator('#editor');
        await editor.click();

        // Put text in clipboard
        await electronApp.evaluate(async ({ clipboard }) => {
            clipboard.writeText('Plain text content');
        });

        await window.waitForTimeout(200);

        // Paste text
        await window.keyboard.press('Control+V');
        await window.waitForTimeout(300);

        // Should paste as text, not image
        const content = await editor.textContent();
        expect(content).toContain('Plain text content');

        const images = await editor.locator('img');
        expect(await images.count()).toBe(0);
    });
});
