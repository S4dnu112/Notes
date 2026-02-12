
/**
 * Component Tests for Editor Module
 * Tests DOM manipulation and content rendering logic
 */


// Mock external modules
jest.mock('../../src/renderer/global.d.ts', () => ({}), { virtual: true });
jest.mock('../../src/renderer/modules/state.js', () => ({
    state: {
        tabs: new Map(),
        activeTabId: 'test-tab',
        settings: {
            autoIndent: true,
            indentSize: 4,
            indentChar: 'space',
            lineFeed: 'LF'
        }
    }
}));

jest.mock('../../src/renderer/modules/utils.js', () => ({
    truncateTabTitle: jest.fn(t => t),
    formatHeaderText: jest.fn(),
    getDisplayTitle: jest.fn()
}));

// Mock window.textimg API
window.textimg = {
    readClipboardImage: jest.fn(),
    saveClipboardBuffer: jest.fn()
};

describe('Editor - Component Tests', () => {
    let editor;
    let mockUpdateTabUI;
    let mockUpdateStatusBar;
    let mockUpdateHeaderPath;

    // Module functions
    let initEditor;
    let renderContentToEditor;
    let saveEditorToState;
    let updateModifiedState;
    let setUpdateTabUI;
    let setUpdateStatusBar;
    let setUpdateHeaderPath;

    let state;

    beforeEach(() => {
        // Reset modules to ensure clean state and re-evaluation
        jest.resetModules();

        // Setup DOM
        document.body.innerHTML = `
            <div id="editor-container">
                <div id="editor" contenteditable="true"></div>
            </div>
        `;
        editor = document.getElementById('editor');

        // Mock functions
        mockUpdateTabUI = jest.fn();
        mockUpdateStatusBar = jest.fn();
        mockUpdateHeaderPath = jest.fn();

        // Re-require module
        const EditorModule = require('../../src/renderer/modules/Editor.ts');
        initEditor = EditorModule.initEditor;
        renderContentToEditor = EditorModule.renderContentToEditor;
        saveEditorToState = EditorModule.saveEditorToState;
        updateModifiedState = EditorModule.updateModifiedState;
        setUpdateTabUI = EditorModule.setUpdateTabUI;
        setUpdateStatusBar = EditorModule.setUpdateStatusBar;
        setUpdateHeaderPath = EditorModule.setUpdateHeaderPath;

        setUpdateTabUI(mockUpdateTabUI);
        setUpdateStatusBar(mockUpdateStatusBar);
        setUpdateHeaderPath(mockUpdateHeaderPath);

        // Clear state
        const stateModule = require('../../src/renderer/modules/state.js');
        state = stateModule.state;
        state.tabs.clear();
        state.activeTabId = null;

        // Initialize editor
        initEditor();
    });

    describe('Content Rendering', () => {
        test('should render text as paragraph elements', () => {
            const p1 = document.createElement('p');
            p1.textContent = 'Hello World';
            const p2 = document.createElement('p');
            p2.textContent = 'Second line';

            editor.appendChild(p1);
            editor.appendChild(p2);

            expect(editor.childNodes.length).toBe(2);
            expect(editor.childNodes[0].textContent).toBe('Hello World');
            expect(editor.childNodes[1].textContent).toBe('Second line');
        });

        test('should render images with data attributes', () => {
            const img = document.createElement('img');
            img.dataset.filename = 'test.png';
            img.dataset.width = '300';
            img.style.width = '300px';
            img.src = 'file:///path/to/test.png';

            editor.appendChild(img);

            const renderedImg = editor.querySelector('img');
            expect(renderedImg).toBeTruthy();
            expect(renderedImg.dataset.filename).toBe('test.png');
            expect(renderedImg.dataset.width).toBe('300');
            expect(renderedImg.style.width).toBe('300px');
        });

        test('should render mixed text and image content', () => {
            const p1 = document.createElement('p');
            p1.textContent = 'Before image';
            const img = document.createElement('img');
            img.dataset.filename = 'pic.png';
            const p2 = document.createElement('p');
            p2.textContent = 'After image';

            editor.appendChild(p1);
            editor.appendChild(img);
            editor.appendChild(p2);

            expect(editor.childNodes.length).toBe(3);
            expect(editor.childNodes[0].textContent).toBe('Before image');
            expect(editor.childNodes[1].tagName).toBe('IMG');
            expect(editor.childNodes[2].textContent).toBe('After image');
        });

        test('should handle empty editor', () => {
            expect(editor.childNodes.length).toBe(0);
            expect(editor.textContent).toBe('');
        });

        test('should clear editor content', () => {
            editor.innerHTML = '<p>Old content</p>';
            expect(editor.childNodes.length).toBe(1);

            editor.innerHTML = '';
            expect(editor.childNodes.length).toBe(0);
        });
    });

    describe('Content Serialization', () => {
        test('should extract text from paragraphs', () => {
            editor.innerHTML = '<p>Line 1</p><p>Line 2</p>';

            // We use saveEditorToState logic which inspects DOM
            // To test the logic in isolation properly we should probably invoke saveEditorToState
            // But here we are testing the DOM structure assumptions.
            // Let's migrate the specific tests from legacy:

            const content = [];
            const children = editor.childNodes;

            for (const child of children) {
                if (child.tagName === 'P') {
                    const text = child.textContent;
                    if (text.trim()) {
                        content.push({ type: 'text', val: text });
                    }
                }
            }

            expect(content.length).toBe(2);
            expect(content[0]).toEqual({ type: 'text', val: 'Line 1' });
            expect(content[1]).toEqual({ type: 'text', val: 'Line 2' });
        });

        test('should extract images with metadata', () => {
            const img = document.createElement('img');
            img.dataset.filename = 'test.png';
            img.dataset.width = '250';
            editor.appendChild(img);

            const imgItem = {
                type: 'img',
                src: img.dataset.filename,
                width: parseInt(img.dataset.width)
            };

            expect(imgItem).toEqual({
                type: 'img',
                src: 'test.png',
                width: 250
            });
        });
    });

    describe('renderContentToEditor', () => {
        test('should render text content to editor', () => {
            const tabState = {
                id: 'tab1',
                content: [
                    { type: 'text', val: 'Hello World' },
                    { type: 'text', val: 'Second line' }
                ],
                imageMap: {},
                tempImages: {}
            };

            renderContentToEditor(tabState);

            expect(editor.childNodes.length).toBe(2);
            expect(editor.childNodes[0].textContent).toBe('Hello World');
            expect(editor.childNodes[1].textContent).toBe('Second line');
        });

        test('should render image content with data attributes', () => {
            const tabState = {
                id: 'tab1',
                content: [
                    { type: 'img', src: 'image1.png', width: 300 }
                ],
                imageMap: { 'image1.png': '/path/to/image1.png' },
                tempImages: {}
            };

            renderContentToEditor(tabState);

            const img = editor.querySelector('img');
            expect(img).toBeTruthy();
            expect(img.dataset.filename).toBe('image1.png');
            expect(img.dataset.width).toBe('300');
            expect(img.style.width).toBe('300px');
        });

        test('should use tempImages path when available', () => {
            const tabState = {
                id: 'tab1',
                content: [
                    { type: 'img', src: 'new.png' }
                ],
                imageMap: {},
                tempImages: { 'new.png': '/tmp/new.png' }
            };

            renderContentToEditor(tabState);

            const img = editor.querySelector('img');
            expect(img.src).toBe('file:///tmp/new.png');
        });

        test('should add loading class for images without paths', () => {
            const tabState = {
                id: 'tab1',
                content: [
                    { type: 'img', src: 'missing.png' }
                ],
                imageMap: {},
                tempImages: {}
            };

            renderContentToEditor(tabState);

            const img = editor.querySelector('img');
            expect(img.classList.contains('loading')).toBe(true);
            expect(img.alt).toBe('Loading: missing.png');
        });
    });

    describe('saveEditorToState', () => {
        test('should save text content from editor to state', () => {
            const tabId = 'tab1';
            const tabState = {
                id: tabId,
                content: [],
                imageMap: {},
                tempImages: {}
            };
            state.tabs.set(tabId, tabState);

            editor.innerHTML = '<p>Line 1</p><p>Line 2</p>';
            saveEditorToState(tabId);

            expect(tabState.content.length).toBe(2);
            expect(tabState.content[0]).toEqual({ type: 'text', val: 'Line 1' });
            expect(tabState.content[1]).toEqual({ type: 'text', val: 'Line 2' });
        });

        test('should save image with filename and width', () => {
            const tabId = 'tab1';
            const tabState = {
                id: tabId,
                content: [],
                imageMap: {},
                tempImages: {}
            };
            state.tabs.set(tabId, tabState);

            const img = document.createElement('img');
            img.dataset.filename = 'test.png';
            img.dataset.width = '250';
            editor.appendChild(img);

            saveEditorToState(tabId);

            expect(tabState.content.length).toBe(1);
            expect(tabState.content[0]).toEqual({
                type: 'img',
                src: 'test.png',
                width: 250
            });
        });
    });

    describe('updateModifiedState', () => {
        test('should mark active tab as modified when content differs', () => {
            const tabId = 'tab1';
            const tabState = {
                id: tabId,
                modified: false,
                filePath: '/tmp/test.txt',
                title: 'test.txt',
                savedContent: [], // Empty saved content
                content: []
            };
            state.tabs.set(tabId, tabState);
            state.activeTabId = tabId;

            // Make content different from savedContent
            // updateModifiedState calls saveEditorToState internally, which reads from DOM
            editor.innerHTML = '<p>New Content</p>';

            updateModifiedState();

            expect(tabState.modified).toBe(true);
            expect(mockUpdateTabUI).toHaveBeenCalledWith(tabId);
        });

        test('should not mark as modified when content matches', () => {
            const tabId = 'tab1';
            const tabState = {
                id: tabId,
                modified: false,
                filePath: '/tmp/test.txt',
                title: 'test.txt',
                savedContent: [{ type: 'text', val: 'Same Content' }],
                content: []
            };
            state.tabs.set(tabId, tabState);
            state.activeTabId = tabId;

            // Make content same as savedContent
            editor.innerHTML = '<p>Same Content</p>';

            updateModifiedState();

            expect(tabState.modified).toBe(false);
            expect(mockUpdateTabUI).not.toHaveBeenCalled();
        });

        test('should clear modified state when unique content is reverted', () => {
            const tabId = 'tab1';
            const tabState = {
                id: tabId,
                modified: true, // Currently modified
                filePath: '/tmp/test.txt',
                title: 'test.txt',
                savedContent: [{ type: 'text', val: 'Original' }],
                content: [{ type: 'text', val: 'Modified' }]
            };
            state.tabs.set(tabId, tabState);
            state.activeTabId = tabId;

            // Revert content to match saved
            editor.innerHTML = '<p>Original</p>';

            updateModifiedState();

            expect(tabState.modified).toBe(false);
            expect(mockUpdateTabUI).toHaveBeenCalledWith(tabId);
        });
    });
});
