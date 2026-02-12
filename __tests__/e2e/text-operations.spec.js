
/**
 * E2E Tests - Text Operations
 * Tests: plain text paste (stripping HTML), disabled shortcuts
 */

const { test, expect, _electron: electron } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const os = require('os');

test.describe('Text Operations E2E', () => {
    let electronApp;
    let window;
    let testDir;

    test.beforeEach(async () => {
        testDir = path.join(os.tmpdir(), 'textimg-e2e-text-' + Date.now());
        fs.mkdirSync(testDir, { recursive: true });

        const uniqueUserDataDir = path.join(os.tmpdir(), `textimg-test-data-text-${Date.now()}-${Math.random()}`);
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

    test('should paste plain text only (strip HTML)', async () => {
        await window.keyboard.press('Control+T');
        const editor = await window.locator('#editor');
        await editor.click();

        // Simulate HTML clipboard content via Electron clipboard API
        // We write HTML but expect only text to be pasted
        await electronApp.evaluate(async ({ clipboard }) => {
            clipboard.write({
                text: 'Plain Text',
                html: '<b style="color: red;">Bold Text</b>'
            });
        });

        await window.waitForTimeout(200);
        await window.keyboard.press('Control+V');
        await window.waitForTimeout(500);

        // Content should match what "paste" handler extracts.
        // The handler uses clipboardData.getData('text/plain').
        // If we write both, standard behavior prefers 'text/plain' if we ask for it.
        // Tests verify that we explicitly ask for 'text/plain'.

        const content = await editor.innerText();
        // If HTML was pasted, we might see no tags (contenteditable handles it) but style might be applied.
        // We check that NO HTML tags are present in innerHTML
        const innerHTML = await editor.innerHTML();

        expect(innerHTML).not.toContain('<b style="color: red;">');
        expect(innerHTML).not.toContain('Bold Text'); // Wait, if it strips, it should keep the text 'Bold Text' but remove <b>?
        // Actually, our logic in Editor.ts:
        // const text = clipboardData.getData('text/plain');
        // document.execCommand('insertText', false, text);

        // So it should insert 'Plain Text' (value of text property) NOT 'Bold Text' (value of html property).
        // Let's verify what `clipboard.write` does. It sets both.
        // `getData('text/plain')` should retrieve the 'text' field.

        expect(content).toContain('Plain Text');
        expect(content).not.toContain('Bold Text');
    });

    test('should disable rich text formatting shortcuts', async () => {
        await window.keyboard.press('Control+T');
        const editor = await window.locator('#editor');
        await editor.click();
        await editor.type('Test Selection');

        // Select all
        await window.keyboard.press('Control+A');

        // Try Bold (Ctrl+B)
        await window.keyboard.press('Control+b');
        await window.waitForTimeout(200);

        // Try Italic (Ctrl+I)
        await window.keyboard.press('Control+i');
        await window.waitForTimeout(200);

        // Try Underline (Ctrl+U)
        await window.keyboard.press('Control+u');
        await window.waitForTimeout(200);

        // Verify no <b>, <i>, <u> tags or styles
        const innerHTML = await editor.innerHTML();
        expect(innerHTML).not.toContain('<b>');
        expect(innerHTML).not.toContain('<i>');
        expect(innerHTML).not.toContain('<u>');
        expect(innerHTML).not.toContain('font-weight: bold');
        expect(innerHTML).not.toContain('font-style: italic');
        expect(innerHTML).not.toContain('text-decoration: underline');
    });
});
