# TextImg Editor - Architecture Documentation

## Overview

TextImg Editor is an Electron-based desktop application for editing `.txti` files - text documents with embedded images stored as ZIP archives. The application follows a clean separation of concerns with distinct main, preload, and renderer processes, fully implemented in TypeScript.

## Technology Stack

- **Runtime**: Electron 28.0
- **Language**: TypeScript 5.9
- **Build System**: TypeScript Compiler (tsc) + Babel
- **File Format**: Custom `.txti` (ZIP with `content.json` + `assets/` folder)
- **Dependencies**:
  - `adm-zip`: ZIP file handling
  - `uuid`: Unique filename generation
  - `@exodus/bytes`: Byte manipulation
  - `jest`: Unit & integration testing
  - `playwright`: E2E testing

## Application Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Main Process (Node.js)                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ main.ts      │  │ IPC Handlers │  │ Window Mgmt  │      │
│  │              │  │              │  │              │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│  ┌──────────────────────────────────────────────────┐      │
│  │ Core Libraries (lib/)                            │      │
│  │  • zipHandler.ts     - ZIP read/write           │      │
│  │  • sessionManager.ts - Session persistence      │      │
│  │  • settingsManager.ts - User preferences        │      │
│  └──────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            │
                   ┌────────┴────────┐
                   │   preload.ts    │
                   │  Context Bridge │
                   └────────┬────────┘
                            │
┌─────────────────────────────────────────────────────────────┐
│                    Renderer Process (Browser)                │
│  ┌──────────────────────────────────────────────────┐      │
│  │ renderer/                                        │      │
│  │  ┌────────────────┐  ┌────────────────┐         │      │
│  │  │ renderer.ts    │  │ index.html     │         │      │
│  │  │ (Entry point)  │  │ (UI Structure) │         │      │
│  │  └────────────────┘  └────────────────┘         │      │
│  │                                                  │      │
│  │  modules/                                        │      │
│  │  ┌────────────────────────────────────────┐     │      │
│  │  │ • Editor.ts        - Content editing   │     │      │
│  │  │ • TabManager.ts    - Multi-tab logic   │     │      │
│  │  │ • UIManager.ts     - Window controls   │     │      │
│  │  │ • SettingsManager.ts - UI settings     │     │      │
│  │  │ • state.ts         - Application state │     │      │
│  │  │ • utils.ts         - Helper functions  │     │      │
│  │  └────────────────────────────────────────┘     │      │
│  └──────────────────────────────────────────────────┘      │
│  ┌──────────────────────────────────────────────────┐      │
│  │ types/                                           │      │
│  │  └── index.ts - Shared type definitions          │      │
│  └──────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

## Core Modules

### Main Process ([src/main/main.ts](src/main/main.ts))

**Responsibilities:**
- Window lifecycle management
- IPC handler registration
- Temporary directory management for images
- Native menu creation (Electron `Menu.popup()`)
- Session/settings persistence coordination
- Window bounds persistence

**Key Functions:**
- `createWindow()` - Creates new browser window with saved bounds
- `createTempDir(tabId)` - Per-tab temporary directories in `os.tmpdir()/txti-editor/{tabId}/`
- `cleanupTempDir(tabId)` - Cleanup on tab close
- Window management handlers

**Key Interfaces:**
```typescript
interface WindowBounds {
    width: number;
    height: number;
    x?: number;
    y?: number;
}

interface SaveFileParams {
    tabId: string;
    filePath: string;
    content: any[];
    imageMap: Record<string, string>;
    tempImages: Record<string, string>;
}

interface CloseRequestContext {
    isLastWindow: boolean;
}
```

**Temp Directory Management:**
- `tempDirs` Map tracks tab-specific directories
- Created on demand via `createTempDir()`
- Cleaned up on tab close via `cleanupTempDir()`
- Global set `allWindows` tracks open windows for close coordination

### Preload ([src/main/preload.ts](src/main/preload.ts))

**Responsibilities:**
- Secure IPC channel exposure via Context Bridge
- Type-safe API between renderer and main

