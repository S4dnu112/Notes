const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const SETTINGS_FILE = path.join(app.getPath('userData'), 'settings.json');

const DEFAULT_SETTINGS = {
    lineFeed: 'LF',          // 'LF' | 'CRLF' | 'CR'
    autoIndent: true,
    indentChar: 'tab',       // 'tab' | 'space'
    tabSize: 8,
    indentSize: 8,
    wordWrap: true           // Word wrap enabled by default
};

/**
 * Get current settings, merged with defaults
 * @returns {Object} Settings object
 */
function getSettings() {
    try {
        if (fs.existsSync(SETTINGS_FILE)) {
            const data = fs.readFileSync(SETTINGS_FILE, 'utf-8');
            const saved = JSON.parse(data);
            return { ...DEFAULT_SETTINGS, ...saved };
        }
    } catch (err) {
        console.error('Failed to read settings:', err);
    }
    return { ...DEFAULT_SETTINGS };
}

/**
 * Save settings to file
 * @param {Object} settings - Settings to save
 */
function saveSettings(settings) {
    try {
        const merged = { ...DEFAULT_SETTINGS, ...settings };
        fs.writeFileSync(SETTINGS_FILE, JSON.stringify(merged, null, 2));
        return true;
    } catch (err) {
        console.error('Failed to save settings:', err);
        return false;
    }
}

module.exports = { getSettings, saveSettings, DEFAULT_SETTINGS };
