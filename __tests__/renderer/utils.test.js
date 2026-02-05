/**
 * @jest-environment jsdom
 */

// Mock state module before importing utils
jest.mock('../../dist/renderer/modules/state', () => ({
    state: {
        tabs: new Map(),
        tabOrder: [],
        tabHistory: [],
        activeTabId: null,
        tabCounter: 0,
        menuOpen: false,
        draggedTabId: null,
        settings: {
            lineFeed: 'LF',
            autoIndent: true,
            indentChar: 'tab',
            tabSize: 8,
            indentSize: 8,
            wordWrap: true
        },
        zoomLevel: 100
    }
}));

const {
    generateTabId,
    getFilename,
    formatDirectoryPath,
    debounce,
    truncateTabTitle,
    truncateHeaderTitle,
    getDisplayTitle,
    getDisplayTitleFromContent,
    formatHeaderText
} = require('../../dist/renderer/modules/utils');

const { state } = require('../../dist/renderer/modules/state');

describe('utils - unit tests', () => {
    beforeEach(() => {
        // Reset state counter for each test
        state.tabCounter = 0;
    });

    describe('generateTabId', () => {
        test('should generate unique tab IDs', () => {
            const id1 = generateTabId();
            const id2 = generateTabId();

            expect(id1).toMatch(/^tab-\d+-\d+$/);
            expect(id2).toMatch(/^tab-\d+-\d+$/);
            expect(id1).not.toBe(id2);
        });

        test('should increment tab counter', () => {
            expect(state.tabCounter).toBe(0);
            generateTabId();
            expect(state.tabCounter).toBe(1);
            generateTabId();
            expect(state.tabCounter).toBe(2);
        });

        test('should include timestamp in ID', () => {
            const beforeTime = Date.now();
            const id = generateTabId();
            const afterTime = Date.now();

            const timestamp = parseInt(id.split('-')[1]);
            expect(timestamp).toBeGreaterThanOrEqual(beforeTime);
            expect(timestamp).toBeLessThanOrEqual(afterTime);
        });
    });

    describe('getFilename', () => {

        test('should extract filename from Unix path', () => {
            expect(getFilename('/home/user/documents/file.txti')).toBe('file.txti');
        });

        test('should extract filename from Windows path', () => {
            expect(getFilename('C:\\Users\\user\\documents\\file.txti')).toBe('file.txti');
        });

        test('should handle mixed slashes', () => {
            expect(getFilename('C:/Users/user\\documents/file.txti')).toBe('file.txti');
        });

        test('should return filename without path', () => {
            expect(getFilename('file.txti')).toBe('file.txti');
        });

        test('should return "Untitled" for null path', () => {
            expect(getFilename(null)).toBe('Untitled');
        });

        test('should return "Untitled" for undefined path', () => {
            expect(getFilename(undefined)).toBe('Untitled');
        });

        test('should return "Untitled" for empty string', () => {
            expect(getFilename('')).toBe('Untitled');
        });

        test('should handle paths with no extension', () => {
            expect(getFilename('/path/to/document')).toBe('document');
        });
    });

    describe('formatDirectoryPath', () => {
        test('should return "Draft" for null path', () => {
            expect(formatDirectoryPath(null)).toBe('Draft');
        });

        test('should return "Draft" for undefined path', () => {
            expect(formatDirectoryPath(undefined)).toBe('Draft');
        });

        test('should return empty string for file in root', () => {
            // When path is "/file.txti", after split we get ["", "file.txti"]
            // After pop we get [""]
            // Last 2 segments of [""] is [""]
            // Join gives "", plus "/" gives "/"
            expect(formatDirectoryPath('/file.txti')).toBe('/');
        });

        test('should extract last directory segment', () => {
            // Path "/home/user/file.txti" split gives ["", "home", "user"]
            // Last 2 segments gives ["home", "user"]
            expect(formatDirectoryPath('/home/user/file.txti')).toBe('home/user/');
        });

        test('should extract last two directory segments', () => {
            expect(formatDirectoryPath('/home/user/documents/file.txti')).toBe('user/documents/');
        });

        test('should handle deeply nested paths', () => {
            expect(formatDirectoryPath('/a/b/c/d/e/f/file.txti')).toBe('e/f/');
        });

        test('should normalize Windows backslashes to forward slashes', () => {
            expect(formatDirectoryPath('C:\\Users\\user\\file.txti')).toBe('Users/user/');
        });

        test('should handle mixed slashes', () => {
            expect(formatDirectoryPath('C:/Users\\Documents/file.txti')).toBe('Users/Documents/');
        });

        test('should handle trailing slash', () => {
            expect(formatDirectoryPath('/home/user/file.txti')).toBe('home/user/');
        });

        test('should handle single directory', () => {
            // "/documents/file.txti" split gives ["", "documents"]
            // Last 2 segments gives ["", "documents"]
            expect(formatDirectoryPath('/documents/file.txti')).toBe('/documents/');
        });
    });

    describe('debounce', () => {
        jest.useFakeTimers();

        test('should delay function execution', () => {
            const func = jest.fn();
            const debouncedFunc = debounce(func, 100);

            debouncedFunc();
            expect(func).not.toHaveBeenCalled();

            jest.advanceTimersByTime(100);
            expect(func).toHaveBeenCalledTimes(1);
        });

        test('should cancel previous calls', () => {
            const func = jest.fn();
            const debouncedFunc = debounce(func, 100);

            debouncedFunc();
            debouncedFunc();
            debouncedFunc();

            jest.advanceTimersByTime(100);
            expect(func).toHaveBeenCalledTimes(1);
        });

        test('should pass arguments to function', () => {
            const func = jest.fn();
            const debouncedFunc = debounce(func, 100);

            debouncedFunc('arg1', 'arg2', 123);
            jest.advanceTimersByTime(100);

            expect(func).toHaveBeenCalledWith('arg1', 'arg2', 123);
        });

        test('should maintain this context', () => {
            const obj = {
                value: 42,
                func: jest.fn(function() { return this.value; })
            };
            obj.debouncedFunc = debounce(obj.func.bind(obj), 100);

            obj.debouncedFunc();
            jest.advanceTimersByTime(100);

            expect(obj.func).toHaveBeenCalled();
        });

        test('should reset timer on multiple calls', () => {
            const func = jest.fn();
            const debouncedFunc = debounce(func, 100);

            debouncedFunc();
            jest.advanceTimersByTime(50);
            debouncedFunc();
            jest.advanceTimersByTime(50);

            expect(func).not.toHaveBeenCalled();

            jest.advanceTimersByTime(50);
            expect(func).toHaveBeenCalledTimes(1);
        });

        afterEach(() => {
            jest.clearAllTimers();
        });

        afterAll(() => {
            jest.useRealTimers();
        });
    });

    describe('truncateTabTitle', () => {
        test('should not truncate titles under 15 characters', () => {
            expect(truncateTabTitle('short.txti')).toBe('short.txti');
            expect(truncateTabTitle('Untitled')).toBe('Untitled');
            expect(truncateTabTitle('test')).toBe('test');
        });

        test('should not truncate 15-character titles', () => {
            expect(truncateTabTitle('12345678.txti')).toBe('12345678.txti'); // exactly 14
            expect(truncateTabTitle('123456789.txti')).toBe('123456789.txti'); // exactly 15
        });

        test('should truncate .txti files longer than 15 chars', () => {
            expect(truncateTabTitle('verylongfilename.txti')).toBe('verylongf-.txti');
            expect(truncateTabTitle('jflkasdjflk fjksdljflsj fjsdklfjflksdj.txti')).toBe('jflkasdjf-.txti');
            expect(truncateTabTitle('12345678901.txti')).toBe('123456789-.txti'); // 16 chars -> truncate
        });

        test('should truncate titles without extension', () => {
            expect(truncateTabTitle('verylongtitlehere')).toBe('verylongtitlehe');
            expect(truncateTabTitle('this is a very long title')).toBe('this is a very ');
            expect(truncateTabTitle('1234567890123456')).toBe('123456789012345');
        });

        test('should handle edge cases', () => {
            expect(truncateTabTitle('')).toBe('');
            expect(truncateTabTitle('.txti')).toBe('.txti');
            expect(truncateTabTitle('a.txti')).toBe('a.txti');
        });

        test('should preserve exact format for .txti files', () => {
            const result = truncateTabTitle('superlongfilename.txti');
            expect(result).toBe('superlong-.txti');
            expect(result.length).toBe(15);
            expect(result.endsWith('.txti')).toBe(true);
            expect(result.includes('-')).toBe(true);
        });
    });

    describe('getDisplayTitle', () => {
        test('should return first line of text', () => {
            expect(getDisplayTitle('First line\nSecond line')).toBe('First line');
        });

        test('should return "Untitled" for empty string', () => {
            expect(getDisplayTitle('')).toBe('Untitled');
            expect(getDisplayTitle('   ')).toBe('Untitled');
        });

        test('should trim whitespace', () => {
            expect(getDisplayTitle('  Title  ')).toBe('Title');
        });

        test('should truncate at 255 characters', () => {
            const longTitle = 'a'.repeat(300);
            const result = getDisplayTitle(longTitle);
            expect(result.length).toBe(255);
        });

        test('should handle text with only newlines', () => {
            expect(getDisplayTitle('\n\n\n')).toBe('Untitled');
        });
    });

    describe('getDisplayTitleFromContent', () => {
        test('should extract title from first text content', () => {
            const content = [
                { type: 'text', val: 'Document Title' },
                { type: 'text', val: 'Body text' }
            ];
            expect(getDisplayTitleFromContent(content)).toBe('Document Title');
        });

        test('should return "Untitled" for empty content', () => {
            expect(getDisplayTitleFromContent([])).toBe('Untitled');
        });

        test('should skip empty text items', () => {
            const content = [
                { type: 'text', val: '   ' },
                { type: 'text', val: 'Real Title' }
            ];
            expect(getDisplayTitleFromContent(content)).toBe('Real Title');
        });

        test('should handle content with only images', () => {
            const content = [
                { type: 'img', src: 'image.png' }
            ];
            expect(getDisplayTitleFromContent(content)).toBe('Untitled');
        });
    });

    describe('formatHeaderText', () => {
        test('should format draft documents', () => {
            const result = formatHeaderText(null, 'Untitled', false);
            expect(result).toBe('Draft - Untitled');
        });

        test('should include modified indicator', () => {
            const result = formatHeaderText(null, 'Untitled', true);
            expect(result).toBe('Draft - Untitled ●');
        });

        test('should format file path with directory', () => {
            const result = formatHeaderText('/home/user/docs/file.txti', 'file.txti', false);
            expect(result).toContain('user/docs/');
            expect(result).toContain('file.txti');
        });

        test('should truncate long header titles', () => {
            const longTitle = 'verylongfilenamethatexceedsmaximumlength.txti';
            const result = formatHeaderText(`/path/to/${longTitle}`, longTitle, false);
            expect(result.length).toBeLessThan(100);
        });
    });
});
