/**
 * @jest-environment jsdom
 */

describe('utils - unit tests', () => {
    let state;

    beforeEach(() => {
        // Reset state for each test
        state = {
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
        };
    });

    describe('generateTabId', () => {
        function generateTabId() {
            return `tab-${Date.now()}-${++state.tabCounter}`;
        }

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
        function getFilename(filePath) {
            if (!filePath) return 'Untitled';
            return filePath.split(/[/\\]/).pop();
        }

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
        function formatDirectoryPath(filePath) {
            if (!filePath) return 'Draft';
            
            // Normalize slashes
            const normalized = filePath.replace(/\\/g, '/');
            const parts = normalized.split('/');
            
            // Remove the filename to get directory parts
            parts.pop();
            
            if (parts.length === 0) return '';
            
            // Extract last 2 segments of the directory path
            const start = Math.max(0, parts.length - 2);
            const relevantParts = parts.slice(start);
            
            return relevantParts.join('/') + '/';
        }

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

        function debounce(func, wait) {
            let timeout;
            return function executedFunction(...args) {
                const later = () => {
                    clearTimeout(timeout);
                    func(...args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        }

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
        function truncateTabTitle(title) {
            const MAX_LENGTH = 15;
            
            if (title.length <= MAX_LENGTH) return title;
            
            // Check if it has .txti extension
            if (title.endsWith('.txti')) {
                // Format: "basename-.txti" (total 15 chars)
                // .txti = 5 chars, "-" = 1 char, so basename can be 9 chars
                const maxBasenameLength = 9;
                const basename = title.slice(0, -5); // Remove .txti
                const truncatedBasename = basename.slice(0, maxBasenameLength);
                return `${truncatedBasename}-.txti`;
            } else {
                // No extension, just truncate to 15 chars
                return title.slice(0, MAX_LENGTH);
            }
        }

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
});
