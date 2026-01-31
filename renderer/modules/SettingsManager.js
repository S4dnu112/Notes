import { state } from './state.js';
import { setZoom } from './Editor.js';

// DOM Elements
const settingsOverlay = document.getElementById('settings-overlay');
const settingLineFeed = document.getElementById('setting-linefeed');
const settingWordWrap = document.getElementById('setting-wordwrap');
const settingAutoIndent = document.getElementById('setting-autoindent');
const settingIndentChar = document.getElementById('setting-indentchar');
const tabsizeValue = document.getElementById('tabsize-value');
const tabsizeDec = document.getElementById('tabsize-dec');
const tabsizeInc = document.getElementById('tabsize-inc');
const indentsizeValue = document.getElementById('indentsize-value');
const indentsizeDec = document.getElementById('indentsize-dec');
const indentsizeInc = document.getElementById('indentsize-inc');
const statusLineEnding = document.getElementById('status-lineending');
const editor = document.getElementById('editor');

export function initSettings() {
    // Settings controls
    const settingLineFeed = document.getElementById('setting-linefeed');
    settingLineFeed.addEventListener('change', async () => {
        state.settings.lineFeed = settingLineFeed.value;
        await saveCurrentSettings();
    });

    const settingWordWrap = document.getElementById('setting-wordwrap');
    settingWordWrap.addEventListener('change', async () => {
        state.settings.wordWrap = settingWordWrap.checked;
        await saveCurrentSettings();
    });

    const settingAutoIndent = document.getElementById('setting-autoindent');
    settingAutoIndent.addEventListener('change', async () => {
        state.settings.autoIndent = settingAutoIndent.checked;
        await saveCurrentSettings();
    });

    const settingIndentChar = document.getElementById('setting-indentchar');
    settingIndentChar.addEventListener('change', async () => {
        state.settings.indentChar = settingIndentChar.value;
        await saveCurrentSettings();
    });

    const tabsizeDec = document.getElementById('tabsize-dec');
    tabsizeDec.addEventListener('click', async () => {
        if (state.settings.tabSize > 1) {
            state.settings.tabSize--;
            document.getElementById('tabsize-value').textContent = state.settings.tabSize;
            await saveCurrentSettings();
        }
    });

    const tabsizeInc = document.getElementById('tabsize-inc');
    tabsizeInc.addEventListener('click', async () => {
        if (state.settings.tabSize < 16) {
            state.settings.tabSize++;
            document.getElementById('tabsize-value').textContent = state.settings.tabSize;
            await saveCurrentSettings();
        }
    });

    const indentsizeDec = document.getElementById('indentsize-dec');
    indentsizeDec.addEventListener('click', async () => {
        if (state.settings.indentSize > 1) {
            state.settings.indentSize--;
            document.getElementById('indentsize-value').textContent = state.settings.indentSize;
            await saveCurrentSettings();
        }
    });

    const indentsizeInc = document.getElementById('indentsize-inc');
    indentsizeInc.addEventListener('click', async () => {
        if (state.settings.indentSize < 16) {
            state.settings.indentSize++;
            document.getElementById('indentsize-value').textContent = state.settings.indentSize;
            await saveCurrentSettings();
        }
    });

    document.getElementById('settings-close').addEventListener('click', closeSettings);
    document.getElementById('settings-overlay').addEventListener('click', (e) => {
        if (e.target === document.getElementById('settings-overlay')) closeSettings();
    });
}

export async function loadSettings() {
    state.settings = await window.teximg.getSettings();
    applySettingsToUI();
    updateLineFeedDisplay();
    applyWordWrap();
}

function applySettingsToUI() {
    document.getElementById('setting-linefeed').value = state.settings.lineFeed;
    document.getElementById('setting-wordwrap').checked = state.settings.wordWrap;
    document.getElementById('setting-autoindent').checked = state.settings.autoIndent;
    document.getElementById('setting-indentchar').value = state.settings.indentChar;
    document.getElementById('tabsize-value').textContent = state.settings.tabSize;
    document.getElementById('indentsize-value').textContent = state.settings.indentSize;
}

export async function saveCurrentSettings() {
    await window.teximg.saveSettings(state.settings);
    updateLineFeedDisplay();
    applyWordWrap();
}

export function openSettings() {
    document.getElementById('settings-overlay').classList.remove('hidden');
}

export function closeSettings() {
    document.getElementById('settings-overlay').classList.add('hidden');
}

function updateLineFeedDisplay() {
    const statusLineEnding = document.getElementById('status-lineending');
    if (!statusLineEnding) return;
    const labels = {
        'LF': 'Unix (LF)',
        'CRLF': 'Windows (CRLF)',
        'CR': 'Mac (CR)'
    };
    statusLineEnding.textContent = labels[state.settings.lineFeed] || 'Unix (LF)';
}

function applyWordWrap() {
    if (state.settings.wordWrap) {
        editor.classList.remove('no-wrap');
    } else {
        editor.classList.add('no-wrap');
    }
}