**Exposed API (`window.textimg`):**
```typescript
{
  // Window controls
  minimize, maximize, forceClose, newWindow, 
  openKeyboardShortcuts, openPreferences, showMenu,
  getWindowCount, isMaximized,
  
  // File operations
  newFile, openDialog, openFile, saveDialog, saveAsDialog,
  saveFile, loadImages,
  
  // Session management
  getSession, saveSession, getFullSession, saveFullSession,
  saveTabContent,
  
  // Settings
  getSettings, saveSettings,
  
  // Dialogs
  showUnsavedChangesDialog,
  
  // Tab management
  closeTab, getTempDir, readTempImages, restoreTempImages,
  
  // Clipboard & images
  readClipboardImage, saveClipboardBuffer, pasteImage,
  
  // Event listeners
  onMaximizedChange, onMenuAction, onCloseRequest
}
```

### Renderer Modules

#### [renderer.ts](src/renderer/renderer.ts)
- Application entry point
- Module initialization orchestration
- Session restoration on startup
- Drag and drop file support (`.txti` files on window)
- First window vs new window detection via URL params
- IPC event listener setup

**Initialization Flow:**
```typescript
1. Load settings via SettingsManager
2. Initialize UI (buttons, keyboard shortcuts)
3. Check if first window (URL param)
4. If first window: restore session
5. Setup drag-and-drop handlers
6. Setup window event listeners
```

#### [modules/state.ts](src/renderer/modules/state.ts)
- Centralized application state
- Tab data structure
- Settings cache

**State Structure:**
```typescript
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
```

**TabState Structure (from [types/index.ts](src/types/index.ts)):**
```typescript
interface TabState {
    id: string;
    filePath: string | null;
    title: string;
    fullTitle?: string;
    modified: boolean;
    content: Content;
    imageMap: ImageMap;        // Saved images
    tempImages: ImageMap;      // Unsaved pasted images
    imagesLoaded?: boolean;    // Lazy loading flag
    tempImageData?: Record<string, string>; // Base64 for session restore
}
```

#### [modules/Editor.ts](src/renderer/modules/Editor.ts)
- ContentEditable management
- Image insertion & resizing with drag handles
- Paste handling (text + images)
- Auto-indentation
- Content serialization to state
- Zoom control
- Undo/redo via `document.execCommand()`

**Key Features:**
- Direct DOM manipulation for performance
- Lazy image loading
- Clipboard image support (PNG/JPEG)
- Dynamic tab title updates based on content
- Image resize handles with drag interaction

**Key Functions:**
- [initEditor()](src/renderer/modules/Editor.ts) - Setup editor event handlers
- [renderContentToEditor(tabState)](src/renderer/modules/Editor.ts) - Render content to DOM
- [saveEditorToState(tabId)](src/renderer/modules/Editor.ts) - Serialize DOM to state
- [insertImage(filename, filePath)](src/renderer/modules/Editor.ts) - Add image to editor
- [handlePaste(e)](src/renderer/modules/Editor.ts) - Handle paste events (text + images)
- [markModified()](src/renderer/modules/Editor.ts) - Mark tab as modified
- [undo() / redo()](src/renderer/modules/Editor.ts) - Document history
- [setZoom(level)](src/renderer/modules/Editor.ts) - Editor zoom control (10-500%)

**Image Handling:**
- `handleImageClick()` - Select image for resizing
- `deselectImage()` - Remove selection and resize handle
- `startResize()` / `doResize()` / `stopResize()` - Drag-to-resize logic
- `handleImagePaste()` - Paste from clipboard DataTransfer
- `handleNativeImagePaste()` - Paste from Electron clipboard API

**Content Serialization:**
```typescript
// DOM → State
saveEditorToState() traverses editor.childNodes
  - DIV/P elements → text items
  - IMG elements → img items with filename + optional width
  - Stores in tabState.content array
```

#### [modules/TabManager.ts](src/renderer/modules/TabManager.ts)
- Tab lifecycle (create, close, switch)
- Drag-and-drop tab reordering
- File operations (open, save, save-as)
- Session persistence
- Welcome screen management
- Tab scrolling into view

**Tab Operations Flow:**
```
createTab → renderTab → switchToTab → renderContentToEditor
openFile → extractContent → createTab → loadImages (lazy)
saveFile → saveEditorToState → createZip → IPC save
```

**Key Functions:**
- [createTab(filePath, content)](src/renderer/modules/TabManager.ts) - Create new tab
- [closeTab(tabId)](src/renderer/modules/TabManager.ts) - Close with unsaved changes check
- [switchToTab(tabId)](src/renderer/modules/TabManager.ts) - Switch active tab with lazy image loading
- [openFile(filePath)](src/renderer/modules/TabManager.ts) - Open .txti file
- [saveFile()](src/renderer/modules/TabManager.ts) / [saveFileAs()](src/renderer/modules/TabManager.ts) - Save operations
- [restoreSession()](src/renderer/modules/TabManager.ts) - Restore from persisted session
- `debouncedSaveSession()` - Auto-save session state (500ms debounce)

