// const { JSDOM } = require('jsdom'); // Removed manual import
const path = require('path');

// Mock specific modules before importing the module under test
jest.mock('../../src/renderer/global.d.ts', () => ({}), { virtual: true });

// Mock state module
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

// Mock utils module
jest.mock('../../src/renderer/modules/utils.js', () => ({
    truncateTabTitle: jest.fn(t => t),
    formatHeaderText: jest.fn(),
    getDisplayTitle: jest.fn()
}));

describe('Editor - Shortcut Tests', () => {
    let editor;
    // We need to access the module scope to trigger initEditor, 
    // but the events are attached to the DOM element.
    // We can just rely on side-effects if we import it after DOM setup.

    beforeEach(() => {
        // Reset modules to ensure clean state
        jest.resetModules();

        // Setup DOM
        document.body.innerHTML = `
            <div id="editor-container">
                <div id="editor" contenteditable="true"></div>
            </div>
        `;
        editor = document.getElementById('editor');

        // Initializing the editor module attaches the event listeners
        const EditorModule = require('../../src/renderer/modules/Editor.ts');
        EditorModule.initEditor();
    });

    const createKeyboardEvent = (key, ctrlKey = false, metaKey = false) => {
        return new KeyboardEvent('keydown', {
            key: key,
            code: `Key${key.toUpperCase()}`,
            ctrlKey: ctrlKey,
            metaKey: metaKey,
            bubbles: true,
            cancelable: true
        });
    };

    test('should prevent default for Ctrl+B', () => {
        const event = createKeyboardEvent('b', true);
        const preventDefaultSpy = jest.spyOn(event, 'preventDefault');

        editor.dispatchEvent(event);

        expect(preventDefaultSpy).toHaveBeenCalled();
    });

    test('should prevent default for Ctrl+I', () => {
        const event = createKeyboardEvent('i', true);
        const preventDefaultSpy = jest.spyOn(event, 'preventDefault');

        editor.dispatchEvent(event);

        expect(preventDefaultSpy).toHaveBeenCalled();
    });

    test('should prevent default for Ctrl+U', () => {
        const event = createKeyboardEvent('u', true);
        const preventDefaultSpy = jest.spyOn(event, 'preventDefault');

        editor.dispatchEvent(event);

        expect(preventDefaultSpy).toHaveBeenCalled();
    });

    test('should prevent default for Cmd+B (Mac)', () => {
        const event = createKeyboardEvent('b', false, true);
        const preventDefaultSpy = jest.spyOn(event, 'preventDefault');

        editor.dispatchEvent(event);

        expect(preventDefaultSpy).toHaveBeenCalled();
    });

    test('should NOT prevent default for plain B key', () => {
        const event = createKeyboardEvent('b', false, false);
        const preventDefaultSpy = jest.spyOn(event, 'preventDefault');

        editor.dispatchEvent(event);

        expect(preventDefaultSpy).not.toHaveBeenCalled();
    });

    test('should NOT prevent default for Ctrl+C (Copy)', () => {
        const event = createKeyboardEvent('c', true, false);
        const preventDefaultSpy = jest.spyOn(event, 'preventDefault');

        editor.dispatchEvent(event);

        expect(preventDefaultSpy).not.toHaveBeenCalled();
    });
});
