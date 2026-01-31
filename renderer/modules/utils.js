import { state } from './state.js';

export function generateTabId() {
    return `tab-${Date.now()}-${++state.tabCounter}`;
}

export function getFilename(filePath) {
    if (!filePath) return 'Untitled';
    return filePath.split(/[/\\]/).pop();
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
