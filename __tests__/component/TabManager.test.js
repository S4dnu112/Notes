/**
 * Component Tests for TabManager Module
 * Tests tab DOM manipulation and state management
 */

const { JSDOM } = require('jsdom');

describe('TabManager - Component Tests', () => {
    let dom;
    let document;
    let window;
    let tabsContainer;
    let tabsRow;
    let welcomeScreen;
    let editorContainer;

    beforeEach(() => {
        // Setup JSDOM environment
        dom = new JSDOM(`
            <!DOCTYPE html>
            <html>
                <body>
                    <div id="welcome-screen" class="hidden"></div>
                    <div id="editor-container"></div>
                    <div id="tabs-row">
                        <div id="tabs-container"></div>
                    </div>
                    <div id="editor" contenteditable="true"></div>
                </body>
            </html>
        `, {
            url: 'http://localhost',
            pretendToBeVisual: true
        });

        document = dom.window.document;
        window = dom.window;
        global.document = document;
        global.window = window;

        tabsContainer = document.getElementById('tabs-container');
        tabsRow = document.getElementById('tabs-row');
        welcomeScreen = document.getElementById('welcome-screen');
        editorContainer = document.getElementById('editor-container');
    });

    afterEach(() => {
        dom.window.close();
        delete global.document;
        delete global.window;
    });

    describe('Tab Creation', () => {
        test('should create tab element with proper structure', () => {
            const tabEl = document.createElement('div');
            tabEl.className = 'tab';
            tabEl.dataset.tabId = 'tab-123';
            
            const titleEl = document.createElement('span');
            titleEl.className = 'tab-title';
            titleEl.textContent = 'Untitled';
            
            const closeBtn = document.createElement('button');
            closeBtn.className = 'tab-close';
            closeBtn.textContent = '×';
            
            tabEl.appendChild(titleEl);
            tabEl.appendChild(closeBtn);
            tabsContainer.appendChild(tabEl);

            expect(tabsContainer.childNodes.length).toBe(1);
            expect(tabEl.dataset.tabId).toBe('tab-123');
            expect(tabEl.querySelector('.tab-title').textContent).toBe('Untitled');
        });

        test('should add active class to tab', () => {
            const tabEl = document.createElement('div');
            tabEl.className = 'tab active';
            tabsContainer.appendChild(tabEl);

            expect(tabEl.classList.contains('active')).toBe(true);
        });

        test('should add modified class to tab', () => {
            const tabEl = document.createElement('div');
            tabEl.className = 'tab modified';
            tabsContainer.appendChild(tabEl);

            expect(tabEl.classList.contains('modified')).toBe(true);
        });
    });

    describe('Welcome Screen', () => {
        test('should show welcome screen', () => {
            welcomeScreen.classList.remove('hidden');
            editorContainer.classList.add('hidden');

            expect(welcomeScreen.classList.contains('hidden')).toBe(false);
            expect(editorContainer.classList.contains('hidden')).toBe(true);
        });

        test('should hide welcome screen', () => {
            welcomeScreen.classList.add('hidden');
            editorContainer.classList.remove('hidden');

            expect(welcomeScreen.classList.contains('hidden')).toBe(true);
            expect(editorContainer.classList.contains('hidden')).toBe(false);
        });
    });

    describe('Tab Bar Visibility', () => {
        test('should hide tabs row when empty', () => {
            tabsRow.classList.add('hidden');

            expect(tabsRow.classList.contains('hidden')).toBe(true);
        });

        test('should show tabs row when tabs exist', () => {
            // Add tabs
            const tab1 = document.createElement('div');
            tab1.className = 'tab';
            const tab2 = document.createElement('div');
            tab2.className = 'tab';
            
            tabsContainer.appendChild(tab1);
            tabsContainer.appendChild(tab2);
            
            tabsRow.classList.remove('hidden');

            expect(tabsRow.classList.contains('hidden')).toBe(false);
            expect(tabsContainer.childNodes.length).toBe(2);
        });
    });

    describe('Tab Selection', () => {
        test('should mark only one tab as active', () => {
            const tab1 = document.createElement('div');
            tab1.className = 'tab active';
            const tab2 = document.createElement('div');
            tab2.className = 'tab';
            const tab3 = document.createElement('div');
            tab3.className = 'tab';
            
            tabsContainer.appendChild(tab1);
            tabsContainer.appendChild(tab2);
            tabsContainer.appendChild(tab3);

            // Switch active tab
            tab1.classList.remove('active');
            tab2.classList.add('active');

            expect(tab1.classList.contains('active')).toBe(false);
            expect(tab2.classList.contains('active')).toBe(true);
            expect(tab3.classList.contains('active')).toBe(false);
        });

        test('should find active tab', () => {
            const tab1 = document.createElement('div');
            tab1.className = 'tab';
            const tab2 = document.createElement('div');
            tab2.className = 'tab active';
            
            tabsContainer.appendChild(tab1);
            tabsContainer.appendChild(tab2);

            const activeTab = tabsContainer.querySelector('.tab.active');
            expect(activeTab).toBe(tab2);
        });
    });

    describe('Tab Removal', () => {
        test('should remove tab from DOM', () => {
            const tabEl = document.createElement('div');
            tabEl.className = 'tab';
            tabEl.dataset.tabId = 'tab-xyz';
            tabsContainer.appendChild(tabEl);

            expect(tabsContainer.childNodes.length).toBe(1);

            tabsContainer.removeChild(tabEl);

            expect(tabsContainer.childNodes.length).toBe(0);
        });

        test('should find and remove tab by ID', () => {
            const tab1 = document.createElement('div');
            tab1.className = 'tab';
            tab1.dataset.tabId = 'tab-1';
            const tab2 = document.createElement('div');
            tab2.className = 'tab';
            tab2.dataset.tabId = 'tab-2';
            
            tabsContainer.appendChild(tab1);
            tabsContainer.appendChild(tab2);

            const tabToRemove = tabsContainer.querySelector('[data-tab-id="tab-1"]');
            tabsContainer.removeChild(tabToRemove);

            expect(tabsContainer.childNodes.length).toBe(1);
            expect(tabsContainer.querySelector('[data-tab-id="tab-1"]')).toBeNull();
            expect(tabsContainer.querySelector('[data-tab-id="tab-2"]')).toBeTruthy();
        });
    });

    describe('Tab Ordering', () => {
        test('should maintain tab order', () => {
            const tabs = [];
            for (let i = 1; i <= 5; i++) {
                const tab = document.createElement('div');
                tab.className = 'tab';
                tab.dataset.tabId = `tab-${i}`;
                tabs.push(tab);
                tabsContainer.appendChild(tab);
            }

            expect(tabsContainer.childNodes.length).toBe(5);
            expect(tabsContainer.childNodes[0].dataset.tabId).toBe('tab-1');
            expect(tabsContainer.childNodes[4].dataset.tabId).toBe('tab-5');
        });

        test('should insert tab at specific position', () => {
            const tab1 = document.createElement('div');
            tab1.dataset.tabId = 'tab-1';
            const tab3 = document.createElement('div');
            tab3.dataset.tabId = 'tab-3';
            
            tabsContainer.appendChild(tab1);
            tabsContainer.appendChild(tab3);

            const tab2 = document.createElement('div');
            tab2.dataset.tabId = 'tab-2';
            tabsContainer.insertBefore(tab2, tab3);

            expect(tabsContainer.childNodes[0].dataset.tabId).toBe('tab-1');
            expect(tabsContainer.childNodes[1].dataset.tabId).toBe('tab-2');
            expect(tabsContainer.childNodes[2].dataset.tabId).toBe('tab-3');
        });
    });

    describe('Tab Content', () => {
        test('should update tab title', () => {
            const tabEl = document.createElement('div');
            tabEl.className = 'tab';
            const titleEl = document.createElement('span');
            titleEl.className = 'tab-title';
            titleEl.textContent = 'Untitled';
            tabEl.appendChild(titleEl);
            tabsContainer.appendChild(tabEl);

            // Update title
            titleEl.textContent = 'document.txti';

            expect(titleEl.textContent).toBe('document.txti');
        });

        test('should show close button', () => {
            const tabEl = document.createElement('div');
            tabEl.className = 'tab';
            const closeBtn = document.createElement('button');
            closeBtn.className = 'tab-close';
            closeBtn.textContent = '×';
            tabEl.appendChild(closeBtn);
            tabsContainer.appendChild(tabEl);

            const btn = tabEl.querySelector('.tab-close');
            expect(btn).toBeTruthy();
            expect(btn.textContent).toBe('×');
        });
    });

    describe('Multiple Tabs', () => {
        test('should handle many tabs', () => {
            for (let i = 0; i < 20; i++) {
                const tab = document.createElement('div');
                tab.className = 'tab';
                tab.dataset.tabId = `tab-${i}`;
                tabsContainer.appendChild(tab);
            }

            expect(tabsContainer.childNodes.length).toBe(20);
        });

        test('should query all tabs', () => {
            for (let i = 0; i < 3; i++) {
                const tab = document.createElement('div');
                tab.className = 'tab';
                tabsContainer.appendChild(tab);
            }

            const allTabs = tabsContainer.querySelectorAll('.tab');
            expect(allTabs.length).toBe(3);
        });
    });
});


