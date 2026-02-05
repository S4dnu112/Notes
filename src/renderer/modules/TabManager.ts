import { state } from './state.js';
import { generateTabId, getFilename, formatHeaderText, debounce, truncateTabTitle, getDisplayTitleFromContent } from './utils.js';
import { renderContentToEditor, saveEditorToState } from './Editor.js';
import { updateStatusBar, updateHeaderPath } from './UIManager.js';
import { TabState, Content } from '../../types';

// DOM Elements
const tabsContainer = document.getElementById('tabs-container') as HTMLDivElement;
const tabsRow = document.getElementById('tabs-row') as HTMLDivElement;
const welcomeScreen = document.getElementById('welcome-screen') as HTMLDivElement;
const editorContainer = document.getElementById('editor-container') as HTMLDivElement;

// ============================================
// Tab Lifecycle
// ============================================

function showWelcomeScreen(): void {
    if (welcomeScreen) welcomeScreen.classList.remove('hidden');
    if (editorContainer) editorContainer.classList.add('hidden');
    updateHeaderPath('');
}

function hideWelcomeScreen(): void {
    if (welcomeScreen) welcomeScreen.classList.add('hidden');
    if (editorContainer) editorContainer.classList.remove('hidden');
}

function updateTabsVisibility(): void {
    if (tabsRow) {
        if (state.tabs.size <= 1) {
            tabsRow.classList.add('hidden');
        } else {
            tabsRow.classList.remove('hidden');
        }
    }
}

export function createTab(filePath: string | null = null, content: Content = []): string {
    hideWelcomeScreen();
    const id = generateTabId();

    const initialFullTitle = filePath ? getFilename(filePath) : getDisplayTitleFromContent(content);
    const tabState: TabState = {
        id,
        filePath,
        title: truncateTabTitle(initialFullTitle),
        fullTitle: initialFullTitle,
        modified: false,
        imagesLoaded: false,
        content,
        imageMap: {},
        tempImages: {}
    };

    state.tabs.set(id, tabState);
    state.tabOrder.push(id);
    renderTab(tabState);
    switchToTab(id);
    updateTabsVisibility();

    // Initialize temp directory in main process
    window.textimg.newFile(id);

    return id;
}

export async function closeTab(tabId: string): Promise<void> {
    const tabState = state.tabs.get(tabId);

    // Check for unsaved changes
    if (tabState && tabState.modified) {
        // Get the display name for the dialog
        const displayName = tabState.fullTitle || tabState.title || 'Untitled';

        // Show confirmation dialog
        const response = await window.textimg.showUnsavedChangesDialog(displayName);

        if (response === 'cancel') {
            // User cancelled, keep the tab open
            return;
        }

        if (response === 'save') {
            // Save the file first
            // If it's the active tab, we can use saveFile directly
            // Otherwise, we need to switch to it first, save, then close
            const wasActiveTab = state.activeTabId === tabId;

            if (!wasActiveTab) {
                // Switch to this tab to save it
                await switchToTab(tabId);
            }

            // Save the file
            await saveFile();

            // Check if save was successful (tab will have filePath and modified = false)
            const updatedTabState = state.tabs.get(tabId);
            if (updatedTabState && updatedTabState.modified) {
                // Save was cancelled or failed, don't close
                return;
            }
        }
        // If response === 'discard', continue with closing
    }

    // Cleanup temp directory
    await window.textimg.closeTab(tabId);

    // Remove from DOM
    const tabEl = tabsContainer.querySelector(`[data-tab-id="${tabId}"]`);
    if (tabEl) tabEl.remove();

    // Remove from state and order
    state.tabs.delete(tabId);
    state.tabOrder = state.tabOrder.filter(id => id !== tabId);

    // Switch to another tab or create new one
    if (state.activeTabId === tabId) {
        state.activeTabId = null;
        if (state.tabOrder.length > 0) {
            switchToTab(state.tabOrder[0]);
        } else {
            showWelcomeScreen();
        }
    }

    updateTabsVisibility();
    saveSessionState();
}

