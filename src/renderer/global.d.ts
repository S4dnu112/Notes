// Global type definitions for renderer process

import { Content, ImageMap, SessionData, TabState, EditorSettings } from '../types/index';

interface TexImgAPI {
    // Window controls
    minimize: () => void;
    maximize: () => void;
    forceClose: () => void;
    newWindow: () => void;
    showMenu: () => void;
    getWindowCount: () => Promise<number>;
    isMaximized: () => Promise<boolean>;

    // File operations
    newFile: (tabId: string) => Promise<void>;
    openDialog: () => Promise<string | null>;
    openFile: (filePath: string, tabId: string) => Promise<{ success: boolean; content?: Content; error?: string }>;
    saveDialog: (defaultName: string) => Promise<string | null>;
    saveAsDialog: (currentPath: string) => Promise<string | null>;
    saveFile: (data: { tabId: string; filePath: string; content: Content; imageMap: ImageMap; tempImages: ImageMap }) => Promise<{ success: boolean; error?: string }>;
    loadImages: (data: { filePath: string; tabId: string }) => Promise<{ success: boolean; imageMap?: ImageMap; error?: string }>;

    // Session management
    getSession: () => Promise<string[]>;
    saveSession: (filePaths: string[]) => Promise<void>;
    getFullSession: () => Promise<SessionData | null>;
    saveFullSession: (sessionData: SessionData) => Promise<void>;
    saveTabContent: (tabData: TabState) => Promise<void>;

    // Settings
    getSettings: () => Promise<EditorSettings>;
    saveSettings: (settings: EditorSettings) => Promise<void>;

    // Dialogs
    showUnsavedChangesDialog: (title: string) => Promise<'save' | 'discard' | 'cancel'>;
    showMultipleUnsavedChangesDialog: (filenames: string[]) => Promise<'save' | 'discard' | 'cancel'>;

    // Tab management
    closeTab: (tabId: string) => Promise<void>;
    readTempImages: (tabId: string, filenames: string[]) => Promise<Record<string, string>>;
    restoreTempImages: (tabId: string, tempImageData: Record<string, string>) => Promise<Record<string, string>>;

    // Clipboard & temp management
    readClipboardImage: () => Promise<{ success: boolean; buffer?: Buffer; error?: string }>;
    saveClipboardBuffer: (tabId: string, buffer: Buffer) => Promise<{ success: boolean; filename?: string; filePath?: string; error?: string }>;
    pasteImage: (tabId: string, imageDataUrl: string) => Promise<{ success: boolean; filename?: string; filePath?: string; error?: string }>;
    createTempDir: (tabId: string) => Promise<string>;
    cleanupTempDir: (tabId: string) => Promise<void>;

    // Event listeners
    onMaximizedChange: (callback: (isMaximized: boolean) => void) => void;
    onMenuAction: (callback: (action: string) => void) => void;
    onCloseRequest: (callback: (data: { isLastWindow: boolean }) => void) => void;
}

declare global {
    interface Window {
        teximg: TexImgAPI;
    }
}

export { };
