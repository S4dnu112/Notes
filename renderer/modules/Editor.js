import { state } from './state.js';
import { getFilename } from './utils.js';
// UIManager import removed. Injected.

let updateTabUI = () => { }; // No-op until injected
let updateStatusBar = () => { }; // No-op until injected

export function setUpdateTabUI(fn) {
    updateTabUI = fn;
}

export function setUpdateStatusBar(fn) {
    updateStatusBar = fn;
}

let debouncedSaveSession = () => { }; // No-op until injected

export function setDebouncedSaveSession(fn) {
    debouncedSaveSession = fn;
}

// DOM Elements
const editor = document.getElementById('editor');

// Image resize state
let selectedImage = null;
let resizeHandle = null;
let isResizing = false;
let resizeStartX = 0;
let resizeStartWidth = 0;

export function initEditor() {
    editor.addEventListener('paste', handlePaste);
    editor.addEventListener('keydown', handleEditorKeyDown);

    editor.addEventListener('input', () => {
        markModified();
        updateStatusBar();
        updateCurrentTabTitle();
        debouncedSaveSession(); // Auto-save 1 second after typing stops
    });

    editor.addEventListener('keyup', updateStatusBar);
    editor.addEventListener('click', (e) => {
        updateStatusBar();
        handleEditorClick(e);
    });
    editor.addEventListener('focus', updateStatusBar);

    // Image interactions
    editor.addEventListener('click', handleImageClick);
    document.getElementById('editor-container').addEventListener('scroll', updateHandlePosition);
    window.addEventListener('resize', updateHandlePosition);

    // Zoom/Settings checks? (Might be in UIManager or SettingsManager)
    // Actually, zoom functions are related to editor.
}

export function getEditorElement() {
    return editor;
}

// ============================================
// Content Management
// ============================================

export function renderContentToEditor(tabState) {
    editor.innerHTML = '';
    deselectImage();

    for (const item of tabState.content) {
        if (item.type === 'text') {
            const p = document.createElement('p');
            p.textContent = item.val;
            editor.appendChild(p);
        } else if (item.type === 'img') {
            const img = document.createElement('img');
            img.dataset.filename = item.src;

            if (item.width) {
                img.style.width = `${item.width}px`;
                img.dataset.width = item.width;
            }

            if (tabState.tempImages[item.src]) {
                img.src = `file://${tabState.tempImages[item.src]}`;
            } else if (tabState.imageMap[item.src]) {
                img.src = `file://${tabState.imageMap[item.src]}`;
            } else {
                img.classList.add('loading');
                img.alt = `Loading: ${item.src}`;
            }

            editor.appendChild(img);
        }
    }
}

export function saveEditorToState(tabId) {
    const tabState = state.tabs.get(tabId);
    if (!tabState) return;

    const content = [];
    const children = editor.childNodes;

    for (const child of children) {
        if (child.nodeType === Node.TEXT_NODE) {
            const text = child.textContent;
            if (text.trim()) {
                content.push({ type: 'text', val: text });
            }
        } else if (child.nodeType === Node.ELEMENT_NODE) {
            if (child.tagName === 'IMG') {
                const filename = child.dataset.filename;
                if (filename) {
                    const imgItem = { type: 'img', src: filename };
                    if (child.dataset.width) {
                        imgItem.width = parseInt(child.dataset.width);
                    }
                    content.push(imgItem);
                }
            } else if (child.tagName === 'DIV' || child.tagName === 'P') {
                const text = child.textContent;
                if (text.trim()) {
                    content.push({ type: 'text', val: text });
                }
                const imgs = child.querySelectorAll('img');
                for (const img of imgs) {
                    const filename = img.dataset.filename;
                    if (filename) {
                        const imgItem = { type: 'img', src: filename };
                        if (img.dataset.width) {
                            imgItem.width = parseInt(img.dataset.width);
                        }
                        content.push(imgItem);
                    }
                }
            } else if (child.tagName === 'BR') {
                content.push({ type: 'text', val: '\n' });
            }
        }
    }

    tabState.content = content;
}

