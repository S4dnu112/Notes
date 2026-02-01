import { TabState, EditorSettings } from '../../types';

interface AppStateExtended {
    tabs: Map<string, TabState>;
    tabOrder: string[];
    tabHistory: string[];
    activeTabId: string | null;
    tabCounter: number;
    menuOpen: boolean;
    draggedTabId: string | null;
    settings: EditorSettings;
    zoomLevel: number;
}

export const state: AppStateExtended = {
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
