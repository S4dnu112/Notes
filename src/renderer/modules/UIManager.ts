import { state } from './state.js';
import { undo, redo, setZoom } from './Editor.js';
import { openSettings } from './SettingsManager.js';
import { TabState } from '../../types';

interface TabManagerFuncs {
    createTab: () => void;
    openFile: () => Promise<void>;
    saveFile: () => Promise<void>;
    saveFileAs: () => Promise<void>;
    closeTab: (tabId: string) => Promise<void>;
    switchToNextTab: () => void;
    switchToPreviousTab: () => void;
}

// Close any open menus (settings panel, etc.)
export function closeMenu(): void {
    const settingsPanel = document.getElementById('settings-panel');
    if (settingsPanel && !settingsPanel.classList.contains('hidden')) {
        settingsPanel.classList.add('hidden');
    }
}

export function initUI(tabManagerFuncs: TabManagerFuncs): void {
    const { createTab, openFile, saveFile, saveFileAs, closeTab, switchToNextTab, switchToPreviousTab } = tabManagerFuncs;

    // Window controls
    (document.getElementById('btn-minimize') as HTMLButtonElement).addEventListener('click', () => window.textimg.minimize());
    (document.getElementById('btn-maximize') as HTMLButtonElement).addEventListener('click', () => window.textimg.maximize());
    // Close button now triggers native close (which will fire close-request)
    (document.getElementById('btn-close') as HTMLButtonElement).addEventListener('click', () => requestWindowClose());

    // Handle close request from main process
    setupCloseRequestHandler(tabManagerFuncs);

    window.textimg.onMaximizedChange((isMaximized: boolean) => {
        updateMaximizeIcon(isMaximized);
    });
    window.textimg.isMaximized().then(updateMaximizeIcon);

    // Native menu - triggered by hamburger button
    const menuHamburger = document.getElementById('menu-hamburger') as HTMLButtonElement;
    menuHamburger.addEventListener('click', () => {
        window.textimg.showMenu();
    });

    // Handle menu actions from main process
    window.textimg.onMenuAction((action: string) => {
        switch (action) {
            case 'new-window': window.textimg.newWindow(); break;
            case 'open': openFile(); break;
            case 'save': saveFile(); break;
            case 'save-as': saveFileAs(); break;
            case 'preferences': window.textimg.openPreferences(); break;
        }
    });

    // Add tab button
    (document.getElementById('btn-add-tab') as HTMLButtonElement).addEventListener('click', () => createTab());

    // Keyboard shortcuts
    setupKeyboardShortcuts({ createTab, openFile, saveFile, saveFileAs, closeTab, switchToNextTab, switchToPreviousTab, openSettings, undo, redo });
}

export function updateStatusBar(): void {
    const editor = document.getElementById('editor') as HTMLDivElement;
    const statusPosition = document.getElementById('status-position') as HTMLSpanElement;
    const statusChars = document.getElementById('status-chars') as HTMLSpanElement;
    const statusZoom = document.getElementById('status-zoom') as HTMLSpanElement;

    const selection = window.getSelection();
    let line = 1;
    let col = 1;
    let totalChars = editor.textContent?.length || 0;

    if (selection && selection.rangeCount > 0) {
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

export function updateHeaderPath(text: string): void {
    const el = document.getElementById('header-path');
    if (el) {
        el.textContent = text || '';
    }
}

function updateMaximizeIcon(isMaximized: boolean): void {
    const iconMaximize = document.getElementById('icon-maximize') as HTMLElement;
    const iconRestore = document.getElementById('icon-restore') as HTMLElement;
    if (isMaximized) {
        iconMaximize.classList.add('hidden');
        iconRestore.classList.remove('hidden');
    } else {
        iconMaximize.classList.remove('hidden');
        iconRestore.classList.add('hidden');
    }
}

interface KeyboardShortcutHandlers {
    createTab: () => void;
    openFile: () => Promise<void>;
    saveFile: () => Promise<void>;
    saveFileAs: () => Promise<void>;
    closeTab: (tabId: string) => Promise<void>;
    switchToNextTab: () => void;
    switchToPreviousTab: () => void;
    openSettings: () => void;
    undo: () => void;
    redo: () => void;
}

function setupKeyboardShortcuts({ createTab, openFile, saveFile, saveFileAs, closeTab, switchToNextTab, switchToPreviousTab, openSettings, undo, redo }: KeyboardShortcutHandlers): void {
    document.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.ctrlKey || e.metaKey) {
            switch (e.key.toLowerCase()) {
                case 'n': e.preventDefault(); window.textimg.newWindow(); break;
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
                case 'tab':
                    e.preventDefault();
                    if (e.shiftKey) switchToPreviousTab(); else switchToNextTab();
                    break;
            }
        }
        if (e.key === 'Escape') {
            closeMenu(); // Close settings panel or any open menus
        }
    });
}