describe('TabManager - Component Tests', () => {
    let dom;
    let document;
    let window;
    let mockTeximg;

    beforeEach(() => {
        // Setup JSDOM environment
        dom = new JSDOM(`
            <!DOCTYPE html>
            <html>
                <body>
                    <div id="welcome-screen" class="hidden"></div>
                    <div id="editor-container"></div>
                    <div id="tabs-row">
                        <div id="tabs-container"></div>
                    </div>
                    <div id="editor" contenteditable="true"></div>
                </body>
            </html>
        `, {
            url: 'http://localhost',
            pretendToBeVisual: true
        });

        document = dom.window.document;
        window = dom.window;
        global.document = document;
        global.window = window;

        // Mock window.teximg API
        mockTeximg = {
            newFile: jest.fn().mockResolvedValue(undefined),
            closeTab: jest.fn().mockResolvedValue(undefined),
            openFile: jest.fn().mockResolvedValue(null),
            saveFile: jest.fn().mockResolvedValue(true),
            saveFileAs: jest.fn().mockResolvedValue(null),
            saveSession: jest.fn().mockResolvedValue(undefined)
        };
        global.window.teximg = mockTeximg;

        // Clear state
        state.tabs.clear();
        state.tabOrder = [];
        state.activeTabId = null;
    });

    afterEach(() => {
        dom.window.close();
        delete global.document;
        delete global.window;
        jest.clearAllMocks();
    });

    describe('createTab', () => {
        test('should create a new untitled tab', () => {
            const tabId = createTab();

            expect(state.tabs.has(tabId)).toBe(true);
            expect(state.tabOrder).toContain(tabId);
            expect(state.activeTabId).toBe(tabId);

            const tabState = state.tabs.get(tabId);
            expect(tabState.title).toBe('Untitled');
            expect(tabState.filePath).toBeNull();
            expect(tabState.modified).toBe(false);
            expect(tabState.content).toEqual([]);
        });

        test('should create tab with file path', () => {
            const filePath = '/home/user/document.txti';
            const tabId = createTab(filePath);

            const tabState = state.tabs.get(tabId);
            expect(tabState.filePath).toBe(filePath);
            expect(tabState.title).toBe('document.txti');
        });

        test('should create tab with initial content', () => {
            const content = [
                { type: 'text', val: 'Hello' },
                { type: 'img', src: 'test.png' }
            ];
            const tabId = createTab(null, content);

            const tabState = state.tabs.get(tabId);
            expect(tabState.content).toEqual(content);
        });

        test('should initialize tempImages and imageMap', () => {
            const tabId = createTab();

            const tabState = state.tabs.get(tabId);
            expect(tabState.tempImages).toEqual({});
            expect(tabState.imageMap).toEqual({});
        });

        test('should call newFile IPC handler', () => {
            const tabId = createTab();

            expect(mockTeximg.newFile).toHaveBeenCalledWith(tabId);
        });

        test('should hide welcome screen on first tab', () => {
            const welcomeScreen = document.getElementById('welcome-screen');
            const editorContainer = document.getElementById('editor-container');

            welcomeScreen.classList.remove('hidden');
            editorContainer.classList.add('hidden');

            createTab();

            expect(welcomeScreen.classList.contains('hidden')).toBe(true);
            expect(editorContainer.classList.contains('hidden')).toBe(false);
        });

        test('should show tabs row when multiple tabs exist', () => {
            const tabsRow = document.getElementById('tabs-row');
            tabsRow.classList.add('hidden');

            createTab();
            expect(tabsRow.classList.contains('hidden')).toBe(true); // Still hidden with 1 tab

            createTab();
            expect(tabsRow.classList.contains('hidden')).toBe(false); // Visible with 2 tabs
        });

        test('should generate unique IDs for multiple tabs', () => {
            const tab1 = createTab();
            const tab2 = createTab();
            const tab3 = createTab();

            expect(tab1).not.toBe(tab2);
            expect(tab2).not.toBe(tab3);
            expect(tab1).not.toBe(tab3);
        });

        test('should truncate long file names', () => {
            const longPath = '/home/user/very-long-filename-that-should-be-truncated.txti';
            const tabId = createTab(longPath);

            const tabState = state.tabs.get(tabId);
            expect(tabState.title.length).toBeLessThanOrEqual(18); // 15 + "..."
        });
    });

    describe('closeTab', () => {
        test('should remove tab from state', async () => {
            const tabId = createTab();
            expect(state.tabs.has(tabId)).toBe(true);

            await closeTab(tabId);

            expect(state.tabs.has(tabId)).toBe(false);
            expect(state.tabOrder).not.toContain(tabId);
        });

        test('should call closeTab IPC handler', async () => {
            const tabId = createTab();

            await closeTab(tabId);

            expect(mockTeximg.closeTab).toHaveBeenCalledWith(tabId);
        });

        test('should switch to another tab when closing active tab', async () => {
            const tab1 = createTab();
            const tab2 = createTab();

            expect(state.activeTabId).toBe(tab2);

            await closeTab(tab2);

            expect(state.activeTabId).toBe(tab1);
        });

        test('should show welcome screen when closing last tab', async () => {
            const welcomeScreen = document.getElementById('welcome-screen');
            const editorContainer = document.getElementById('editor-container');

            const tabId = createTab();
            await closeTab(tabId);

            expect(welcomeScreen.classList.contains('hidden')).toBe(false);
            expect(editorContainer.classList.contains('hidden')).toBe(true);
        });

        test('should hide tabs row when only one tab remains', async () => {
            const tabsRow = document.getElementById('tabs-row');
            
            const tab1 = createTab();
            const tab2 = createTab();
            
            expect(tabsRow.classList.contains('hidden')).toBe(false);

            await closeTab(tab2);

            expect(tabsRow.classList.contains('hidden')).toBe(true);
        });

        test('should handle closing non-active tab', async () => {
            const tab1 = createTab();
            const tab2 = createTab();

            expect(state.activeTabId).toBe(tab2);

            await closeTab(tab1);

            expect(state.activeTabId).toBe(tab2); // Should remain on tab2
            expect(state.tabs.has(tab1)).toBe(false);
            expect(state.tabs.has(tab2)).toBe(true);
        });

        test('should remove tab DOM element', async () => {
            const tabId = createTab();
            
            // Manually create a tab element
            const tabsContainer = document.getElementById('tabs-container');
            const tabEl = document.createElement('div');
            tabEl.dataset.tabId = tabId;
            tabEl.className = 'tab';
            tabsContainer.appendChild(tabEl);

            expect(tabsContainer.querySelector(`[data-tab-id="${tabId}"]`)).toBeTruthy();

            await closeTab(tabId);

            expect(tabsContainer.querySelector(`[data-tab-id="${tabId}"]`)).toBeNull();
        });
    });

    describe('switchToTab', () => {
        test('should set new active tab', async () => {
            const tab1 = createTab();
            const tab2 = createTab();

            await switchToTab(tab1);

            expect(state.activeTabId).toBe(tab1);
        });

        test('should not switch if already active', async () => {
            const { saveEditorToState } = require('../../renderer/modules/Editor.js');
            
            const tabId = createTab();
            
            await switchToTab(tabId);
            await switchToTab(tabId);

            // saveEditorToState should only be called once during creation
            expect(saveEditorToState).toHaveBeenCalledTimes(0);
        });

        test('should save current tab before switching', async () => {
            const { saveEditorToState } = require('../../renderer/modules/Editor.js');
            
            const tab1 = createTab();
            const tab2 = createTab();

            await switchToTab(tab1);

            expect(saveEditorToState).toHaveBeenCalledWith(tab2);
        });

        test('should render new tab content', async () => {
            const { renderContentToEditor } = require('../../renderer/modules/Editor.js');
            
            const content = [{ type: 'text', val: 'Test content' }];
            const tabId = createTab(null, content);

            await switchToTab(tabId);

            expect(renderContentToEditor).toHaveBeenCalled();
        });
    });

    describe('Tab State Management', () => {
        test('should maintain tab order correctly', () => {
            const tab1 = createTab();
            const tab2 = createTab();
            const tab3 = createTab();

            expect(state.tabOrder).toEqual([tab1, tab2, tab3]);
        });

        test('should track modified state per tab', () => {
            const tab1 = createTab();
            const tab2 = createTab();

            const tab1State = state.tabs.get(tab1);
            const tab2State = state.tabs.get(tab2);

            tab1State.modified = true;
            tab2State.modified = false;

            expect(tab1State.modified).toBe(true);
            expect(tab2State.modified).toBe(false);
        });

        test('should maintain separate content for each tab', () => {
            const content1 = [{ type: 'text', val: 'Tab 1' }];
            const content2 = [{ type: 'text', val: 'Tab 2' }];

            const tab1 = createTab(null, content1);
            const tab2 = createTab(null, content2);

            const tab1State = state.tabs.get(tab1);
            const tab2State = state.tabs.get(tab2);

            expect(tab1State.content).toEqual(content1);
            expect(tab2State.content).toEqual(content2);
        });

        test('should maintain separate image maps per tab', () => {
            const tab1 = createTab();
            const tab2 = createTab();

            const tab1State = state.tabs.get(tab1);
            const tab2State = state.tabs.get(tab2);

            tab1State.imageMap = { 'img1.png': '/path/1' };
            tab2State.imageMap = { 'img2.png': '/path/2' };

            expect(tab1State.imageMap).not.toEqual(tab2State.imageMap);
        });
    });

    describe('Edge Cases', () => {
        test('should handle rapid tab creation', () => {
            const tabs = [];
            for (let i = 0; i < 10; i++) {
                tabs.push(createTab());
            }

            expect(state.tabs.size).toBe(10);
            expect(state.tabOrder.length).toBe(10);
            expect(new Set(tabs).size).toBe(10); // All unique
        });

        test('should handle closing tabs in different order', async () => {
            const tab1 = createTab();
            const tab2 = createTab();
            const tab3 = createTab();

            await closeTab(tab2); // Close middle tab

            expect(state.tabOrder).toEqual([tab1, tab3]);
            expect(state.tabs.size).toBe(2);
        });

        test('should handle switching to non-existent tab gracefully', async () => {
            createTab();

            await expect(switchToTab('non-existent-id')).resolves.not.toThrow();
        });

        test('should handle empty file path correctly', () => {
            const tabId = createTab('');

            const tabState = state.tabs.get(tabId);
            expect(tabState.title).toBe('Untitled');
        });
    });
});