export async function switchToTab(tabId: string): Promise<void> {
    if (state.activeTabId === tabId) return;

    // Save current editor content to old tab
    const oldTabId = state.activeTabId;
    if (oldTabId) {
        saveEditorToState(oldTabId);
    }

    // Update activeTabId BEFORE updating UI
    state.activeTabId = tabId;

    // Now update both tabs' UI (old will lose active, new will gain active)
    if (oldTabId) {
        updateTabUI(oldTabId);
    }
    updateTabUI(tabId);

    const tabState = state.tabs.get(tabId);
    if (!tabState) return;

    updateHeaderPath(formatHeaderText(tabState.filePath, tabState.fullTitle || tabState.title, tabState.modified));
    scrollTabIntoView(tabId);

    // Render content to editor BEFORE loading images
    // This ensures content shows immediately
    renderContentToEditor(tabState);

    // Load images if not already loaded (lazy loading)
    if (tabState.filePath && !tabState.imagesLoaded) {
        const result = await window.textimg.loadImages({ filePath: tabState.filePath, tabId });
        if (result.success && result.imageMap) {
            tabState.imageMap = result.imageMap;
            tabState.imagesLoaded = true;
            // Re-render to show loaded images
            renderContentToEditor(tabState);
        }
    }

    // Update status bar
    updateStatusBar();

    // Save session
    saveSessionState();
}

export function switchToNextTab(): void {
    if (state.tabOrder.length <= 1) return;

    const currentIndex = state.activeTabId ? state.tabOrder.indexOf(state.activeTabId) : -1;
    if (currentIndex === -1) return;

    const nextIndex = (currentIndex + 1) % state.tabOrder.length;
    switchToTab(state.tabOrder[nextIndex]);
}

export function switchToPreviousTab(): void {
    if (state.tabOrder.length <= 1) return;

    const currentIndex = state.activeTabId ? state.tabOrder.indexOf(state.activeTabId) : -1;
    if (currentIndex === -1) return;

    const prevIndex = (currentIndex - 1 + state.tabOrder.length) % state.tabOrder.length;
    switchToTab(state.tabOrder[prevIndex]);
}

// ============================================
// UI Rendering
// ============================================

function renderTab(tabState: TabState): void {
    const tab = document.createElement('div');
    tab.className = 'tab';
    tab.dataset.tabId = tabState.id;
    tab.draggable = true;

    tab.innerHTML = `
        <span class="tab-icon">📄</span>
        <span class="tab-title"></span>
        <span class="tab-modified-indicator">●</span>
        <span class="tab-close" title="Close">×</span>
    `;
    (tab.querySelector('.tab-title') as HTMLSpanElement).textContent = tabState.title;

    // Apply state-based classes on initial render
    tab.classList.toggle('modified', tabState.modified);
    tab.classList.toggle('active', tabState.id === state.activeTabId);

    tab.addEventListener('click', (e: MouseEvent) => {
        if (!(e.target as HTMLElement).classList.contains('tab-close')) {
            switchToTab(tabState.id);
        }
    });

    (tab.querySelector('.tab-close') as HTMLSpanElement).addEventListener('click', (e: MouseEvent) => {
        e.stopPropagation();
        closeTab(tabState.id);
    });

    // Drag and drop handlers
    tab.addEventListener('dragstart', handleTabDragStart);
    tab.addEventListener('dragend', handleTabDragEnd);
    tab.addEventListener('dragover', handleTabDragOver);
    tab.addEventListener('dragleave', handleTabDragLeave);
    tab.addEventListener('drop', handleTabDrop);

    tabsContainer.appendChild(tab);
}

export function updateTabUI(tabId: string): void {
    const tabState = state.tabs.get(tabId);
    if (!tabState) return;

    const tabEl = tabsContainer.querySelector(`[data-tab-id="${tabId}"]`);
    if (!tabEl) return;

    (tabEl.querySelector('.tab-title') as HTMLSpanElement).textContent = tabState.title;
    tabEl.classList.toggle('modified', tabState.modified);
    tabEl.classList.toggle('active', tabId === state.activeTabId);
}

function scrollTabIntoView(tabId: string): void {
    const tab = tabsContainer.querySelector(`[data-tab-id="${tabId}"]`);
    if (!tab) return;
    tab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
}

// ============================================
// Drag and Drop
// ============================================

function handleTabDragStart(e: DragEvent): void {
    const target = e.currentTarget as HTMLDivElement;
    state.draggedTabId = target.dataset.tabId || null;
    target.classList.add('dragging');
    if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', state.draggedTabId || '');
    }
}

function handleTabDragEnd(e: DragEvent): void {
    (e.currentTarget as HTMLDivElement).classList.remove('dragging');
    state.draggedTabId = null;

    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('drag-over-left', 'drag-over-right');
    });
}