// Close request handler - handles both CASE A (multiple windows) and CASE B (last window)
let closeRequestHandlerSetup = false;
function setupCloseRequestHandler(funcs: Pick<TabManagerFuncs, 'saveFile'>): void {
    if (closeRequestHandlerSetup) return;
    closeRequestHandlerSetup = true;

    window.textimg.onCloseRequest(async ({ isLastWindow }: { isLastWindow: boolean }) => {
        if (isLastWindow) {
            window.textimg.forceClose();
        } else {
            const dirtyTabs = getDirtyTabs();

            if (dirtyTabs.length === 0) {
                window.textimg.forceClose();
                return;
            }

            // Show multi-file dialog with all unsaved tabs
            const filenames = dirtyTabs.map(tab => tab.fullTitle || tab.title || 'Untitled');
            const response = await window.textimg.showMultipleUnsavedChangesDialog(filenames);

            if (response === 'cancel') {
                return;
            }

            if (response === 'save') {
                // Save all dirty tabs
                const saveSuccess = await saveAllTabs(dirtyTabs, funcs.saveFile);
                if (!saveSuccess) {
                    // If any save was cancelled or failed, don't close
                    return;
                }
            }

            window.textimg.forceClose();
        }
    });
}

// Get list of tabs with unsaved changes
function getDirtyTabs(): TabState[] {
    const dirtyTabs: TabState[] = [];
    for (const tabState of state.tabs.values()) {
        if (tabState.modified) {
            dirtyTabs.push(tabState);
        }
    }
    return dirtyTabs;
}

// Save all dirty tabs - returns true if all saves succeeded, false if any were cancelled
async function saveAllTabs(dirtyTabs: TabState[], saveFileFn: () => Promise<void>): Promise<boolean> {
    // Import necessary functions
    const { switchToTab } = await import('./TabManager.js');

    const currentActiveTab = state.activeTabId;

    for (const tabState of dirtyTabs) {
        // Switch to the tab to save it
        if (state.activeTabId !== tabState.id) {
            await switchToTab(tabState.id);
        }

        // Save the file
        await saveFileFn();

        // Check if save was successful (tab should no longer be modified)
        const updatedTabState = state.tabs.get(tabState.id);
        if (updatedTabState && updatedTabState.modified) {
            // Save was cancelled or failed
            return false;
        }
    }

    // Restore the original active tab if it still exists
    if (currentActiveTab && state.tabs.has(currentActiveTab)) {
        await switchToTab(currentActiveTab);
    }

    return true;
}

async function requestWindowClose(): Promise<void> {
    const windowCount = await window.textimg.getWindowCount();
    const isLastWindow = windowCount === 1;

    if (isLastWindow) {
        window.textimg.forceClose();
    } else {
        const dirtyTabs = getDirtyTabs();

        if (dirtyTabs.length === 0) {
            window.textimg.forceClose();
            return;
        }

        // Show multi-file dialog with all unsaved tabs
        const filenames = dirtyTabs.map(tab => tab.fullTitle || tab.title || 'Untitled');
        const response = await window.textimg.showMultipleUnsavedChangesDialog(filenames);

        if (response === 'cancel') {
            return;
        }

        if (response === 'save') {
            // Save all dirty tabs
            const saveSuccess = await saveAllTabs(dirtyTabs, async () => {
                // We need to use the exported saveFile from TabManager
                // Get it from the module context
                const { saveFile } = await import('./TabManager.js');
                await saveFile();
            });
            if (!saveSuccess) {
                // If any save was cancelled or failed, don't close
                return;
            }
        }

        window.textimg.forceClose();
    }
}
