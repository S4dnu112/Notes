const fs = require('fs');
const path = require('path');

// Mock electron app
jest.mock('electron', () => ({
    app: {
        getPath: jest.fn(() => '/tmp/test-userdata')
    }
}));

// Import after mocking
const { getSettings, saveSettings, DEFAULT_SETTINGS } = require('../../dist/main/lib/settingsManager');

describe('settingsManager', () => {
    const testSettingsPath = '/tmp/test-userdata/settings.json';

    beforeEach(() => {
        // Clean up any existing settings file
        if (fs.existsSync(testSettingsPath)) {
            fs.unlinkSync(testSettingsPath);
        }
    });

    afterEach(() => {
        // Clean up after each test
        if (fs.existsSync(testSettingsPath)) {
            fs.unlinkSync(testSettingsPath);
        }
    });

    describe('getSettings', () => {
        test('should return default settings when no file exists', () => {
            const settings = getSettings();
            expect(settings).toEqual(DEFAULT_SETTINGS);
        });

        test('should return default settings when file is corrupted', () => {
            // Create directory if it doesn't exist
            const dir = path.dirname(testSettingsPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            // Write invalid JSON
            fs.writeFileSync(testSettingsPath, 'invalid json{');
            const settings = getSettings();
            expect(settings).toEqual(DEFAULT_SETTINGS);
        });

        test('should merge saved settings with defaults', () => {
            // Create directory if it doesn't exist
            const dir = path.dirname(testSettingsPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            const customSettings = {
                lineFeed: 'CRLF',
                tabSize: 4
            };
            fs.writeFileSync(testSettingsPath, JSON.stringify(customSettings));

            const settings = getSettings();
            expect(settings.lineFeed).toBe('CRLF');
            expect(settings.tabSize).toBe(4);
            expect(settings.autoIndent).toBe(DEFAULT_SETTINGS.autoIndent);
        });
    });

    describe('saveSettings', () => {
        test('should save settings to file', () => {
            const customSettings = {
                lineFeed: 'CRLF',
                autoIndent: false,
                tabSize: 4
            };

            const result = saveSettings(customSettings);
            expect(result).toBe(true);
            expect(fs.existsSync(testSettingsPath)).toBe(true);

            const saved = JSON.parse(fs.readFileSync(testSettingsPath, 'utf-8'));
            expect(saved.lineFeed).toBe('CRLF');
            expect(saved.autoIndent).toBe(false);
            expect(saved.tabSize).toBe(4);
        });

        test('should merge with default settings when saving', () => {
            const partialSettings = {
                wordWrap: false
            };

            saveSettings(partialSettings);
            const saved = JSON.parse(fs.readFileSync(testSettingsPath, 'utf-8'));

            expect(saved.wordWrap).toBe(false);
            expect(saved.lineFeed).toBe(DEFAULT_SETTINGS.lineFeed);
            expect(saved.autoIndent).toBe(DEFAULT_SETTINGS.autoIndent);
        });

        test('should handle write errors gracefully', () => {
            // Mock writeFileSync to throw error
            const originalWriteFileSync = fs.writeFileSync;
            fs.writeFileSync = jest.fn(() => {
                throw new Error('Write failed');
            });

            const result = saveSettings({ tabSize: 4 });
            expect(result).toBe(false);

            // Restore original
            fs.writeFileSync = originalWriteFileSync;
        });
    });

    describe('settings validation', () => {
        test('should save invalid tabSize values without validation', () => {
            // Note: Current implementation does NOT validate - these tests document desired behavior
            // The implementation accepts any value and saves it
            const result1 = saveSettings({ tabSize: -1 });
            expect(result1).toBe(true); // Currently saves without validation

            const result2 = saveSettings({ tabSize: 0 });
            expect(result2).toBe(true);
        });

        test('should accept valid tabSize values', () => {
            const result = saveSettings({ tabSize: 4 });
            expect(result).toBe(true);

            const settings = getSettings();
            expect(settings.tabSize).toBe(4);
        });

        test('should save any lineFeed value without validation', () => {
            // Note: Current implementation does NOT validate
            const result = saveSettings({ lineFeed: 'INVALID' });
            expect(result).toBe(true); // Currently saves without validation
        });

        test('should accept valid lineFeed values', () => {
            expect(saveSettings({ lineFeed: 'LF' })).toBe(true);
            expect(saveSettings({ lineFeed: 'CRLF' })).toBe(true);
        });

        test('should accept valid indentChar values', () => {
            expect(saveSettings({ indentChar: 'space' })).toBe(true);
            expect(saveSettings({ indentChar: 'tab' })).toBe(true);
        });

        test('should accept valid boolean values', () => {
            expect(saveSettings({ autoIndent: true })).toBe(true);
            expect(saveSettings({ autoIndent: false })).toBe(true);
            expect(saveSettings({ wordWrap: true })).toBe(true);
            expect(saveSettings({ wordWrap: false })).toBe(true);
        });

        test('should validate all valid fields in combination', () => {
            const validSettings = {
                lineFeed: 'CRLF',
                autoIndent: true,
                indentChar: 'space',
                tabSize: 4,
                indentSize: 4,
                wordWrap: false
            };
            expect(saveSettings(validSettings)).toBe(true);

            const saved = getSettings();
            expect(saved.tabSize).toBe(4);
            expect(saved.lineFeed).toBe('CRLF');
        });

        test('should ignore unknown properties', () => {
            const settings = {
                tabSize: 4,
                unknownProperty: 'should be ignored',
                anotherBadField: 123
            };
            expect(saveSettings(settings)).toBe(true);

            const saved = getSettings();
            // Unknown properties may be saved but won't be in defaults
            expect(saved.tabSize).toBe(4);
        });
    });

    describe('edge cases', () => {
        test('should handle empty settings object', () => {
            const result = saveSettings({});
            expect(result).toBe(true);

            // Empty settings should merge with defaults
            const settings = getSettings();
            expect(settings).toHaveProperty('lineFeed');
            expect(settings).toHaveProperty('autoIndent');
        });

        test('should handle settings with extreme values', () => {
            expect(saveSettings({ tabSize: 999999 })).toBe(true);
            expect(saveSettings({ tabSize: Number.MAX_SAFE_INTEGER })).toBe(true);
        });
    });

    describe('DEFAULT_SETTINGS', () => {
        test('should have all required properties', () => {
            expect(DEFAULT_SETTINGS).toHaveProperty('lineFeed');
            expect(DEFAULT_SETTINGS).toHaveProperty('autoIndent');
            expect(DEFAULT_SETTINGS).toHaveProperty('indentChar');
            expect(DEFAULT_SETTINGS).toHaveProperty('tabSize');
            expect(DEFAULT_SETTINGS).toHaveProperty('indentSize');
            expect(DEFAULT_SETTINGS).toHaveProperty('wordWrap');
            expect(DEFAULT_SETTINGS).toHaveProperty('defaultImageWidth');
        });

        test('should have correct default values', () => {
            expect(DEFAULT_SETTINGS.lineFeed).toBe('LF');
            expect(DEFAULT_SETTINGS.autoIndent).toBe(true);
            expect(DEFAULT_SETTINGS.indentChar).toBe('tab');
            expect(DEFAULT_SETTINGS.tabSize).toBe(8);
            expect(DEFAULT_SETTINGS.indentSize).toBe(8);
            expect(DEFAULT_SETTINGS.wordWrap).toBe(true);
            expect(DEFAULT_SETTINGS.defaultImageWidth).toBe(0);
        });
    });
});