function handleTabDragOver(e: DragEvent): void {
    e.preventDefault();
    if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'move';
    }

    const tab = e.currentTarget as HTMLDivElement;
    if (tab.dataset.tabId === state.draggedTabId) return;

    const rect = tab.getBoundingClientRect();
    const midpoint = rect.left + rect.width / 2;

    tab.classList.remove('drag-over-left', 'drag-over-right');
    if (e.clientX < midpoint) {
        tab.classList.add('drag-over-left');
    } else {
        tab.classList.add('drag-over-right');
    }
}

function handleTabDragLeave(e: DragEvent): void {
    (e.currentTarget as HTMLDivElement).classList.remove('drag-over-left', 'drag-over-right');
}

function handleTabDrop(e: DragEvent): void {
    e.preventDefault();

    const targetTab = e.currentTarget as HTMLDivElement;
    const targetId = targetTab.dataset.tabId;

    if (!state.draggedTabId || state.draggedTabId === targetId || !targetId) return;

    const rect = targetTab.getBoundingClientRect();
    const midpoint = rect.left + rect.width / 2;
    const insertBefore = e.clientX < midpoint;

    const draggedIndex = state.tabOrder.indexOf(state.draggedTabId);
    state.tabOrder.splice(draggedIndex, 1);

    let targetIndex = state.tabOrder.indexOf(targetId);
    if (!insertBefore) targetIndex++;

    state.tabOrder.splice(targetIndex, 0, state.draggedTabId);

    reorderTabsDOM();
    targetTab.classList.remove('drag-over-left', 'drag-over-right');
}

function reorderTabsDOM(): void {
    state.tabOrder.forEach(tabId => {
        const tab = tabsContainer.querySelector(`[data-tab-id="${tabId}"]`);
        if (tab) {
            tabsContainer.appendChild(tab);
        }
    });
}

// ============================================
// File Operations
// ============================================

export async function openFile(filePath: string | null = null): Promise<void> {
    hideWelcomeScreen();
    if (!filePath) {
        filePath = await window.textimg.openDialog();
        if (!filePath) return;
    }

    for (const [tabId, tabState] of state.tabs) {
        if (tabState.filePath === filePath) {
            switchToTab(tabId);
            return;
        }
    }

    const tabId = generateTabId();
    const result = await window.textimg.openFile(filePath, tabId);

    if (!result.success || !result.content) {
        console.error('Failed to open file:', result.error);
        return;
    }

    const tabState: TabState = {
        id: tabId,
        filePath,
        title: truncateTabTitle(getFilename(filePath)),
        modified: false,
        imagesLoaded: false,
        content: result.content,
        imageMap: {},
        tempImages: {}
    };

    state.tabs.set(tabId, tabState);
    state.tabOrder.push(tabId);
    renderTab(tabState);
    switchToTab(tabId);
    updateTabsVisibility();

    saveSessionState();
}

export async function saveFile(): Promise<void> {
    if (!state.activeTabId) return;

    const tabState = state.tabs.get(state.activeTabId);
    if (!tabState) return;

    let filePath = tabState.filePath;
    if (!filePath) {
        // Use tab title as default filename, or 'Untitled' if untitled
        let defaultName = tabState.title !== 'Untitled' ? tabState.title : 'Untitled.txti';
        // Add .txti extension if not already present
        if (defaultName !== 'Untitled.txti' && !defaultName.endsWith('.txti')) {
            defaultName += '.txti';
        }
        filePath = await window.textimg.saveDialog(defaultName);
        if (!filePath) return;
    }

    saveEditorToState(state.activeTabId);

    const result = await window.textimg.saveFile({
        tabId: state.activeTabId,
        filePath,
        content: tabState.content,
        imageMap: tabState.imageMap,
        tempImages: tabState.tempImages
    });

    if (result.success) {
        tabState.filePath = filePath;
        tabState.fullTitle = getFilename(filePath);
        tabState.title = truncateTabTitle(tabState.fullTitle);
        tabState.modified = false;

        Object.assign(tabState.imageMap, tabState.tempImages);
        tabState.tempImages = {};
        updateHeaderPath(formatHeaderText(filePath, tabState.fullTitle || tabState.title, tabState.modified));

        updateTabUI(state.activeTabId);
        saveSessionState();
    }
}