export function markModified() {
    const tabState = state.tabs.get(state.activeTabId);
    if (tabState && !tabState.modified) {
        tabState.modified = true;
        updateTabUI(state.activeTabId);
    }
}

// ============================================
// Image Logic
// ============================================

function handleImageClick(e) {
    if (e.target.tagName === 'IMG' && e.target.closest('#editor')) {
        e.stopPropagation();
        selectImage(e.target);
    }
}

function handleEditorClick(e) {
    if (e.target.tagName !== 'IMG' && !e.target.classList.contains('resize-handle')) {
        deselectImage();
    }
}

function selectImage(img) {
    deselectImage();

    selectedImage = img;
    img.classList.add('selected');

    resizeHandle = document.createElement('div');
    resizeHandle.className = 'resize-handle';
    updateHandlePosition();
    document.getElementById('editor-container').appendChild(resizeHandle);
    resizeHandle.addEventListener('mousedown', startResize);
}

export function deselectImage() {
    if (selectedImage) {
        selectedImage.classList.remove('selected');
        selectedImage = null;
    }
    if (resizeHandle && resizeHandle.parentNode) {
        resizeHandle.parentNode.removeChild(resizeHandle);
        resizeHandle = null;
    }
}

function updateHandlePosition() {
    if (!selectedImage || !resizeHandle) return;
    const imgRect = selectedImage.getBoundingClientRect();
    const containerRect = document.getElementById('editor-container').getBoundingClientRect();
    resizeHandle.style.left = `${imgRect.right - containerRect.left - 6}px`;
    resizeHandle.style.top = `${imgRect.bottom - containerRect.top - 6}px`;
}

function startResize(e) {
    e.preventDefault();
    e.stopPropagation();
    if (!selectedImage) return;

    isResizing = true;
    resizeStartX = e.clientX;
    resizeStartWidth = selectedImage.offsetWidth;

    document.addEventListener('mousemove', doResize);
    document.addEventListener('mouseup', stopResize);
}

function doResize(e) {
    if (!isResizing || !selectedImage) return;
    const deltaX = e.clientX - resizeStartX;
    let newWidth = resizeStartWidth + deltaX;
    const maxWidth = document.getElementById('editor-container').offsetWidth - 32;
    newWidth = Math.max(50, Math.min(maxWidth, newWidth));

    selectedImage.style.width = `${newWidth}px`;
    selectedImage.style.height = 'auto';
    selectedImage.dataset.width = newWidth;
    updateHandlePosition();
}

function stopResize() {
    if (isResizing) {
        isResizing = false;
        markModified();
    }
    document.removeEventListener('mousemove', doResize);
    document.removeEventListener('mouseup', stopResize);
}

export function insertImage(filename, filePath) {
    const img = document.createElement('img');
    img.src = `file://${filePath}`;
    img.dataset.filename = filename;

    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const wrapper = document.createElement('p');
        wrapper.appendChild(img);
        range.deleteContents();
        range.insertNode(wrapper);
        range.setStartAfter(wrapper);
        range.setEndAfter(wrapper);
        selection.removeAllRanges();
        selection.addRange(range);
    } else {
        const wrapper = document.createElement('p');
        wrapper.appendChild(img);
        editor.appendChild(wrapper);
    }
}

// ============================================
// Paste Logic
// ============================================

async function handlePaste(e) {
    const clipboardData = e.clipboardData;
    if (clipboardData && clipboardData.items) {
        for (const item of clipboardData.items) {
            if (item.type.startsWith('image/')) {
                e.preventDefault();
                await handleImagePaste(item);
                return;
            }
        }
    }
    const imageBuffer = await window.teximg.readClipboardImage();
    if (imageBuffer) {
        e.preventDefault();
        await handleNativeImagePaste(imageBuffer);
        return;
    }
}

