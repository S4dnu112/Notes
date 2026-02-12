export interface ContentItem {
    type: 'text' | 'img';
    val?: string;
    src?: string;
    width?: number;
}
export type Content = ContentItem[];
export interface TempImageEntry {
    file: string;
    position: number;
}
export interface ImageMap {
    [key: string]: string;
}
export interface TabState {
    id: string;
    filePath: string | null;
    title: string;
    fullTitle?: string;
    modified: boolean;
    content: Content;
    savedContent: Content;
    imageMap: ImageMap;
    tempImages: ImageMap;
    imagesLoaded?: boolean;
    tempImageData?: Record<string, string>;
}
export interface SessionData {
    tabs: TabState[];
    tabOrder: string[];
    activeTabId: string | null;
}
export interface AppState {
    tabs: Map<string, TabState>;
    tabOrder: string[];
    activeTabId: string | null;
}
export interface Settings {
    windowBounds?: {
        width: number;
        height: number;
        x?: number;
        y?: number;
    };
    isMaximized?: boolean;
}
export type LineFeed = 'LF' | 'CRLF' | 'CR';
export type IndentChar = 'tab' | 'space';
export interface EditorSettings {
    lineFeed: LineFeed;
    autoIndent: boolean;
    indentChar: IndentChar;
    tabSize: number;
    indentSize: number;
    wordWrap: boolean;
    windowBounds?: {
        width: number;
        height: number;
        x?: number;
        y?: number;
    };
}
export interface SaveFileOptions {
    tabId: string;
    filePath: string;
    content: Content;
    imageMap: ImageMap;
    tempImages: ImageMap;
}
export interface LoadFileResult {
    success: boolean;
    content?: Content;
    imageMap?: ImageMap;
    error?: string;
}
export interface SaveFileResult {
    success: boolean;
    filePath?: string;
    error?: string;
}
export interface IpcResult<T = any> {
    success: boolean;
    data?: T;
    error?: string;
}
export interface ZipContent {
    content: Content;
    assetList: string[];
}
export interface ExtractImagesResult {
    [originalName: string]: string;
}
//# sourceMappingURL=index.d.ts.map