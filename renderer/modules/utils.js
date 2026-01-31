import { state } from './state.js';

export function generateTabId() {
    return `tab-${Date.now()}-${++state.tabCounter}`;
}

export function getFilename(filePath) {
    if (!filePath) return 'Untitled';
    return filePath.split(/[/\\]/).pop();
}

export function truncateTabTitle(title) {
    const MAX_LENGTH = 15;
    
    if (title.length <= MAX_LENGTH) return title;
    
    // Check if it has .txti extension
    if (title.endsWith('.txti')) {
        // Format: "basename-.txti" (total 15 chars)
        // .txti = 5 chars, "-" = 1 char, so basename can be 8 chars (8+1+5=14, need one more)
        // Actually: 8 + 1 + 5 = 14, so we can do 9 chars? Let's verify: "123456789-.txti" = 15 chars
        // 9 chars + - + .txti = 9 + 1 + 5 = 15. But we're getting 16?
        // Oh wait, the hyphen should come AFTER position 8, so we want chars 0-7 (8 chars)
        const maxBasenameLength = MAX_LENGTH - 1 - 5; // 15 - 1 (hyphen) - 5 (.txti) = 9
        const basename = title.slice(0, -5); // Remove .txti
        const truncatedBasename = basename.slice(0, maxBasenameLength);
        return `${truncatedBasename}-.txti`;
    } else {
        // No extension, just truncate to 15 chars
        return title.slice(0, MAX_LENGTH);
    }
}

export function formatDirectoryPath(filePath) {
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

export function debounce(func, wait) {
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
