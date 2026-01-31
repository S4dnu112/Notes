import { state } from './state.js';
import { generateTabId, getFilename, formatDirectoryPath, debounce } from './utils.js';
import { renderContentToEditor, saveEditorToState, deselectImage } from './Editor.js';
import { updateStatusBar, updateHeaderPath } from './UIManager.js';

// DOM Elements
const tabsContainer = document.getElementById('tabs-container');
const tabsRow = document.getElementById('tabs-row');
const welcomeScreen = document.getElementById('welcome-screen');
const editorContainer = document.getElementById('editor-container');

// ============================================
// Tab Lifecycle
// ============================================

function showWelcomeScreen() {
    if (welcomeScreen) welcomeScreen.classList.remove('hidden');
    if (editorContainer) editorContainer.classList.add('hidden');
    updateHeaderPath('');
}

function hideWelcomeScreen() {
    if (welcomeScreen) welcomeScreen.classList.add('hidden');
    if (editorContainer) editorContainer.classList.remove('hidden');
}

function updateTabsVisibility() {
    if (tabsRow) {
        if (state.tabs.size <= 1) {
            tabsRow.classList.add('hidden');
        } else {
            tabsRow.classList.remove('hidden');
        }
    }
}

export function createTab(filePath = null, content = []) {
    hideWelcomeScreen();
    const id = generateTabId();

    const tabState = {
        id,
        filePath,
        title: filePath ? getFilename(filePath) : 'Untitled',
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
    window.teximg.newFile(id);

    return id;
}

export async function closeTab(tabId) {
    const tabState = state.tabs.get(tabId);

    // Cleanup temp directory
    await window.teximg.closeTab(tabId);

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

export async function switchToTab(tabId) {
    if (state.activeTabId === tabId) return;

    // Save current editor content to old tab
    if (state.activeTabId) {
        saveEditorToState(state.activeTabId);
        const oldTab = tabsContainer.querySelector(`[data-tab-id="${state.activeTabId}"]`);
        if (oldTab) oldTab.classList.remove('active');
    }

    state.activeTabId = tabId;
    const tabState = state.tabs.get(tabId);

    updateHeaderPath(formatDirectoryPath(tabState.filePath));

    // Update tab UI
    const newTab = tabsContainer.querySelector(`[data-tab-id="${tabId}"]`);
    if (newTab) {
        newTab.classList.add('active');
        scrollTabIntoView(tabId);
    }

    // Load images if not already loaded (lazy loading)
    if (tabState.filePath && !tabState.imagesLoaded) {
        const result = await window.teximg.loadImages(tabState.filePath, tabId);
        if (result.success) {
            tabState.imageMap = result.imageMap;
            tabState.imagesLoaded = true;
        }
    }

    // Render content to editor
    renderContentToEditor(tabState);

    // Update status bar
    updateStatusBar();

    // Save session
    saveSessionState();
}

// ============================================
// UI Rendering
// ============================================

function renderTab(tabState) {
    const tab = document.createElement('div');
    tab.className = 'tab';
    tab.dataset.tabId = tabState.id;
    tab.draggable = true;

    tab.innerHTML = `
        <span class="tab-icon">📄</span>
        <span class="tab-title"></span>
        <span class="tab-close" title="Close">×</span>
    `;
    tab.querySelector('.tab-title').textContent = tabState.title;

    tab.addEventListener('click', (e) => {
        if (!e.target.classList.contains('tab-close')) {
            switchToTab(tabState.id);
        }
    });

    tab.querySelector('.tab-close').addEventListener('click', (e) => {
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

export function updateTabUI(tabId) {
    const tabState = state.tabs.get(tabId);
    if (!tabState) return;

    const tabEl = tabsContainer.querySelector(`[data-tab-id="${tabId}"]`);
    if (!tabEl) return;

    tabEl.querySelector('.tab-title').textContent = tabState.title;
    tabEl.classList.toggle('modified', tabState.modified);
    tabEl.classList.toggle('active', tabId === state.activeTabId);
}

function scrollTabIntoView(tabId) {
    const tab = tabsContainer.querySelector(`[data-tab-id="${tabId}"]`);
    if (!tab) return;
    tab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
}

export function markModified() {
    const tabState = state.tabs.get(state.activeTabId);
    if (tabState && !tabState.modified) {
        tabState.modified = true;
        updateTabUI(state.activeTabId);
    }
}

// ============================================
// Drag and Drop
// ============================================

function handleTabDragStart(e) {
    state.draggedTabId = e.currentTarget.dataset.tabId;
    e.currentTarget.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', state.draggedTabId);
}

function handleTabDragEnd(e) {
    e.currentTarget.classList.remove('dragging');
    state.draggedTabId = null;

    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('drag-over-left', 'drag-over-right');
    });
}

function handleTabDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const tab = e.currentTarget;
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

function handleTabDragLeave(e) {
    e.currentTarget.classList.remove('drag-over-left', 'drag-over-right');
}

function handleTabDrop(e) {
    e.preventDefault();

    const targetTab = e.currentTarget;
    const targetId = targetTab.dataset.tabId;

    if (!state.draggedTabId || state.draggedTabId === targetId) return;

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

function reorderTabsDOM() {
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

export async function openFile(filePath = null) {
    hideWelcomeScreen();
    if (!filePath) {
        filePath = await window.teximg.openDialog();
        if (!filePath) return;
    }

    for (const [tabId, tabState] of state.tabs) {
        if (tabState.filePath === filePath) {
            switchToTab(tabId);
            return;
        }
    }

    const tabId = generateTabId();
    const result = await window.teximg.openFile(filePath, tabId);

    if (!result.success) {
        console.error('Failed to open file:', result.error);
        return;
    }

    const tabState = {
        id: tabId,
        filePath,
        title: getFilename(filePath),
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

    saveSessionState();
}

export async function saveFile() {
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
        filePath = await window.teximg.saveDialog(defaultName);
        if (!filePath) return;
    }

    saveEditorToState(state.activeTabId);

    const imageFiles = { ...tabState.imageMap, ...tabState.tempImages };

    const result = await window.teximg.saveFile({
        filePath,
        content: tabState.content,
        imageFiles
    });

    if (result.success) {
        tabState.filePath = filePath;
        tabState.title = getFilename(filePath);
        tabState.modified = false;

        Object.assign(tabState.imageMap, tabState.tempImages);
        tabState.tempImages = {};
        updateHeaderPath(formatDirectoryPath(filePath));

        updateTabUI(state.activeTabId);
        saveSessionState();
    }
}

export async function saveFileAs() {
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
    const filePath = await window.teximg.saveAsDialog(defaultPath);
    if (!filePath) return;

    saveEditorToState(state.activeTabId);

    const imageFiles = { ...tabState.imageMap, ...tabState.tempImages };

    const result = await window.teximg.saveFile({
        filePath,
        content: tabState.content,
        imageFiles
    });

    if (result.success) {
        tabState.filePath = filePath;
        tabState.title = getFilename(filePath);
        tabState.modified = false;

        Object.assign(tabState.imageMap, tabState.tempImages);
        tabState.tempImages = {};
        updateHeaderPath(formatDirectoryPath(filePath));
        updateTabUI(state.activeTabId);
        saveSessionState();
    }
}

async function saveSessionState() {
    // Save current editor content to active tab before persisting
    if (state.activeTabId) {
        saveEditorToState(state.activeTabId);
    }

    // Build tabs array with full content
    const tabs = [];
    for (const tabState of state.tabs.values()) {
        const tabData = {
            id: tabState.id,
            filePath: tabState.filePath,
            title: tabState.title,
            modified: tabState.modified,
            content: tabState.content
        };

        // For unsaved tabs, persist temp images as base64
        if (!tabState.filePath && Object.keys(tabState.tempImages).length > 0) {
            const filenames = Object.keys(tabState.tempImages);
            const imageData = await window.teximg.readTempImages(tabState.id, filenames);
            tabData.tempImageData = imageData;
        }

        tabs.push(tabData);
    }

    await window.teximg.saveFullSession({
        tabs,
        tabOrder: state.tabOrder,
        activeTabId: state.activeTabId
    });
}

export async function restoreSession() {
    const session = await window.teximg.getFullSession();

    // If no full session, try legacy or create new tab
    if (!session || !session.tabs || session.tabs.length === 0) {
        // Try legacy session (file paths only)
        const filePaths = await window.teximg.getSession();
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
        const tabState = {
            id: savedTab.id,
            filePath: savedTab.filePath,
            title: savedTab.title,
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
        await window.teximg.newFile(savedTab.id);

        // Restore temp images from base64 if present
        if (savedTab.tempImageData && Object.keys(savedTab.tempImageData).length > 0) {
            const restoredPaths = await window.teximg.restoreTempImages(savedTab.id, savedTab.tempImageData);
            tabState.tempImages = restoredPaths;
        }
    }

    // Restore tab order if different from insertion order
    if (session.tabOrder) {
        state.tabOrder = session.tabOrder.filter(id => state.tabs.has(id));
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