**Tab State Management:**
- `renderTab()` - Create DOM element for tab
- [updateTabUI(tabId)](src/renderer/modules/TabManager.ts) - Update tab title/modified indicator
- `showWelcomeScreen()` / `hideWelcomeScreen()` - Toggle welcome screen based on tab count
- Drag-and-drop handlers for tab reordering

**Session Persistence:**
- Triggered on tab modification (debounced 500ms)
- Saves to `sessionManager` via IPC
- Includes tab content, image data, and window state

#### [modules/UIManager.ts](src/renderer/modules/UIManager.ts)
- Window controls (minimize, maximize, close)
- Keyboard shortcuts
- Native menu integration via IPC
- Status bar updates (line, column, zoom, characters)
- Close confirmation for unsaved tabs
- Header path display

**Keyboard Shortcuts:**
| Shortcut | Action |
|----------|--------|
| Ctrl+N | New Window |
| Ctrl+T | New Tab |
| Ctrl+O | Open File |
| Ctrl+S | Save |
| Ctrl+Shift+S | Save As |
| Ctrl+W | Close Tab |
| Ctrl+Z | Undo |
| Ctrl+Shift+Z / Ctrl+Y | Redo |
| Ctrl++/- | Zoom In/Out |
| Ctrl+0 | Reset Zoom |
| Ctrl+, | Settings |
| Escape | Close Settings/Menu |
| Ctrl+Tab / Ctrl+Shift+Tab | Switch Tabs |

**Key Functions:**
- [initUI(tabManagerFuncs)](src/renderer/modules/UIManager.ts) - Setup UI event handlers
- [updateStatusBar()](src/renderer/modules/UIManager.ts) - Update line/col/chars/zoom
- [updateHeaderPath(text)](src/renderer/modules/UIManager.ts) - Update header path display
- `setupKeyboardShortcuts()` - Register all keyboard shortcuts
- `closeMenu()` - Close any open overlays

**Close Request Handling:**
- Listens for `onCloseRequest` from main process
- Checks for unsaved tabs
- Shows confirmation dialog if needed
- Handles both last window (quit app) and multi-window scenarios

#### [modules/SettingsManager.ts](src/renderer/modules/SettingsManager.ts)
- Settings UI panel
- Real-time setting application
- Immediate save to main process via IPC

**Settings:**
- Line Feed (LF, CRLF, CR)
- Word Wrap (toggle)
- Auto Indent (toggle)
- Indent Character (tab/space)
- Tab Size (1-16, increment/decrement buttons)
- Indent Size (1-16, increment/decrement buttons)

**Key Functions:**
- [initSettings()](src/renderer/modules/SettingsManager.ts) - Setup settings panel event listeners
- [loadSettings()](src/renderer/modules/SettingsManager.ts) - Load from main process
- `applySettingsToUI()` - Apply settings to UI controls
- [saveCurrentSettings()](src/renderer/modules/SettingsManager.ts) - Persist to disk
- [openSettings()](src/renderer/modules/SettingsManager.ts) / [closeSettings()](src/renderer/modules/SettingsManager.ts) - Toggle settings panel
- `applyWordWrap()` - Toggle word wrap CSS class on editor

**Settings Panel:**
- Opened via Ctrl+, or hamburger menu
- Closed via Escape, close button, or overlay click
- Immediate save on any change

#### [modules/utils.ts](src/renderer/modules/utils.ts)
- [generateTabId()](src/renderer/modules/utils.ts) - Unique tab identifiers (`tab-{timestamp}-{counter}`)
- [getFilename()](src/renderer/modules/utils.ts) - Path parsing (cross-platform)
- [formatDirectoryPath()](src/renderer/modules/utils.ts) - Breadcrumb display (last 2 segments)
- [truncateTabTitle()](src/renderer/modules/utils.ts) - Tab title length management (max 15 chars, smart .txti truncation)
- [truncateHeaderTitle()](src/renderer/modules/utils.ts) - Header title truncation (max 30 chars)
- [formatHeaderText()](src/renderer/modules/utils.ts) - Format header with path and modified indicator
- [debounce()](src/renderer/modules/utils.ts) - Function throttling
- [getDisplayTitle()](src/renderer/modules/utils.ts) - Extract title from text content (first line)
- [getDisplayTitleFromContent()](src/renderer/modules/utils.ts) - Extract title from Content array

