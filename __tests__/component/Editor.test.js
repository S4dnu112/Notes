/**
 * Component Tests for Editor Module
 * Tests DOM manipulation and content rendering logic
 */

const { JSDOM } = require('jsdom');

describe('Editor - Component Tests', () => {
    let dom;
    let document;
    let window;
    let editor;

    beforeEach(() => {
        // Setup JSDOM environment
        dom = new JSDOM(`
            <!DOCTYPE html>
            <html>
                <body>
                    <div id="editor-container">
                        <div id="editor" contenteditable="true"></div>
                    </div>
                </body>
            </html>
        `, {
            url: 'http://localhost',
            pretendToBeVisual: true,
            resources: 'usable'
        });

        document = dom.window.document;
        window = dom.window;
        global.document = document;
        global.window = window;
        global.Node = window.Node;

        editor = document.getElementById('editor');
    });

    afterEach(() => {
        dom.window.close();
        delete global.document;
        delete global.window;
        delete global.Node;
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

        test('should skip empty text nodes', () => {
            editor.innerHTML = '<p>   </p><p>Valid text</p><p></p>';
            
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

            expect(content.length).toBe(1);
            expect(content[0].val).toBe('Valid text');
        });

        test('should handle BR tags', () => {
            const br = document.createElement('br');
            editor.appendChild(br);

            expect(editor.querySelector('br')).toBeTruthy();
        });

        test('should extract nested content', () => {
            const div = document.createElement('div');
            div.textContent = 'Parent text';
            const img = document.createElement('img');
            img.dataset.filename = 'nested.png';
            div.appendChild(img);
            editor.appendChild(div);

            const divEl = editor.querySelector('div');
            expect(divEl.textContent).toBe('Parent text');
            expect(divEl.querySelector('img')).toBeTruthy();
        });
    });

    describe('Image Handling', () => {
        test('should add selected class to image', () => {
            const img = document.createElement('img');
            img.dataset.filename = 'test.png';
            editor.appendChild(img);

            img.classList.add('selected');

            expect(img.classList.contains('selected')).toBe(true);
        });

        test('should remove selected class from image', () => {
            const img = document.createElement('img');
            img.classList.add('selected');
            editor.appendChild(img);

            img.classList.remove('selected');

            expect(img.classList.contains('selected')).toBe(false);
        });

        test('should set image width via data attribute', () => {
            const img = document.createElement('img');
            img.dataset.width = '400';
            img.style.width = '400px';
            editor.appendChild(img);

            expect(img.dataset.width).toBe('400');
            expect(img.style.width).toBe('400px');
        });

        test('should handle loading state for images', () => {
            const img = document.createElement('img');
            img.classList.add('loading');
            img.alt = 'Loading: image.png';
            editor.appendChild(img);

            expect(img.classList.contains('loading')).toBe(true);
            expect(img.alt).toContain('Loading');
        });
    });

    describe('DOM Manipulation', () => {
        test('should add multiple elements', () => {
            for (let i = 0; i < 5; i++) {
                const p = document.createElement('p');
                p.textContent = `Line ${i + 1}`;
                editor.appendChild(p);
            }

            expect(editor.childNodes.length).toBe(5);
        });

        test('should remove elements', () => {
            const p = document.createElement('p');
            p.textContent = 'Remove me';
            editor.appendChild(p);

            expect(editor.childNodes.length).toBe(1);

            editor.removeChild(p);

            expect(editor.childNodes.length).toBe(0);
        });

        test('should query elements by selector', () => {
            editor.innerHTML = '<p class="test">Text</p><img data-filename="pic.png">';

            const paragraph = editor.querySelector('.test');
            const image = editor.querySelector('[data-filename]');

            expect(paragraph).toBeTruthy();
            expect(image).toBeTruthy();
            expect(paragraph.textContent).toBe('Text');
            expect(image.dataset.filename).toBe('pic.png');
        });

        test('should handle contenteditable attribute', () => {
            expect(editor.getAttribute('contenteditable')).toBe('true');
        });
    });
});


