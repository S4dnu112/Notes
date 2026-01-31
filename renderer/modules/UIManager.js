import { state } from './state.js';
import { undo, redo, setZoom } from './Editor.js';
import { openSettings } from './SettingsManager.js';

// Close any open menus (settings panel, etc.)
export function closeMenu() {
    const settingsPanel = document.getElementById('settings-panel');
    if (settingsPanel && !settingsPanel.classList.contains('hidden')) {
        settingsPanel.classList.add('hidden');
    }
}

export function initUI(tabManagerFuncs) {
    const { createTab, openFile, saveFile, saveFileAs, closeTab } = tabManagerFuncs;

    // Window controls
    document.getElementById('btn-minimize').addEventListener('click', () => window.teximg.minimize());
    document.getElementById('btn-maximize').addEventListener('click', () => window.teximg.maximize());
    // Close button now triggers native close (which will fire close-request)
    document.getElementById('btn-close').addEventListener('click', () => requestWindowClose());

    // Handle close request from main process
    setupCloseRequestHandler(tabManagerFuncs);

    window.teximg.onMaximizedChange((isMaximized) => {
        updateMaximizeIcon(isMaximized);
    });
    window.teximg.isMaximized().then(updateMaximizeIcon);

    // Native menu - triggered by hamburger button
    const menuHamburger = document.getElementById('menu-hamburger');
    menuHamburger.addEventListener('click', () => {
        window.teximg.showMenu();
    });

    // Handle menu actions from main process
    window.teximg.onMenuAction((action) => {
        switch (action) {
            case 'new-window': window.teximg.newWindow(); break;
            case 'new-tab': createTab(); break;
            case 'open': openFile(); break;
            case 'save': saveFile(); break;
            case 'save-as': saveFileAs(); break;
            case 'undo': undo(); break;
            case 'redo': redo(); break;
            case 'close-tab': if (state.activeTabId) closeTab(state.activeTabId); break;
            case 'settings': openSettings(); break;
        }
    });

    // Add tab button
    document.getElementById('btn-add-tab').addEventListener('click', () => createTab());

    // Keyboard shortcuts
    setupKeyboardShortcuts({ createTab, openFile, saveFile, saveFileAs, closeTab, openSettings, undo, redo });
}

export function updateStatusBar() {
    const editor = document.getElementById('editor');
    const statusPosition = document.getElementById('status-position');
    const statusChars = document.getElementById('status-chars');
    const statusZoom = document.getElementById('status-zoom');

    const selection = window.getSelection();
    let line = 1;
    let col = 1;
    let totalChars = editor.textContent.length;

    if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const preCaretRange = range.cloneRange();
        preCaretRange.selectNodeContents(editor);
        preCaretRange.setEnd(range.startContainer, range.startOffset);
        const textBeforeCursor = preCaretRange.toString();
        const lines = textBeforeCursor.split('\n');
        line = lines.length;
        col = lines[lines.length - 1].length + 1;
    }

    if (statusPosition) statusPosition.textContent = `Ln ${line}, Col ${col}`;
    if (statusChars) statusChars.textContent = `${totalChars} characters`;
    if (statusZoom) statusZoom.textContent = `${state.zoomLevel}%`;
}

export function updateHeaderPath(text) {
    const el = document.getElementById('header-path');
    if (el) {
        el.textContent = text || '';
    }
}

function updateMaximizeIcon(isMaximized) {
    const iconMaximize = document.getElementById('icon-maximize');
    const iconRestore = document.getElementById('icon-restore');
    if (isMaximized) {
        iconMaximize.classList.add('hidden');
        iconRestore.classList.remove('hidden');
    } else {
        iconMaximize.classList.remove('hidden');
        iconRestore.classList.add('hidden');
    }
}

function setupKeyboardShortcuts({ createTab, openFile, saveFile, saveFileAs, closeTab, openSettings, undo, redo }) {
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey) {
            switch (e.key.toLowerCase()) {
                case 'n': e.preventDefault(); window.teximg.newWindow(); break;
                case 't': e.preventDefault(); createTab(); break;
                case 'o': e.preventDefault(); openFile(); break;
                case 's':
                    e.preventDefault();
                    if (e.shiftKey) saveFileAs(); else saveFile();
                    break;
                case 'w': e.preventDefault(); if (state.activeTabId) closeTab(state.activeTabId); break;
                case 'z':
                    e.preventDefault();
                    if (e.shiftKey) redo(); else undo();
                    break;
                case '=': case '+': e.preventDefault(); setZoom(state.zoomLevel + 10); break;
                case '-': case '_': e.preventDefault(); setZoom(state.zoomLevel - 10); break;
                case '0': e.preventDefault(); setZoom(100); break;
                case 'y': e.preventDefault(); redo(); break;
                case ',': e.preventDefault(); openSettings(); break;
            }
        }
        if (e.key === 'Escape') {
            closeMenu(); // Close settings panel or any open menus
        }
    });
}

// Close request handler - handles both CASE A (multiple windows) and CASE B (last window)
let closeRequestHandlerSetup = false;
function setupCloseRequestHandler({ saveFile }) {
    if (closeRequestHandlerSetup) return;
    closeRequestHandlerSetup = true;

    window.teximg.onCloseRequest(async ({ isLastWindow }) => {
        if (isLastWindow) {
            window.teximg.forceClose();
        } else {
            const dirtyTabs = getDirtyTabs();

            if (dirtyTabs.length === 0) {
                window.teximg.forceClose();
                return;
            }

            for (const tabState of dirtyTabs) {
                const response = await window.teximg.showUnsavedChangesDialog(tabState.title);

                if (response === 'cancel') {
                    return;
                }
            }

            window.teximg.forceClose();
        }
    });
}

// Get list of tabs with unsaved changes
function getDirtyTabs() {
    const dirtyTabs = [];
    for (const tabState of state.tabs.values()) {
        if (tabState.modified) {
            dirtyTabs.push(tabState);
        }
    }
    return dirtyTabs;
}

async function requestWindowClose() {
    const windowCount = await window.teximg.getWindowCount();
    const isLastWindow = windowCount === 1;

    if (isLastWindow) {
        window.teximg.forceClose();
    } else {
        const dirtyTabs = getDirtyTabs();

        if (dirtyTabs.length === 0) {
            window.teximg.forceClose();
            return;
        }

        for (const tabState of dirtyTabs) {
            const response = await window.teximg.showUnsavedChangesDialog(tabState.title);

            if (response === 'cancel') {
                return;
            }
        }

        window.teximg.forceClose();
    }
}