**Tab ID Generation:**
```typescript
generateTabId() => `tab-${Date.now()}-${++state.tabCounter}`
```

**Title Truncation:**
- Preserves `.txti` extension
- Uses hyphen before extension for truncated files
- Example: `very-long-filename.txti` → `very-long-fi-.txti`

### Core Libraries ([src/main/lib/](src/main/lib/))

#### [zipHandler.ts](src/main/lib/zipHandler.ts)
Handles `.txti` file format operations using `adm-zip`.

**Functions:**
- [readContentJson(filePath)](src/main/lib/zipHandler.ts) - Extract content.json only (lazy)
- [extractImages(filePath, destDir)](src/main/lib/zipHandler.ts) - Extract assets to temp directory
- [createZip(content, imageFiles, outputPath)](src/main/lib/zipHandler.ts) - Create .txti archive
- [createEmptyDocument()](src/main/lib/zipHandler.ts) - New document structure

**File Format:**
```
document.txti (ZIP)
├── content.json          # Document structure
└── assets/
    ├── image1.png
    └── image2.jpg
```

**content.json Schema:**
```json
{
  "content": [
    { "type": "text", "val": "Hello World" },
    { "type": "img", "src": "image1.png", "width": 500 }
  ],
  "assetList": ["image1.png", "image2.jpg"]
}
```

**Implementation Details:**
- Uses async/await with fs.promises
- Parallel image extraction with `Promise.all()`
- Graceful error handling for missing images
- Creates destination directories if needed

#### [sessionManager.ts](src/main/lib/sessionManager.ts)
Persists open tabs and window state across restarts.

**Functions:**
- `getSession()` - Legacy: file paths only
- [getFullSession()](src/main/lib/sessionManager.ts) - Complete session with content
- [saveFullSession(sessionData)](src/main/lib/sessionManager.ts) - Save all tab data
- [saveTabContent(tabData)](src/main/lib/sessionManager.ts) - Incremental tab updates

**Storage:** `~/.config/textimg-editor/session.json` (or platform equivalent via `app.getPath('userData')`)

**Session Structure:**
```typescript
{
  tabs: TabState[],
  tabOrder: string[],
  activeTabId: string | null
}
```

**Incremental Updates:**
- `saveTabContent()` updates individual tab without full rewrite
- Debounced saves prevent excessive I/O

#### [settingsManager.ts](src/main/lib/settingsManager.ts)
User preferences persistence.

**Functions:**
- [getSettings()](src/main/lib/settingsManager.ts) - Load with defaults fallback
- [saveSettings(settings)](src/main/lib/settingsManager.ts) - Write to disk (merged with existing)

**Default Settings:**
```typescript
{
    lineFeed: 'LF',
    autoIndent: true,
    indentChar: 'tab',
    tabSize: 8,
    indentSize: 8,
    wordWrap: true
}
```

**Storage:** `~/.config/textimg-editor/settings.json`

**Merge Strategy:**
- New settings merged with existing (preserves unmodified keys)
- Defaults applied for missing keys

### Type Definitions ([src/types/index.ts](src/types/index.ts))

Centralized TypeScript interfaces and types:

```typescript
// Content types
ContentItem { type: 'text' | 'img'; val?: string; src?: string; width?: number }
Content = ContentItem[]
ImageMap { [key: string]: string }
TempImageEntry { file: string; position: number }

// State types
TabState, SessionData, AppState

// Settings types
Settings, EditorSettings, LineFeed ('LF' | 'CRLF' | 'CR'), IndentChar ('tab' | 'space')

// IPC types
SaveFileOptions, LoadFileResult, SaveFileResult, IpcResult<T>

// Zip types
ZipContent { content: Content; assetList: string[] }
ExtractImagesResult { [originalName: string]: string }
```

**Key Interfaces:**
- `ContentItem` - Single content block (text or image)
- `TabState` - Complete tab state including content and images
- `EditorSettings` - User preferences
- `ZipContent` - .txti file content structure

## Data Flow

### Opening a File

