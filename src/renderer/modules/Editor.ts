import { state } from './state.js';
import { truncateTabTitle, formatHeaderText, getDisplayTitle } from './utils.js';
import { TabState } from '../../types';

type UpdateFunction = (tabId: string) => void;
type StatusBarFunction = () => void;
type SaveSessionFunction = () => void;

let updateTabUI: UpdateFunction = () => { };
let updateStatusBar: StatusBarFunction = () => { };
let updateHeaderPath: (text: string) => void = () => { };

export function setUpdateTabUI(fn: UpdateFunction): void {
    updateTabUI = fn;
}

export function setUpdateStatusBar(fn: StatusBarFunction): void {
    updateStatusBar = fn;
}

export function setUpdateHeaderPath(fn: (text: string) => void): void {
    updateHeaderPath = fn;
}

let debouncedSaveSession: SaveSessionFunction = () => { };

export function setDebouncedSaveSession(fn: SaveSessionFunction): void {
    debouncedSaveSession = fn;
}

// DOM Elements
const editor = document.getElementById('editor') as HTMLDivElement;

// Image resize state
let selectedImage: HTMLImageElement | null = null;
let resizeHandle: HTMLDivElement | null = null;
let isResizing = false;
let resizeStartX = 0;
let resizeStartWidth = 0;

export function initEditor(): void {
    editor.removeEventListener('paste', handlePaste); // Prevent duplicates
    editor.addEventListener('paste', handlePaste);
    editor.addEventListener('keydown', handleEditorKeyDown);

    editor.addEventListener('input', () => {
        markModified();
        updateStatusBar();
        updateCurrentTabTitle();
        debouncedSaveSession(); // Auto-save 1 second after typing stops
    });

    editor.addEventListener('keyup', updateStatusBar);
    editor.addEventListener('click', (e: MouseEvent) => {
        updateStatusBar();
        handleEditorClick(e);
    });
    editor.addEventListener('focus', updateStatusBar);

    // Image interactions
    editor.addEventListener('click', handleImageClick);
    (document.getElementById('editor-container') as HTMLDivElement).addEventListener('scroll', updateHandlePosition);
    window.addEventListener('resize', updateHandlePosition);
}

export function getEditorElement(): HTMLDivElement {
    return editor;
}

// ============================================
// Content Management
// ============================================

export function renderContentToEditor(tabState: TabState): void {
    editor.innerHTML = '';
    deselectImage();

    for (const item of tabState.content) {
        if (item.type === 'text') {
            const p = document.createElement('p');
            p.textContent = item.val || '';
            editor.appendChild(p);
        } else if (item.type === 'img') {
            const img = document.createElement('img');
            img.dataset.filename = item.src;

            if (item.width) {
                img.style.width = `${item.width}px`;
                img.dataset.width = item.width.toString();
            }

            if (tabState.tempImages[item.src || '']) {
                img.src = `file://${tabState.tempImages[item.src || '']}`;
            } else if (tabState.imageMap[item.src || '']) {
                img.src = `file://${tabState.imageMap[item.src || '']}`;
            } else {
                img.classList.add('loading');
                img.alt = `Loading: ${item.src}`;
            }

            editor.appendChild(img);
        }
    }
}

export function saveEditorToState(tabId: string): void {
    const tabState = state.tabs.get(tabId);
    if (!tabState) return;

    const content: Array<{ type: 'text' | 'img'; val?: string; src?: string; width?: number }> = [];
    const children = editor.childNodes;

    for (const child of children) {
        if (child.nodeType === Node.TEXT_NODE) {
            const text = child.textContent;
            if (text && text.trim()) {
                const lines = text.split(/\r?\n/);
                for (const line of lines) {
                    if (line.trim()) { // Optional: preserve empty lines? If we want paragraphs, empty lines might be ignored or treated as empty P.
                        // Standard behavior: text block.
                        // But verifying the test: it expects >3 Ps.
                        content.push({ type: 'text', val: line });
                    }
                }
            }
        } else if (child.nodeType === Node.ELEMENT_NODE) {
            const element = child as HTMLElement;
            if (element.tagName === 'IMG') {
                const img = element as HTMLImageElement;
                const filename = img.dataset.filename;
                if (filename) {
                    const imgItem: { type: 'img'; src: string; width?: number } = { type: 'img', src: filename };
                    if (img.dataset.width) {
                        imgItem.width = parseInt(img.dataset.width);
                    }
                    content.push(imgItem);
                }
            } else if (element.tagName === 'DIV' || element.tagName === 'P') {
                const text = element.textContent;
                if (text && text.trim()) {
                    const lines = text.split(/\r?\n/);
                    for (const line of lines) {
                        if (line.trim()) {
                            content.push({ type: 'text', val: line });
                        }
                    }
                }
                const imgs = element.querySelectorAll('img');
                for (const img of imgs) {
                    const filename = img.dataset.filename;
                    if (filename) {
                        const imgItem: { type: 'img'; src: string; width?: number } = { type: 'img', src: filename };
                        if (img.dataset.width) {
                            imgItem.width = parseInt(img.dataset.width);
                        }
                        content.push(imgItem);
                    }
                }
            } else if (element.tagName === 'BR') {
                content.push({ type: 'text', val: '\n' });
            }
        }
    }

    tabState.content = content;
}