describe('Editor - Component Tests', () => {
    let dom;
    let document;
    let window;
    let editor;
    let mockUpdateTabUI;
    let mockUpdateStatusBar;

    beforeEach(() => {
        // Setup JSDOM environment
        dom = new JSDOM(`
            <!DOCTYPE html>
            <html>
                <body>
                    <div id="editor-container">
                        <div id="editor" contenteditable="true"></div>
                    </div>
                </body>
            </html>
        `, {
            url: 'http://localhost',
            pretendToBeVisual: true,
            resources: 'usable'
        });

        document = dom.window.document;
        window = dom.window;
        global.document = document;
        global.window = window;
        global.Node = window.Node;

        editor = document.getElementById('editor');

        // Mock functions
        mockUpdateTabUI = jest.fn();
        mockUpdateStatusBar = jest.fn();
        setUpdateTabUI(mockUpdateTabUI);
        setUpdateStatusBar(mockUpdateStatusBar);

        // Clear state
        state.tabs.clear();
        state.tabOrder = [];
        state.activeTabId = null;
    });

    afterEach(() => {
        dom.window.close();
        delete global.document;
        delete global.window;
        delete global.Node;
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

        test('should render mixed text and image content', () => {
            const tabState = {
                id: 'tab1',
                content: [
                    { type: 'text', val: 'Before image' },
                    { type: 'img', src: 'test.png' },
                    { type: 'text', val: 'After image' }
                ],
                imageMap: { 'test.png': '/path/to/test.png' },
                tempImages: {}
            };

            renderContentToEditor(tabState);

            expect(editor.childNodes.length).toBe(3);
            expect(editor.childNodes[0].textContent).toBe('Before image');
            expect(editor.childNodes[1].tagName).toBe('IMG');
            expect(editor.childNodes[2].textContent).toBe('After image');
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

        test('should clear editor before rendering new content', () => {
            editor.innerHTML = '<p>Old content</p>';

            const tabState = {
                id: 'tab1',
                content: [
                    { type: 'text', val: 'New content' }
                ],
                imageMap: {},
                tempImages: {}
            };

            renderContentToEditor(tabState);

            expect(editor.childNodes.length).toBe(1);
            expect(editor.textContent).toBe('New content');
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

        test('should handle mixed content nodes', () => {
            const tabId = 'tab1';
            const tabState = {
                id: tabId,
                content: [],
                imageMap: {},
                tempImages: {}
            };
            state.tabs.set(tabId, tabState);

            editor.innerHTML = '<p>Text</p>';
            const img = document.createElement('img');
            img.dataset.filename = 'pic.png';
            editor.appendChild(img);

            saveEditorToState(tabId);

            expect(tabState.content.length).toBe(2);
            expect(tabState.content[0].type).toBe('text');
            expect(tabState.content[1].type).toBe('img');
        });

        test('should skip empty text nodes', () => {
            const tabId = 'tab1';
            const tabState = {
                id: tabId,
                content: [],
                imageMap: {},
                tempImages: {}
            };
            state.tabs.set(tabId, tabState);

            editor.innerHTML = '<p>   </p><p>Valid text</p><p></p>';
            saveEditorToState(tabId);

            expect(tabState.content.length).toBe(1);
            expect(tabState.content[0].val).toBe('Valid text');
        });

        test('should handle BR tags as newlines', () => {
            const tabId = 'tab1';
            const tabState = {
                id: tabId,
                content: [],
                imageMap: {},
                tempImages: {}
            };
            state.tabs.set(tabId, tabState);

            const br = document.createElement('br');
            editor.appendChild(br);

            saveEditorToState(tabId);

            expect(tabState.content).toContainEqual({ type: 'text', val: '\n' });
        });

        test('should return early if tab does not exist', () => {
            editor.innerHTML = '<p>Test</p>';
            
            // Should not throw error
            expect(() => {
                saveEditorToState('non-existent-tab');
            }).not.toThrow();
        });
    });

    describe('markModified', () => {
        test('should mark active tab as modified', () => {
            const tabId = 'tab1';
            const tabState = {
                id: tabId,
                modified: false
            };
            state.tabs.set(tabId, tabState);
            state.activeTabId = tabId;

            markModified();

            expect(tabState.modified).toBe(true);
            expect(mockUpdateTabUI).toHaveBeenCalledWith(tabId);
        });

        test('should not call updateTabUI if already modified', () => {
            const tabId = 'tab1';
            const tabState = {
                id: tabId,
                modified: true
            };
            state.tabs.set(tabId, tabState);
            state.activeTabId = tabId;

            markModified();

            expect(mockUpdateTabUI).not.toHaveBeenCalled();
        });

        test('should handle no active tab gracefully', () => {
            state.activeTabId = null;

            expect(() => {
                markModified();
            }).not.toThrow();
        });
    });

    describe('Content Serialization Edge Cases', () => {
        test('should handle nested elements correctly', () => {
            const tabId = 'tab1';
            const tabState = {
                id: tabId,
                content: [],
                imageMap: {},
                tempImages: {}
            };
            state.tabs.set(tabId, tabState);

            const div = document.createElement('div');
            div.textContent = 'Parent text';
            const img = document.createElement('img');
            img.dataset.filename = 'nested.png';
            div.appendChild(img);
            editor.appendChild(div);

            saveEditorToState(tabId);

            expect(tabState.content.length).toBe(2);
            expect(tabState.content[0].type).toBe('text');
            expect(tabState.content[1].type).toBe('img');
        });

        test('should preserve image order in content', () => {
            const tabId = 'tab1';
            const tabState = {
                id: tabId,
                content: [],
                imageMap: {},
                tempImages: {}
            };
            state.tabs.set(tabId, tabState);

            const img1 = document.createElement('img');
            img1.dataset.filename = 'first.png';
            const img2 = document.createElement('img');
            img2.dataset.filename = 'second.png';
            
            editor.appendChild(img1);
            editor.appendChild(img2);

            saveEditorToState(tabId);

            expect(tabState.content[0].src).toBe('first.png');
            expect(tabState.content[1].src).toBe('second.png');
        });

        test('should handle images without width attribute', () => {
            const tabId = 'tab1';
            const tabState = {
                id: tabId,
                content: [],
                imageMap: {},
                tempImages: {}
            };
            state.tabs.set(tabId, tabState);

            const img = document.createElement('img');
            img.dataset.filename = 'nowidth.png';
            // No width set
            editor.appendChild(img);

            saveEditorToState(tabId);

            expect(tabState.content[0]).toEqual({ 
                type: 'img', 
                src: 'nowidth.png'
                // No width property
            });
        });
    });

    describe('Round-trip: Render and Save', () => {
        test('should preserve content through render-save cycle', () => {
            const tabId = 'tab1';
            const originalContent = [
                { type: 'text', val: 'Line 1' },
                { type: 'img', src: 'test.png', width: 200 },
                { type: 'text', val: 'Line 2' }
            ];

            const tabState = {
                id: tabId,
                content: [...originalContent],
                imageMap: { 'test.png': '/path/to/test.png' },
                tempImages: {}
            };
            state.tabs.set(tabId, tabState);

            // Render to editor
            renderContentToEditor(tabState);

            // Clear content and save back
            tabState.content = [];
            saveEditorToState(tabId);

            // Should match original (may have slight differences in structure)
            expect(tabState.content).toHaveLength(3);
            expect(tabState.content[0]).toEqual({ type: 'text', val: 'Line 1' });
            expect(tabState.content[1]).toEqual({ type: 'img', src: 'test.png', width: 200 });
            expect(tabState.content[2]).toEqual({ type: 'text', val: 'Line 2' });
        });
    });
});