```
User clicks "Open" (Ctrl+O)
  → UIManager triggers openFile()
  → TabManager.openFile()
  → IPC: file:open-dialog (showOpenDialog)
  → User selects file
  → Check if file already open in another tab
  → IPC: file:open (filePath, tabId)
  → Main: readContentJson() [lazy - no images yet]
  → Main: createTempDir(tabId)
  → TabManager creates TabState with content
  → renderTab() - create DOM tab element
  → switchToTab() - render content to editor
  → renderContentToEditor() [shows placeholders for images]
  
When user switches to tab (if not already loaded):
  → IPC: file:load-images (lazy loading)
  → Main: extractImages() to temp dir
  → TabManager updates imageMap
  → renderContentToEditor() [now shows actual images]
  → Set imagesLoaded = true
```

### Saving a File

```
User presses Ctrl+S
  → UIManager keyboard handler
  → TabManager.saveFile()
  → Save dialog if no filePath (Ctrl+Shift+S)
  → Editor.saveEditorToState() [DOM → content array]
  → Collect imageMap (saved) + tempImages (newly pasted)
  → IPC: file:save { tabId, filePath, content, imageMap, tempImages }
  → Main: zipHandler.createZip()
    - Serialize content to JSON
    - Copy images from imageMap sources
    - Copy images from tempImages (promote to permanent)
  → ZIP written to disk
  → TabManager updates tab state:
    - modified = false
    - Move tempImages → imageMap
    - Clear tempImages
  → Update tab UI (remove modified indicator)
  → updateHeaderPath (remove ●)
  → saveSessionState (debounced)
```

### Session Persistence

**On tab modification:**
```
Editor marks modified
  → debouncedSaveSession() (500ms delay)
  → saveEditorToState()
  → For each tab: collect tempImageData as base64
  → IPC: saveTabContent() OR saveFullSession()
  → sessionManager writes to disk
```

**On app start:**
```
renderer.ts initialization
  → Check isFirstWindow URL param
  → If first window: restoreSession()
  → IPC: getFullSession()
  → For each saved tab:
      - Create TabState
      - renderTab()
      - If has tempImageData: IPC restoreTempImages() (base64 → files)
      - Add to state.tabs
  → switchToTab(activeTabId)
  → renderContentToEditor()
```

**Session Data Structure:**
```typescript
{
  tabs: [{
    id, filePath, title, modified, content,
    imageMap, tempImages,
    tempImageData: { 'filename.png': 'base64...' }
  }],
  tabOrder: ['tab-1', 'tab-2'],
  activeTabId: 'tab-1'
}
```

### Clipboard Image Paste

```
User pastes (Ctrl+V or right-click paste)
  → Editor.handlePaste(e)
  → Two paths:
    A. ClipboardEvent with DataTransferItem
       → handleImagePaste(item)
    B. Electron clipboard.readImage()
       → handleNativeImagePaste(buffer)
  → Convert to PNG buffer
  → IPC: saveClipboardBuffer(tabId, buffer)
  → Main: Generate UUID filename
  → Write to temp dir: /tmp/txti-editor/{tabId}/{uuid}.png
  → Return { success, filename, filePath }
  → insertImage(filename, filePath)
  → Add to tabState.tempImages
  → markModified()
```

## Key Design Patterns

### 1. Lazy Loading
Images are only extracted from .txti when tab becomes active:
- Faster file opening (only content.json parsed initially)
- Reduces memory usage for background tabs
- Progressive rendering (text first, images when needed)
- `imagesLoaded` flag tracks loading state per tab

**Implementation:**
```typescript
switchToTab() {
  if (!tabState.imagesLoaded && tabState.filePath) {
    loadImages(tabState.filePath, tabId)
    tabState.imagesLoaded = true
  }
}
```

### 2. Temporary Directories
Each tab gets isolated temp directory for images:
- Path: `os.tmpdir()/txti-editor/{tabId}/`
- Created on tab open/create via `createTempDir()`
- Stores pasted images before save
- Cleaned on tab close via `cleanupTempDir()`
- Allows unsaved image paste operations
- Images promoted to permanent on save

**Lifecycle:**
```
createTab() → createTempDir()
Paste image → save to temp dir
closeTab() → cleanupTempDir()
```

### 3. Debounced Session Save
Session saves are debounced (500ms) to prevent excessive writes:
- User types → marks modified → triggers debounced save
- Multiple rapid edits = single save
- Ensures crash recovery without performance penalty
- Implemented via `debounce()` utility in [utils.ts](src/renderer/modules/utils.ts)