export async function saveFileAs(): Promise<void> {
    if (!state.activeTabId) return;

    const tabState = state.tabs.get(state.activeTabId);
    if (!tabState) return;

    // Always show save dialog, use current path or tab title as default
    let defaultPath = tabState.filePath;
    if (!defaultPath) {
        defaultPath = tabState.title !== 'Untitled' ? tabState.title : 'Untitled.txti';
        // Add .txti extension if not already present
        if (defaultPath !== 'Untitled.txti' && !defaultPath.endsWith('.txti')) {
            defaultPath += '.txti';
        }
    }
    const filePath = await window.textimg.saveAsDialog(defaultPath);
    if (!filePath) return;

    saveEditorToState(state.activeTabId);

    const result = await window.textimg.saveFile({
        tabId: state.activeTabId,
        filePath,
        content: tabState.content,
        imageMap: tabState.imageMap,
        tempImages: tabState.tempImages
    });

    if (result.success) {
        tabState.filePath = filePath;
        tabState.fullTitle = getFilename(filePath);
        tabState.title = truncateTabTitle(tabState.fullTitle);
        tabState.modified = false;

        Object.assign(tabState.imageMap, tabState.tempImages);
        tabState.tempImages = {};
        updateHeaderPath(formatHeaderText(filePath, tabState.fullTitle || tabState.title, tabState.modified));
        updateTabUI(state.activeTabId);
        saveSessionState();
    }
}

async function saveSessionState(): Promise<void> {
    // Save current editor content to active tab before persisting
    if (state.activeTabId) {
        saveEditorToState(state.activeTabId);
    }

    // Build tabs array with full content
    const tabs: any[] = [];
    for (const tabState of state.tabs.values()) {
        const tabData: any = {
            id: tabState.id,
            filePath: tabState.filePath,
            title: tabState.title,
            fullTitle: tabState.fullTitle,
            modified: tabState.modified,
            content: tabState.content
        };

        // For unsaved tabs, persist temp images as base64
        if (!tabState.filePath && Object.keys(tabState.tempImages).length > 0) {
            const filenames = Object.keys(tabState.tempImages);
            const imageData = await window.textimg.readTempImages(tabState.id, filenames);
            tabData.tempImageData = imageData;
        }

        tabs.push(tabData);
    }

    await window.textimg.saveFullSession({
        tabs,
        tabOrder: state.tabOrder,
        activeTabId: state.activeTabId
    });
}

export async function restoreSession(): Promise<void> {
    const session = await window.textimg.getFullSession();

    // If no full session, try legacy or create new tab
    if (!session || !session.tabs || session.tabs.length === 0) {
        // Try legacy session (file paths only)
        const filePaths = await window.textimg.getSession();
        if (filePaths.length > 0) {
            for (const filePath of filePaths) {
                await openFile(filePath);
            }
        } else {
            createTab();
        }
        return;
    }

    // Restore tabs from full session
    for (const savedTab of session.tabs) {
        const tabState: TabState = {
            id: savedTab.id,
            filePath: savedTab.filePath,
            title: savedTab.title,
            fullTitle: savedTab.fullTitle || (savedTab.filePath ? getFilename(savedTab.filePath) : getDisplayTitleFromContent(savedTab.content || [])),
            modified: savedTab.modified,
            imagesLoaded: false,
            content: savedTab.content || [],
            imageMap: {},
            tempImages: {}
        };

        state.tabs.set(savedTab.id, tabState);
        state.tabOrder.push(savedTab.id);
        renderTab(tabState);

        // Initialize temp directory
        await window.textimg.newFile(savedTab.id);

        // Restore temp images from base64 if present
        if (savedTab.tempImageData && Object.keys(savedTab.tempImageData).length > 0) {
            const restoredPaths = await window.textimg.restoreTempImages(savedTab.id, savedTab.tempImageData);
            tabState.tempImages = restoredPaths;
        }
    }

    // Restore tab order if different from insertion order
    if (session.tabOrder) {
        state.tabOrder = session.tabOrder.filter((id: string) => state.tabs.has(id));
        reorderTabsDOM();
    }

    // Switch to previously active tab
    const activeId = session.activeTabId && state.tabs.has(session.activeTabId)
        ? session.activeTabId
        : state.tabOrder[0];

    if (activeId) {
        await switchToTab(activeId);
    }

    updateTabsVisibility();
}

// Create a debounced version for frequent saves
export const debouncedSaveSession = debounce(() => saveSessionState(), 500);

// Export the full session state saver for beforeunload
export const saveFullSessionState = saveSessionState;
