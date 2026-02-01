import { state } from './state.js';

// DOM Elements accessed by multiple functions
const editor = document.getElementById('editor') as HTMLDivElement;

export function initSettings(): void {
    // Settings controls
    const settingLineFeed = document.getElementById('setting-linefeed') as HTMLSelectElement;
    settingLineFeed.addEventListener('change', async () => {
        state.settings.lineFeed = settingLineFeed.value as 'LF' | 'CRLF' | 'CR';
        await saveCurrentSettings();
    });

    const settingWordWrap = document.getElementById('setting-wordwrap') as HTMLInputElement;
    settingWordWrap.addEventListener('change', async () => {
        state.settings.wordWrap = settingWordWrap.checked;
        await saveCurrentSettings();
    });

    const settingAutoIndent = document.getElementById('setting-autoindent') as HTMLInputElement;
    settingAutoIndent.addEventListener('change', async () => {
        state.settings.autoIndent = settingAutoIndent.checked;
        await saveCurrentSettings();
    });

    const settingIndentChar = document.getElementById('setting-indentchar') as HTMLSelectElement;
    settingIndentChar.addEventListener('change', async () => {
        state.settings.indentChar = settingIndentChar.value as 'tab' | 'space';
        await saveCurrentSettings();
    });

    const tabsizeDec = document.getElementById('tabsize-dec') as HTMLButtonElement;
    tabsizeDec.addEventListener('click', async () => {
        if (state.settings.tabSize > 1) {
            state.settings.tabSize--;
            (document.getElementById('tabsize-value') as HTMLSpanElement).textContent = state.settings.tabSize.toString();
            await saveCurrentSettings();
        }
    });

    const tabsizeInc = document.getElementById('tabsize-inc') as HTMLButtonElement;
    tabsizeInc.addEventListener('click', async () => {
        if (state.settings.tabSize < 16) {
            state.settings.tabSize++;
            (document.getElementById('tabsize-value') as HTMLSpanElement).textContent = state.settings.tabSize.toString();
            await saveCurrentSettings();
        }
    });

    const indentsizeDec = document.getElementById('indentsize-dec') as HTMLButtonElement;
    indentsizeDec.addEventListener('click', async () => {
        if (state.settings.indentSize > 1) {
            state.settings.indentSize--;
            (document.getElementById('indentsize-value') as HTMLSpanElement).textContent = state.settings.indentSize.toString();
            await saveCurrentSettings();
        }
    });

    const indentsizeInc = document.getElementById('indentsize-inc') as HTMLButtonElement;
    indentsizeInc.addEventListener('click', async () => {
        if (state.settings.indentSize < 16) {
            state.settings.indentSize++;
            (document.getElementById('indentsize-value') as HTMLSpanElement).textContent = state.settings.indentSize.toString();
            await saveCurrentSettings();
        }
    });

    (document.getElementById('settings-close') as HTMLButtonElement).addEventListener('click', closeSettings);
    (document.getElementById('settings-overlay') as HTMLDivElement).addEventListener('click', (e: MouseEvent) => {
        if (e.target === document.getElementById('settings-overlay')) closeSettings();
    });
}

export async function loadSettings(): Promise<void> {
    state.settings = await window.teximg.getSettings();
    applySettingsToUI();
    updateLineFeedDisplay();
    applyWordWrap();
}

function applySettingsToUI(): void {
    (document.getElementById('setting-linefeed') as HTMLSelectElement).value = state.settings.lineFeed;
    (document.getElementById('setting-wordwrap') as HTMLInputElement).checked = state.settings.wordWrap;
    (document.getElementById('setting-autoindent') as HTMLInputElement).checked = state.settings.autoIndent;
    (document.getElementById('setting-indentchar') as HTMLSelectElement).value = state.settings.indentChar;
    (document.getElementById('tabsize-value') as HTMLSpanElement).textContent = state.settings.tabSize.toString();
    (document.getElementById('indentsize-value') as HTMLSpanElement).textContent = state.settings.indentSize.toString();
}

export async function saveCurrentSettings(): Promise<void> {
    await window.teximg.saveSettings(state.settings);
    updateLineFeedDisplay();
    applyWordWrap();
}

export function openSettings(): void {
    (document.getElementById('settings-overlay') as HTMLDivElement).classList.remove('hidden');
}

export function closeSettings(): void {
    (document.getElementById('settings-overlay') as HTMLDivElement).classList.add('hidden');
}

function updateLineFeedDisplay(): void {
    const statusLineEnding = document.getElementById('status-lineending');
    if (!statusLineEnding) return;
    const labels: Record<string, string> = {
        'LF': 'Unix (LF)',
        'CRLF': 'Windows (CRLF)',
        'CR': 'Mac (CR)'
    };
    statusLineEnding.textContent = labels[state.settings.lineFeed] || 'Unix (LF)';
}

function applyWordWrap(): void {
    if (state.settings.wordWrap) {
        editor.classList.remove('no-wrap');
    } else {
        editor.classList.add('no-wrap');
    }
}