**Implementation:**
```typescript
const debouncedSaveSession = debounce(() => {
  saveEditorToState(activeTabId)
  saveSessionState()
}, 500)
```

### 4. State Synchronization
Clear separation between:
- **Editor DOM state** (what user sees in contenteditable)
- **TabState.content** (serialized data structure)
- **Disk storage** (.txti ZIP files)

Sync points:
- On tab switch: `saveEditorToState(oldTabId)`
- Before save: `saveEditorToState(activeTabId)`
- On app close: Save all tabs to session
- On modification: Debounced session save

**Content Structure:**
```typescript
// DOM: <p>Text</p><img data-filename="x.png" />
// State: [{ type: 'text', val: 'Text' }, { type: 'img', src: 'x.png' }]
// Disk: { content: [...], assetList: ['x.png'] } + assets/x.png
```

### 5. Event-Driven Architecture
- Main process: IPC handlers registered via `ipcMain.handle()`
- Renderer: Event listeners + callbacks via `addEventListener()`
- No tight coupling between modules
- Clear communication boundaries via preload bridge

**IPC Pattern:**
```typescript
// Renderer
const result = await window.textimg.saveFile(data)

// Preload
saveFile: (data) => ipcRenderer.invoke('file:save', data)

// Main
ipcMain.handle('file:save', async (event, data) => { ... })
```

### 6. Native Menu Integration
- Hamburger button triggers `Menu.popup()` via IPC
- Menu built in main process with platform-specific shortcuts
- Menu actions sent back to renderer via `menu:action` event
- Provides native OS look and feel
- Menu includes info section (line/col/zoom/chars)

**Menu Flow:**
```
Click hamburger → IPC: menu:show
Main: Menu.popup() at button position
User clicks menu item
Main: webContents.send('menu:action', action)
Renderer: onMenuAction(action) → execute action
```

## Performance Considerations

### Memory Management
- Temp directories cleaned on tab close via `cleanupTempDir()`
- Images loaded only when needed (lazy loading)
- DOM reused (no full re-renders on tab switch)
- Session save debounced to reduce I/O
- Content serialization only when necessary

### Render Performance
- Direct DOM manipulation (no virtual DOM overhead)
- ContentEditable for native text editing performance
- CSS-only animations and transitions
- Image resize via CSS transforms (GPU-accelerated)
- Minimal reflows during typing

### File I/O
- Async operations throughout (async/await + fs.promises)
- Streaming for ZIP operations (via adm-zip)
- Parallel image extraction with `Promise.all()`
- No blocking main thread
- Debounced session saves

### Startup Time
- Lazy image loading speeds up file open
- First window detection for session restore
- Incremental tab loading
- Settings cached in renderer state

## Security

### Content Security Policy
```html
<meta http-equiv="Content-Security-Policy"
      content="default-src 'self'; 
               img-src 'self' file: data:; 
               style-src 'self' 'unsafe-inline'; 
               script-src 'self'">
```

### Context Isolation
- `contextIsolation: true` in BrowserWindow webPreferences
- `nodeIntegration: false`
- All Node.js APIs accessed via preload bridge
- No direct access to Electron APIs from renderer

### File Access
- User must explicitly open/save files via dialogs
- Temp directories in OS-managed location (`os.tmpdir()`)
- No arbitrary file system access from renderer
- File paths validated in main process
- ZIP extraction sanitized (no path traversal)

### IPC Security
- All handlers use `ipcMain.handle()` (requires invoke)
- No `ipcMain.on()` for critical operations
- Type-safe parameters via TypeScript
- Validation in main process

## Testing Strategy

### Unit Tests ([__tests__/lib/](__tests__/lib/), [__tests__/renderer/](__tests__/renderer/))
- Individual function testing
- Mock electron APIs
- Fast execution (~2s)

**Coverage:**
- [zipHandler.ts](src/main/lib/zipHandler.ts) - ZIP operations (create, read, extract)
- [sessionManager.ts](src/main/lib/sessionManager.ts) - Session persistence
- [settingsManager.ts](src/main/lib/settingsManager.ts) - Settings I/O
- [utils.ts](src/renderer/modules/utils.ts) - Helper functions (truncation, path formatting)