export function markModified(): void {
    const tabState = state.tabs.get(state.activeTabId!);
    if (tabState && !tabState.modified) {
        tabState.modified = true;
        updateTabUI(state.activeTabId!);
        updateHeaderPath(formatHeaderText(tabState.filePath, tabState.fullTitle || tabState.title, true));
    }
}

// ============================================
// Image Logic
// ============================================

function handleImageClick(e: MouseEvent): void {
    const target = e.target as HTMLElement;
    if (target.tagName === 'IMG' && target.closest('#editor')) {
        e.stopPropagation();
        selectImage(target as HTMLImageElement);
    }
}

function handleEditorClick(e: MouseEvent): void {
    const target = e.target as HTMLElement;
    if (target.tagName !== 'IMG' && !target.classList.contains('resize-handle')) {
        deselectImage();
    }
}

function selectImage(img: HTMLImageElement): void {
    deselectImage();

    selectedImage = img;
    img.classList.add('selected');

    resizeHandle = document.createElement('div');
    resizeHandle.className = 'resize-handle';
    updateHandlePosition();
    (document.getElementById('editor-container') as HTMLDivElement).appendChild(resizeHandle);
    resizeHandle.addEventListener('mousedown', startResize);
}

export function deselectImage(): void {
    if (selectedImage) {
        selectedImage.classList.remove('selected');
        selectedImage = null;
    }
    if (resizeHandle && resizeHandle.parentNode) {
        resizeHandle.parentNode.removeChild(resizeHandle);
        resizeHandle = null;
    }
}

function updateHandlePosition(): void {
    if (!selectedImage || !resizeHandle) return;
    const imgRect = selectedImage.getBoundingClientRect();
    const containerRect = (document.getElementById('editor-container') as HTMLDivElement).getBoundingClientRect();
    resizeHandle.style.left = `${imgRect.right - containerRect.left - 6}px`;
    resizeHandle.style.top = `${imgRect.bottom - containerRect.top - 6}px`;
}

function startResize(e: MouseEvent): void {
    e.preventDefault();
    e.stopPropagation();
    if (!selectedImage) return;

    isResizing = true;
    resizeStartX = e.clientX;
    resizeStartWidth = selectedImage.offsetWidth;

    document.addEventListener('mousemove', doResize);
    document.addEventListener('mouseup', stopResize);
}

function doResize(e: MouseEvent): void {
    if (!isResizing || !selectedImage) return;
    const deltaX = e.clientX - resizeStartX;
    let newWidth = resizeStartWidth + deltaX;
    const maxWidth = (document.getElementById('editor-container') as HTMLDivElement).offsetWidth - 32;
    newWidth = Math.max(50, Math.min(maxWidth, newWidth));

    selectedImage.style.width = `${newWidth}px`;
    selectedImage.style.height = 'auto';
    selectedImage.dataset.width = newWidth.toString();
    updateHandlePosition();
}

function stopResize(): void {
    if (isResizing) {
        isResizing = false;
        markModified();
    }
    document.removeEventListener('mousemove', doResize);
    document.removeEventListener('mouseup', stopResize);
}

