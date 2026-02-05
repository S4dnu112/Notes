/**
 * Test utilities and helper functions
 */

/**
 * Create a mock tab object with default values
 */
export function createMockTab(overrides = {}) {
    return {
        id: 'test-tab-' + Date.now(),
        filePath: null,
        title: 'Untitled',
        modified: false,
        content: [],
        ...overrides
    };
}

/**
 * Create a mock session object with default values
 */
export function createMockSession(overrides = {}) {
    return {
        tabs: [],
        tabOrder: [],
        activeTabId: null,
        savedAt: new Date().toISOString(),
        ...overrides
    };
}

/**
 * Create a mock content array for testing
 */
export function createMockContent(numItems = 3) {
    return Array.from({ length: numItems }, (_, i) => ({
        type: 'text',
        val: `Content line ${i + 1}`
    }));
}

/**
 * Create a mock settings object with default values
 */
export function createMockSettings(overrides = {}) {
    return {
        lineFeed: 'LF',
        autoIndent: true,
        indentChar: 'tab',
        tabSize: 8,
        indentSize: 8,
        wordWrap: true,
        ...overrides
    };
}

/**
 * Create a temporary file path for testing
 */
export function createTempFilePath(filename = 'test.txti') {
    const os = require('os');
    const path = require('path');
    return path.join(os.tmpdir(), 'test-' + Date.now(), filename);
}

/**
 * Wait for a specified amount of time (for debounce tests, etc.)
 */
export function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create multiple mock tabs at once
 */
export function createMockTabs(count) {
    return Array.from({ length: count }, (_, i) => createMockTab({
        id: `tab-${i}`,
        title: `Document ${i + 1}`,
        filePath: i % 2 === 0 ? `/path/to/file${i}.txti` : null,
        modified: i % 3 === 0,
        content: createMockContent(2)
    }));
}

/**
 * Assert that an object has all required properties
 */
export function assertHasProperties(obj, properties) {
    properties.forEach(prop => {
        if (!(prop in obj)) {
            throw new Error(`Object is missing required property: ${prop}`);
        }
    });
}

/**
 * Clean up test directories and files
 */
export async function cleanupTestFiles(...paths) {
    const fs = require('fs').promises;
    const cleanupPromises = paths.map(async (p) => {
        try {
            const stat = await fs.stat(p);
            if (stat.isDirectory()) {
                await fs.rm(p, { recursive: true, force: true });
            } else {
                await fs.unlink(p);
            }
        } catch (err) {
            // Ignore errors (file might not exist)
        }
    });
    await Promise.all(cleanupPromises);
}

/**
 * Create a mock image buffer for testing
 */
export function createMockImageBuffer(content = 'fake-image-data') {
    return Buffer.from(content);
}

/**
 * Measure execution time of a function
 */
export async function measureTime(fn) {
    const start = Date.now();
    await fn();
    return Date.now() - start;
}

/**
 * Run a function multiple times and return average execution time
 */
export async function benchmark(fn, iterations = 10) {
    const times = [];
    for (let i = 0; i < iterations; i++) {
        times.push(await measureTime(fn));
    }
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const min = Math.min(...times);
    const max = Math.max(...times);
    return { avg, min, max, times };
}
