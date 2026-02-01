import { initEditor, setUpdateTabUI, setUpdateStatusBar, setDebouncedSaveSession } from './modules/Editor.js';
import { initSettings, loadSettings } from './modules/SettingsManager.js';
import { initUI, updateStatusBar } from './modules/UIManager.js';
import { createTab, openFile, saveFile, saveFileAs, closeTab, restoreSession, updateTabUI, debouncedSaveSession, saveFullSessionState } from './modules/TabManager.js';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Initialize modules
        await loadSettings();
        initSettings();

        setUpdateTabUI(updateTabUI);
        setUpdateStatusBar(updateStatusBar);
        setDebouncedSaveSession(debouncedSaveSession);
        initEditor();

        initUI({
            createTab,
            openFile,
            saveFile,
            saveFileAs,
            closeTab
        });

        // Check if this is the first window (should restore session) or a new window (fresh)
        const urlParams = new URLSearchParams(window.location.search);
        const isFirstWindow = urlParams.get('isFirstWindow') === '1';

        if (isFirstWindow) {
            // First window - restore session
            await restoreSession();
        } else {
            // New window - start fresh with single empty tab
            createTab();
        }
        updateStatusBar();

        // Welcome screen buttons
        document.getElementById('welcome-new-file')?.addEventListener('click', () => createTab());
        document.getElementById('welcome-open-file')?.addEventListener('click', () => openFile());

        // Drag and drop support
        document.addEventListener('dragover', (e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
        });

        document.addEventListener('drop', async (e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation();

            if (!e.dataTransfer) return;

            for (const file of Array.from(e.dataTransfer.files)) {
                const filePath = (file as any).path;
                if (filePath) {
                    await openFile(filePath);
                }
            }
        });

        // Save full session on app close
        window.addEventListener('beforeunload', () => {
            saveFullSessionState();
        });
    } catch (error: any) {
        console.error('Failed to initialize application:', error);
        document.body.innerHTML = `<div style="padding: 20px; color: red; font-family: monospace;">
            <h2>Application failed to initialize</h2>
            <pre>${error.stack || error.message || error}</pre>
        </div>`;
    }
});