**Example: [__tests__/lib/zipHandler.test.js](__tests__/lib/zipHandler.test.js)**
- Test ZIP creation with images
- Test content.json parsing
- Test image extraction
- Test error handling

### Integration Tests ([__tests__/integration/](__tests__/integration/))
- Multi-module workflows
- IPC handler verification
- File lifecycle testing
- Real file system operations

**Scenarios:**
- Complete file save/open cycle
- Session restoration with multiple tabs
- Multi-tab management
- Settings persistence
- Tab state management with images

**Example: [__tests__/integration/main-process-file-ops.test.js](__tests__/integration/main-process-file-ops.test.js)**
- Test file:open handler
- Test file:save handler
- Test image loading pipeline

### Component Tests ([__tests__/component/](__tests__/component/))
- DOM manipulation testing
- UI interaction validation
- JSDOM environment

**Tests:**
- [Editor.test.js](__tests__/component/Editor.test.js) - Content rendering, image insertion
- [TabManager.test.js](__tests__/component/TabManager.test.js) - Tab lifecycle, switching

**Note:** Currently skipped due to ESM dependency issue with `@exodus/bytes`

### E2E Tests ([__tests__/e2e/](__tests__/e2e/))
- Full application flows via Playwright
- Real Electron window testing
- User interaction simulation

**Tests:**
- [file-operations.spec.js](__tests__/e2e/file-operations.spec.js) - Create, edit, save, reopen
- [image-operations.spec.js](__tests__/e2e/image-operations.spec.js) - Paste image, save with images

**Setup:**
- Unique user data dir per test
- Temp directories for test files
- Cleanup after each test
- Mock dialogs via `electronApp.evaluate()`

### Test Commands
```bash
npm test              # Unit + integration
npm run test:unit     # Unit tests only
npm run test:integration  # Integration tests
npm run test:component    # Component tests (currently skipped)
npm run test:e2e      # Playwright E2E
npm run test:all      # All tests including E2E
npm run test:coverage # Coverage report
npm run test:watch    # Watch mode
```

**Test Configuration:**
- Jest for unit/integration/component
- Playwright for E2E
- Coverage target: >80%
- Mocks for Electron APIs ([__mocks__/@exodus/bytes.js](__mocks__/@exodus/bytes.js))
- Test utilities in [__tests__/helpers/testUtils.js](__tests__/helpers/testUtils.js)

## Build & Development

### Project Structure
```
textimg-editor/
├── src/                        # Source files (TypeScript)
│   ├── main/                   # Main process
│   │   ├── main.ts            # Entry point
│   │   ├── preload.ts         # Context bridge
│   │   └── lib/               # Core libraries
│   │       ├── zipHandler.ts
│   │       ├── sessionManager.ts
│   │       └── settingsManager.ts
│   ├── renderer/               # Browser process
│   │   ├── index.html         # Main UI structure
│   │   ├── preferences.html   # Preferences window
│   │   ├── keyboard-shortcuts.html # Shortcuts reference
│   │   ├── styles.css         # Global styles
│   │   ├── renderer.ts        # Entry point
│   │   ├── global.d.ts        # Window.textimg types
│   │   └── modules/
│   │       ├── Editor.ts
│   │       ├── TabManager.ts
│   │       ├── UIManager.ts
│   │       ├── SettingsManager.ts
│   │       ├── state.ts
│   │       └── utils.ts
│   └── types/                  # Shared type definitions
│       └── index.ts
├── dist/                       # Compiled output
│   ├── main/
│   └── renderer/
├── __tests__/                  # Test suites
│   ├── lib/                   # Library unit tests
│   ├── renderer/              # Renderer unit tests
│   ├── integration/           # Integration tests
│   ├── component/             # Component tests
│   ├── e2e/                   # End-to-end tests
│   └── helpers/               # Test utilities
├── __mocks__/                  # Jest mocks
│   └── @exodus/bytes.js
├── package.json               # Dependencies & scripts
├── tsconfig.json              # Main process TS config
├── tsconfig.renderer.json     # Renderer process TS config
├── babel.config.js            # Babel configuration
├── jest.config.js             # Test configuration
├── jest.setup.js              # Test setup
├── playwright.config.js       # E2E test config
└── ARCHITECTURE.md            # This file
```

### Development Workflow
```bash
npm run build       # Compile TypeScript (both main & renderer)
npm run build:main  # Compile main process only
npm run build:renderer  # Compile renderer only
npm run start       # Build + start Electron
npm run run         # Start without building (uses compiled)
npm test            # Run tests
```