async function handleImagePaste(item) {
    const tabState = state.tabs.get(state.activeTabId);
    if (!tabState) return;

    const blob = item.getAsFile();
    const buffer = await blob.arrayBuffer();
    const result = await window.teximg.saveClipboardBuffer(state.activeTabId, Array.from(new Uint8Array(buffer)));

    if (result.success) {
        insertImage(result.filename, result.filePath);
        tabState.tempImages[result.filename] = result.filePath;
        markModified();
    }
}

async function handleNativeImagePaste(buffer) {
    const tabState = state.tabs.get(state.activeTabId);
    if (!tabState) return;
    const result = await window.teximg.saveClipboardBuffer(state.activeTabId, Array.from(buffer));
    if (result.success) {
        insertImage(result.filename, result.filePath);
        tabState.tempImages[result.filename] = result.filePath;
        markModified();
    }
}

// ============================================
// Auto Indent / Logic
// ============================================

function handleEditorKeyDown(e) {
    if (e.key === 'Enter' && state.settings.autoIndent) {
        e.preventDefault();
        const selection = window.getSelection();
        if (selection.rangeCount === 0) return;
        const range = selection.getRangeAt(0);
        const preCaretRange = range.cloneRange();
        preCaretRange.selectNodeContents(editor);
        preCaretRange.setEnd(range.startContainer, range.startOffset);
        const textBeforeCursor = preCaretRange.toString();
        const indent = getLineIndent(textBeforeCursor);
        const newline = getNewlineChar();

        range.deleteContents();
        const textNode = document.createTextNode(newline + indent);
        range.insertNode(textNode);
        range.setStartAfter(textNode);
        range.setEndAfter(textNode);
        selection.removeAllRanges();
        selection.addRange(range);
        markModified();
        updateStatusBar();
        updateCurrentTabTitle();
    }

    if (e.key === 'Tab') {
        e.preventDefault();
        const selection = window.getSelection();
        if (selection.rangeCount === 0) return;
        const range = selection.getRangeAt(0);
        range.deleteContents();
        let tabText = state.settings.indentChar === 'tab' ? '\t' : ' '.repeat(state.settings.indentSize);
        const textNode = document.createTextNode(tabText);
        range.insertNode(textNode);
        range.setStartAfter(textNode);
        range.setEndAfter(textNode);
        selection.removeAllRanges();
        selection.addRange(range);
        markModified();
    }
}

function getLineIndent(text) {
    const lines = text.split('\n');
    const currentLine = lines[lines.length - 1];
    const match = currentLine.match(/^[\t ]*/);
    return match ? match[0] : '';
}

function getNewlineChar() {
    switch (state.settings.lineFeed) {
        case 'CRLF': return '\r\n';
        case 'CR': return '\r';
        default: return '\n';
    }
}

// ============================================
// Title Updates
// ============================================

function getDisplayTitle(text) {
    if (!text || !text.trim()) return 'Untitled';
    const firstLine = text.split('\n')[0].trim();
    if (!firstLine) return 'Untitled';
    return firstLine.length > 255 ? firstLine.substring(0, 255) : firstLine;
}

function updateCurrentTabTitle() {
    if (!state.activeTabId) return;
    const tabState = state.tabs.get(state.activeTabId);
    if (!tabState) return;

    const text = editor.innerText;
    const newTitle = getDisplayTitle(text);

    if (tabState.title !== newTitle) {
        tabState.title = newTitle;
        updateTabUI(state.activeTabId);
    }
}

export function undo() { document.execCommand('undo'); }
export function redo() { document.execCommand('redo'); }

export function setZoom(level) {
    state.zoomLevel = Math.max(10, Math.min(500, level));
    editor.style.fontSize = `${15 * (state.zoomLevel / 100)}px`;
    // updateZoomDisplay call will be handled by UI listeners watching state or called explicitly if needed
    // Actually, Editor doesn't touch UI directly usually, but it sets style. 
}
