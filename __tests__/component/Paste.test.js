/**
 * Component Tests for Paste Logic
 */

describe('Editor - Paste Tests', () => {
    let editor;
    let EditorModule;

    beforeEach(() => {
        // Setup DOM in the existing jsdom environment
        document.body.innerHTML = '<div id="editor-container"><div id="editor" contenteditable="true"></div></div>';
        editor = document.getElementById('editor');

        // Mock window.textimg
        window.textimg = {
            readClipboardImage: jest.fn(),
            saveClipboardBuffer: jest.fn().mockResolvedValue({ success: true, filename: 'img.png', filePath: '/tmp/img.png' })
        };

        // Mock execCommand
        document.execCommand = jest.fn();

        // Re-import module to attach listeners to new DOM
        jest.resetModules();

        // Mock other dependencies if needed
        jest.mock('../../src/renderer/modules/state', () => ({
            state: {
                tabs: new Map([['tab1', { tempImages: {}, imageMap: {} }]]),
                activeTabId: 'tab1',
                settings: { autoIndent: true, indentChar: 'space', indentSize: 4 }
            }
        }));

        jest.mock('../../src/renderer/modules/utils', () => ({
            truncateTabTitle: jest.fn(),
            formatHeaderText: jest.fn(),
            getDisplayTitle: jest.fn()
        }));

        EditorModule = require('../../src/renderer/modules/Editor.ts');
        EditorModule.initEditor();
    });

    afterEach(() => {
        jest.resetAllMocks();
        document.body.innerHTML = '';
    });

    function createPasteEvent(clipboardDataInit) {
        const event = new Event('paste', { bubbles: true, cancelable: true });
        Object.defineProperty(event, 'clipboardData', {
            value: clipboardDataInit,
            writable: false
        });
        return event;
    }

    test('should paste plain text and strip HTML', () => {
        // Mock ClipboardData
        const mockGetData = jest.fn((format) => {
            if (format === 'text/plain') return 'Plain Text';
            if (format === 'text/html') return '<b>Bold Text</b>';
            return '';
        });

        const event = createPasteEvent({
            getData: mockGetData,
            items: [],
            types: ['text/plain', 'text/html']
        });

        // Spy on preventDefault
        const preventDefaultSpy = jest.spyOn(event, 'preventDefault');

        editor.dispatchEvent(event);

        expect(preventDefaultSpy).toHaveBeenCalled();
        expect(mockGetData).toHaveBeenCalledWith('text/plain');
        expect(document.execCommand).toHaveBeenCalledWith('insertText', false, 'Plain Text');
    });

    test('should handle image paste', async () => {
        // Mock ClipboardItem
        const mockItem = {
            type: 'image/png',
            kind: 'file',
            getAsFile: () => {
                const file = new window.File([''], 'image.png', { type: 'image/png' });
                file.arrayBuffer = jest.fn().mockResolvedValue(new ArrayBuffer(8));
                return file;
            }
        };

        const event = createPasteEvent({
            getData: () => '',
            items: [mockItem],
            types: ['image/png']
        });

        const preventDefaultSpy = jest.spyOn(event, 'preventDefault');

        await editor.dispatchEvent(event);

        expect(preventDefaultSpy).toHaveBeenCalled();
        expect(window.textimg.saveClipboardBuffer).toHaveBeenCalled();
    });

    test('should fallback to native clipboard image if no items', async () => {
        window.textimg.readClipboardImage.mockResolvedValue(new ArrayBuffer(8));

        const event = createPasteEvent({
            getData: () => '',
            items: [],
            types: []
        });

        await editor.dispatchEvent(event);

        expect(window.textimg.readClipboardImage).toHaveBeenCalled();
        expect(window.textimg.saveClipboardBuffer).toHaveBeenCalled();
    });

    test('should only paste one image when multiple image items are present', async () => {
        // Mock two image items
        const mockItem1 = {
            type: 'image/png',
            kind: 'file',
            getAsFile: () => {
                const file = new window.File([''], 'image1.png', { type: 'image/png' });
                file.arrayBuffer = jest.fn().mockResolvedValue(new ArrayBuffer(8));
                return file;
            }
        };
        const mockItem2 = {
            type: 'image/jpeg',
            kind: 'file',
            getAsFile: () => {
                const file = new window.File([''], 'image2.jpg', { type: 'image/jpeg' });
                file.arrayBuffer = jest.fn().mockResolvedValue(new ArrayBuffer(8));
                return file;
            }
        };

        const event = createPasteEvent({
            getData: () => '',
            items: [mockItem1, mockItem2],
            types: ['image/png', 'image/jpeg']
        });

        // Spy on preventDefault
        const preventDefaultSpy = jest.spyOn(event, 'preventDefault');

        await editor.dispatchEvent(event);

        // Wait for async handler
        await new Promise(resolve => setTimeout(resolve, 0));
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(preventDefaultSpy).toHaveBeenCalled();
        // Should be called EXACTLY ONCE
        expect(window.textimg.saveClipboardBuffer).toHaveBeenCalledTimes(1);
    });
});
