import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { EditorSettings, LineFeed, IndentChar } from '../types';

const SETTINGS_FILE = path.join(app.getPath('userData'), 'settings.json');

export { EditorSettings, LineFeed, IndentChar };

export const DEFAULT_SETTINGS: Omit<EditorSettings, 'windowBounds'> = {
    lineFeed: 'LF',
    autoIndent: true,
    indentChar: 'tab',
    tabSize: 8,
    indentSize: 8,
    wordWrap: true
};

export function getSettings(): EditorSettings {
    try {
        if (fs.existsSync(SETTINGS_FILE)) {
            const data = fs.readFileSync(SETTINGS_FILE, 'utf-8');
            const saved: Partial<EditorSettings> = JSON.parse(data);
            return { ...DEFAULT_SETTINGS, ...saved };
        }
    } catch (err) {
        console.error('Failed to read settings:', err);
    }
    return { ...DEFAULT_SETTINGS };
}

export function saveSettings(settings: Partial<EditorSettings>): boolean {
    try {
        const current = getSettings();
        const merged: EditorSettings = { ...current, ...settings };
        fs.writeFileSync(SETTINGS_FILE, JSON.stringify(merged, null, 2));
        return true;
    } catch (err) {
        console.error('Failed to save settings:', err);
        return false;
    }
}