export function insertImage(filename: string, filePath: string): void {
    const img = document.createElement('img');
    img.src = `file://${filePath}`;
    img.dataset.filename = filename;

    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
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

async function handlePaste(e: ClipboardEvent): Promise<void> {
    e.preventDefault(); // Always prevent default to stop rich text pasting

    const clipboardData = e.clipboardData;
    if (!clipboardData) return;

    // 1. Handle Text (if any) - this strips HTML/Rich Text
    const text = clipboardData.getData('text/plain');
    if (text) {
        document.execCommand('insertText', false, text);
    }

    let handled = false;
    // 2. Handle Images (if any)
    if (clipboardData.items) {
        for (const item of clipboardData.items) {
            if (item.type.startsWith('image/')) {
                await handleImagePaste(item);
                handled = true;
                break; // Stop after first image found
            }
        }
    }

    if (handled) return;

    // 3. Native Image Fallback (only if no files were found in items, or maybe just try anyway)
    // The original logic tried this if no items were found.
    // Let's try it if we didn't find any images in the loop above?
    // Actually, the original logic returned after finding ONE image.
    // Let's stick to the plan: try to find images in clipboard items first.
    // If we rely on the loop above, we might miss the "buffer" copy from Electron if it's not in items.
    // But `readClipboardImage` reads from Electron clipboard directly.

    // Check if we already processed an image from items?
    // The `handleImagePaste` inserts the image.

    // Let's check native clipboard if no images were found in DataTransferItems
    const hasImagesInItems = Array.from(clipboardData.items).some(item => item.type.startsWith('image/'));

    if (!hasImagesInItems) {
        const imageBuffer = await (window as any).textimg.readClipboardImage();
        if (imageBuffer) {
            await handleNativeImagePaste(imageBuffer);
        }
    }
}

async function handleImagePaste(item: DataTransferItem): Promise<void> {
    const tabState = state.tabs.get(state.activeTabId!);
    if (!tabState) return;

    const blob = item.getAsFile();
    if (!blob) return;

    const buffer = await blob.arrayBuffer();
    const result = await (window as any).textimg.saveClipboardBuffer(state.activeTabId!, Array.from(new Uint8Array(buffer)) as any);

    if (result.success && result.filename && result.filePath) {
        insertImage(result.filename, result.filePath);
        tabState.tempImages[result.filename] = result.filePath;
        markModified();
    }
}

async function handleNativeImagePaste(buffer: any): Promise<void> {
    const tabState = state.tabs.get(state.activeTabId!);
    if (!tabState) return;
    const result = await (window as any).textimg.saveClipboardBuffer(state.activeTabId!, Array.from(buffer) as any);
    if (result.success && result.filename && result.filePath) {
        insertImage(result.filename, result.filePath);
        tabState.tempImages[result.filename] = result.filePath;
        markModified();
    }
}

// ============================================
// Auto Indent / Logic
// ============================================

function handleEditorKeyDown(e: KeyboardEvent): void {
    // Disable rich text shortcuts
    if ((e.ctrlKey || e.metaKey) && ['b', 'i', 'u'].includes(e.key.toLowerCase())) {
        e.preventDefault();
        return;
    }

    if (e.key === 'Enter' && state.settings.autoIndent) {
        e.preventDefault();
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;
        const range = selection.getRangeAt(0);
        const preCaretRange = range.cloneRange();
        preCaretRange.selectNodeContents(editor);
        preCaretRange.setEnd(range.startContainer, range.startOffset);
        const textBeforeCursor = preCaretRange.toString();
        const indent = getLineIndent(textBeforeCursor);
        const newline = getNewlineChar();

        // Use execCommand for better undo/redo support if possible, otherwise fall back
        if (document.queryCommandSupported('insertText')) {
            document.execCommand('insertText', false, newline + indent);
        } else {
            range.deleteContents();
            const textNode = document.createTextNode(newline + indent);
            range.insertNode(textNode);
            range.setStartAfter(textNode);
            range.setEndAfter(textNode);
            selection.removeAllRanges();
            selection.addRange(range);
        }

        markModified();
        updateStatusBar();
        updateCurrentTabTitle();
        // Scroll to cursor
        const rect = range.getBoundingClientRect();
        if (rect.bottom > editor.getBoundingClientRect().bottom) {
            editor.scrollTop += rect.height;
        }
    }

    if (e.key === 'Tab') {
        e.preventDefault();
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;
        const range = selection.getRangeAt(0);
        range.deleteContents();
        const tabText = state.settings.indentChar === 'tab' ? '\t' : ' '.repeat(state.settings.indentSize);
        const textNode = document.createTextNode(tabText);
        range.insertNode(textNode);
        range.setStartAfter(textNode);
        range.setEndAfter(textNode);
        selection.removeAllRanges();
        selection.addRange(range);
        markModified();
    }
}

function getLineIndent(text: string): string {
    const lines = text.split('\n');
    const currentLine = lines[lines.length - 1];
    const match = currentLine.match(/^[\t ]*/);
    return match ? match[0] : '';
}

function getNewlineChar(): string {
    switch (state.settings.lineFeed) {
        case 'CRLF': return '\r\n';
        case 'CR': return '\r';
        default: return '\n';
    }
}

// ============================================
// Title Updates
// ============================================



function updateCurrentTabTitle(): void {
    if (!state.activeTabId) return;
    const tabState = state.tabs.get(state.activeTabId);
    if (!tabState) return;

    // Only update title for unsaved files (no filePath)
    if (tabState.filePath) return;

    const text = editor.innerText;
    const rawTitle = getDisplayTitle(text);
    const tabTitle = truncateTabTitle(rawTitle);

    if (tabState.title !== tabTitle || tabState.fullTitle !== rawTitle) {
        tabState.title = tabTitle;
        tabState.fullTitle = rawTitle;
        updateTabUI(state.activeTabId);
        updateHeaderPath(formatHeaderText(null, rawTitle, tabState.modified));
    }
}

export function undo(): void { document.execCommand('undo'); }
export function redo(): void { document.execCommand('redo'); }

export function setZoom(level: number): void {
    state.zoomLevel = Math.max(10, Math.min(500, level));
    editor.style.fontSize = `${15 * (state.zoomLevel / 100)}px`;
}
