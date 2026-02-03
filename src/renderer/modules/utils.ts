import { state } from './state.js';
import { Content } from '../../types/index.js';

export function generateTabId(): string {
    return `tab-${Date.now()}-${++state.tabCounter}`;
}

export function getFilename(filePath: string | null): string {
    if (!filePath) return 'Untitled';
    return filePath.split(/[/\\]/).pop() || 'Untitled';
}

export function truncateTitle(title: string, maxLength: number): string {
    if (title.length <= maxLength) return title;

    if (title.endsWith('.txti')) {
        const extension = '.txti';
        const hyphen = '-';
        const maxBasenameLength = maxLength - hyphen.length - extension.length;
        const basename = title.slice(0, -extension.length);
        const truncatedBasename = basename.slice(0, Math.max(0, maxBasenameLength));
        return `${truncatedBasename}${hyphen}${extension}`;
    } else {
        return title.slice(0, maxLength);
    }
}

export function truncateTabTitle(title: string): string {
    return truncateTitle(title, 15);
}

export function truncateHeaderTitle(title: string): string {
    return truncateTitle(title, 30);
}

export function formatDirectoryPath(filePath: string | null): string {
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

export function formatHeaderText(filePath: string | null, title: string, modified: boolean = false): string {
    const indicator = modified ? ' ●' : '';
    if (!filePath) {
        return `Draft - ${truncateHeaderTitle(title)}${indicator}`;
    }
    return formatDirectoryPath(filePath) + truncateHeaderTitle(getFilename(filePath)) + indicator;
}

export function debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout | undefined;
    return function executedFunction(...args: Parameters<T>) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

export function getDisplayTitle(text: string): string {
    if (!text || !text.trim()) return 'Untitled';
    const firstLine = text.split('\n')[0].trim();
    if (!firstLine) return 'Untitled';
    return firstLine.length > 255 ? firstLine.substring(0, 255) : firstLine;
}

export function getDisplayTitleFromContent(content: Content): string {
    if (!content || content.length === 0) return 'Untitled';
    const firstTextItem = content.find(item => item.type === 'text' && item.val && item.val.trim());
    if (!firstTextItem || !firstTextItem.val) return 'Untitled';
    return getDisplayTitle(firstTextItem.val);
}