### TypeScript Configuration

**Main Process ([tsconfig.json](tsconfig.json)):**
- Target: ES2022
- Module: CommonJS (for Node.js compatibility)
- Output: `dist/main/`
- Includes: `src/main/**/*`, `src/types/**/*`

**Renderer Process ([tsconfig.renderer.json](tsconfig.renderer.json)):**
- Target: ES2022
- Module: ES2022 (ESM for browser)
- Output: `dist/renderer/`
- DOM lib included
- Includes: `src/renderer/**/*`, `src/types/**/*`

**Babel Configuration ([babel.config.js](babel.config.js)):**
- Transform TypeScript for Jest
- Preset: `@babel/preset-typescript`
- Used for test compilation

### Build Process
1. TypeScript compilation (`tsc`)
   - Main: CommonJS for Node.js
   - Renderer: ES Modules for browser
2. Copy static assets (HTML, CSS)
3. Electron packaging (production builds)


### Technical Debt
- [ ] Add more E2E test coverage (multi-window scenarios)
- [x] Implement proper settings panel (✓ implemented)
- [ ] Add telemetry/crash reporting (opt-in)
- [ ] Improve error messages and user feedback
- [ ] Add spell check toggle
- [ ] Implement find/replace functionality
- [ ] Add keyboard shortcut customization
- [ ] Resolve `@exodus/bytes` ESM/CJS mismatch for component tests

## Contributing

### Code Style
- TypeScript with strict typing
- Functional approach where possible
- Clear variable naming
- Comments for complex logic

### Commit Guidelines
- Test all changes
- Update architecture docs if needed
- Follow semantic versioning

## IPC Handlers Reference

### File Operations
- `file:open-dialog` - Show file open dialog
- `file:open` - Read .txti content (lazy, no images)
- `file:load-images` - Extract images to temp dir
- `file:save-dialog` - Show save dialog
- `file:save-as-dialog` - Show save as dialog
- `file:save` - Write .txti file
- `file:new` - Initialize new file temp dir

### Window Operations
- `window:new` - Create new window
- `window:minimize` - Minimize window
- `window:maximize` - Toggle maximize
- `window:force-close` - Close without checks
- `window:keyboard-shortcuts` - Open shortcuts window
- `window:preferences` - Open preferences window
- `window:get-count` - Get open window count
- `window:isMaximized` - Check if window maximized

### Session Management
- `session:get` - Get current session (legacy)
- `session:save` - Save current session (legacy)
- `session:get-full` - Get full session with content
- `session:save-full` - Save full session
- `session:save-tab-content` - Update single tab

### Settings
- `settings:get` - Load user settings
- `settings:save` - Save user settings

### Tab Management
- `tab:close` - Close tab and cleanup temp dir
- `tab:get-temp-dir` - Get temp directory path
- `tab:read-temp-images` - Read temp images as base64
- `tab:restore-temp-images` - Write base64 images to temp dir

### Clipboard & Images
- `clipboard:read-image` - Read image from system clipboard
- `clipboard:save-buffer` - Save clipboard image to temp dir
- `clipboard:paste-image` - Paste image at cursor

### Menu
- `menu:show` - Show native context menu

### Dialogs
- `dialog:unsaved-changes` - Show unsaved changes confirmation

## Contributing

### Code Style
- TypeScript with strict typing
- Functional approach where possible
- Clear variable naming (descriptive, not abbreviated)
- Comments for complex logic
- JSDoc for public APIs
- Consistent formatting (2-space indent)

### File Organization
- One module per file
- Related functions grouped together
- Exports at top or bottom of file
- Imports organized: Node.js → Libraries → Local

### Commit Guidelines
- Test all changes
- Update architecture docs if needed
- Follow semantic versioning
- Write descriptive commit messages
- Reference issues where applicable

### Testing Requirements
- Unit tests for new utility functions
- Integration tests for IPC handlers
- E2E tests for user-facing features
- Maintain >80% code coverage
- All tests must pass before merge

### Pull Request Process
1. Create feature branch
2. Implement changes with tests
3. Update documentation
4. Run full test suite
5. Submit PR with description

## License

MIT License - See [LICENSE](LICENSE) file for details.

---

**Last Updated:** 2025-02-02  
**Version:** 1.0.0  
**Maintainer:** Reymel Sardenia