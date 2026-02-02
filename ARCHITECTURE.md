# TexImg Editor - Architecture Documentation

## Overview

TexImg Editor is an Electron-based desktop application for editing `.txti` files - text documents with embedded images stored as ZIP archives. The application follows a clean separation of concerns with distinct main, preload, and renderer processes, fully implemented in TypeScript.

## Technology Stack

- **Runtime**: Electron 28.0
- **Language**: TypeScript 5.9
- **Build System**: TypeScript Compiler (tsc)
- **File Format**: Custom `.txti` (ZIP with `content.json` + `assets/` folder)
- **Dependencies**:
  - `adm-zip`: ZIP file handling
  - `uuid`: Unique filename generation
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

### Main Process (`src/main/main.ts`)

**Responsibilities:**
- Window lifecycle management
- IPC handler registration
- Temporary directory management for images
- Native menu creation (Electron `Menu.popup()`)
- Session/settings persistence coordination
- Window bounds persistence

**Key Functions:**
- `createWindow()` - Creates new browser window with saved bounds
- `createTempDir(tabId)` - Per-tab temporary directories
- `cleanupTempDir(tabId)` - Cleanup on tab close
- `getWindowBounds()` / `saveWindowBounds()` - Window position persistence

**Key Interfaces:**
```typescript
interface WindowBounds {
    width: number;
    height: number;
    x?: number;
    y?: number;
}

interface SaveFileParams {
    filePath: string;
    content: any[];
    imageFiles: Record<string, string>;
}
```

### Preload (`src/main/preload.ts`)

**Responsibilities:**
- Secure IPC channel exposure via Context Bridge
- Type-safe API between renderer and main

**Exposed API (`window.teximg`):**
```typescript
{
  // Window controls
  minimize, maximize, forceClose, newWindow, showMenu,
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
  closeTab, readTempImages, restoreTempImages,
  
  // Clipboard & images
  readClipboardImage, saveClipboardBuffer, pasteImage,
  
  // Event listeners
  onMaximizedChange, onMenuAction, onCloseRequest
}
```

### Renderer Modules

#### `renderer.ts`
- Application entry point
- Module initialization orchestration
- Session restoration on startup
- Drag and drop file support
- First window vs new window detection

#### `modules/state.ts`
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

**TabState Structure (from `types/index.ts`):**
```typescript
interface TabState {
    id: string;
    filePath: string | null;
    title: string;
    modified: boolean;
    content: Content;
    imageMap: ImageMap;
    tempImages: ImageMap;
    imagesLoaded?: boolean;
    tempImageData?: Record<string, string>;
}
```

#### `modules/Editor.ts`
- ContentEditable management
- Image insertion & resizing with drag handles
- Paste handling (text + images)
- Auto-indentation
- Content serialization to state
- Zoom control

**Key Features:**
- Direct DOM manipulation for performance
- Lazy image loading
- Clipboard image support
- Undo/redo via `execCommand`
- Dynamic tab title updates based on content

**Key Functions:**
- `initEditor()` - Setup editor event handlers
- `renderContentToEditor(tabState)` - Render content to DOM
- `saveEditorToState(tabId)` - Serialize DOM to state
- `insertImage(filename, filePath)` - Add image to editor
- `handlePaste(e)` - Handle paste events
- `undo()` / `redo()` - Document history
- `setZoom(level)` - Editor zoom control

#### `modules/TabManager.ts`
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
- `createTab(filePath, content)` - Create new tab
- `closeTab(tabId)` - Close with unsaved changes check
- `switchToTab(tabId)` - Switch active tab with lazy image loading
- `openFile(filePath)` - Open .txti file
- `saveFile()` / `saveFileAs()` - Save operations
- `restoreSession()` - Restore from persisted session
- `debouncedSaveSession()` - Auto-save session state

#### `modules/UIManager.ts`
- Window controls (minimize, maximize, close)
- Keyboard shortcuts
- Native menu integration via IPC
- Status bar updates (line, column, zoom)
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
| Escape | Close Settings |

#### `modules/SettingsManager.ts`
- Settings UI panel
- Real-time setting application
- Immediate save to main process

**Settings:**
- Line Feed (LF, CRLF, CR)
- Word Wrap
- Auto Indent
- Indent Character (tab/space)
- Tab Size (1-16)
- Indent Size (1-16)

#### `modules/utils.ts`
- `generateTabId()` - Unique tab identifiers
- `getFilename()` - Path parsing
- `formatDirectoryPath()` - Breadcrumb display
- `truncateTabTitle()` - Tab title length management (max 15 chars)
- `debounce()` - Function throttling

### Core Libraries (`src/main/lib/`)

#### `zipHandler.ts`
Handles `.txti` file format operations.

**Functions:**
- `readContentJson(filePath)` - Extract content.json only (lazy)
- `extractImages(filePath, destDir)` - Extract assets to temp directory
- `createZip(content, imageFiles, outputPath)` - Create .txti archive
- `createEmptyDocument()` - New document structure

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

#### `sessionManager.ts`
Persists open tabs and window state across restarts.

**Functions:**
- `getSession()` - Legacy: file paths only
- `getFullSession()` - Complete session with content
- `saveFullSession(sessionData)` - Save all tab data
- `saveTabContent(tabData)` - Incremental tab updates

**Storage:** `~/.config/teximg-editor/session.json`

#### `settingsManager.ts`
User preferences persistence.

**Functions:**
- `getSettings()` - Load with defaults fallback
- `saveSettings(settings)` - Write to disk (merged with existing)

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

**Storage:** `~/.config/teximg-editor/settings.json`

### Type Definitions (`src/types/index.ts`)

Centralized TypeScript interfaces and types:

```typescript
// Content types
ContentItem, Content, TempImageEntry, ImageMap

// State types
TabState, SessionData, AppState

// Settings types
Settings, EditorSettings, LineFeed, IndentChar

// IPC types
SaveFileOptions, LoadFileResult, SaveFileResult, IpcResult<T>

// Zip types
ZipContent, ExtractImagesResult
```

## Data Flow

### Opening a File

```
User clicks "Open" 
  → UIManager triggers openFile()
  → TabManager.openFile()
  → IPC: file:open-dialog
  → Main: showOpenDialog()
  → User selects file
  → IPC: file:open (filePath, tabId)
  → Main: readContentJson() [lazy - no images yet]
  → TabManager creates TabState
  → renderContentToEditor() [shows placeholders for images]
  → User switches to tab
  → IPC: file:load-images (lazy loading)
  → Main: extractImages() to temp dir
  → TabManager updates imageMap
  → renderContentToEditor() [now shows actual images]
```

### Saving a File

```
User presses Ctrl+S
  → UIManager keyboard handler
  → TabManager.saveFile()
  → Editor.saveEditorToState() [DOM → content array]
  → Collect imageMap + tempImages
  → IPC: file:save { filePath, content, imageFiles }
  → Main: zipHandler.createZip()
  → ZIP written to disk
  → TabManager updates tab state (modified = false)
  → Move tempImages → imageMap
  → Update UI
```

### Session Persistence

**On tab modification:**
```
Editor marks modified
  → debouncedSaveSession() (500ms delay)
  → saveEditorToState()
  → saveTabContent() via IPC
  → sessionManager writes to disk
```

**On app start:**
```
renderer.ts initialization
  → Check isFirstWindow URL param
  → If first window: restoreSession()
  → getFullSession() via IPC
  → For each saved tab:
      - Create TabState
      - renderTab()
      - If has tempImageData: restoreTempImages() via IPC
  → switchToTab(activeTabId)
```

## Key Design Patterns

### 1. Lazy Loading
Images are only extracted from .txti when tab becomes active:
- Faster file opening
- Reduces memory usage for background tabs
- Progressive rendering (text first, images later)

### 2. Temporary Directories
Each tab gets isolated temp directory for images:
- Path: `os.tmpdir()/txti-editor/{tabId}/`
- Created on tab open/create
- Cleaned on tab close
- Allows unsaved image paste operations

### 3. Debounced Session Save
Session saves are debounced (500ms) to prevent excessive writes:
- User types → marks modified → triggers debounced save
- Multiple rapid edits = single save
- Ensures crash recovery without performance penalty

### 4. State Synchronization
Clear separation between:
- **Editor DOM state** (what user sees)
- **TabState.content** (serialized data)
- **Disk storage** (.txti files)

Sync points:
- On tab switch: `saveEditorToState(oldTab)`
- Before save: `saveEditorToState(activeTab)`
- On close: `saveEditorToState(allTabs)`

### 5. Event-Driven Architecture
- Main process: IPC handlers
- Renderer: Event listeners + callbacks
- No tight coupling between modules

### 6. Native Menu Integration
- Hamburger button triggers `Menu.popup()` via IPC
- Menu actions sent back to renderer via `menu:action` event
- Provides native OS look and feel

## Performance Considerations

### Memory Management
- Temp directories cleaned on tab close
- Images loaded only when needed (lazy)
- DOM reused (no full re-renders)

### Render Performance
- Direct DOM manipulation (no virtual DOM overhead)
- ContentEditable for native text editing
- CSS-only animations

### File I/O
- Async operations throughout
- Streaming for large files (via adm-zip)
- No blocking main thread

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
- `contextIsolation: true` in BrowserWindow
- `nodeIntegration: false`
- All Node.js APIs accessed via preload bridge

### File Access
- User must explicitly open/save files
- Temp directories in OS-managed location
- No arbitrary file system access from renderer

## Testing Strategy

### Unit Tests (`__tests__/lib/`, `__tests__/renderer/`)
- Individual function testing
- Mock electron APIs
- Fast execution (~2s)

**Coverage:**
- `zipHandler.ts` - ZIP operations
- `sessionManager.ts` - Session persistence
- `settingsManager.ts` - Settings I/O
- `utils.ts` - Helper functions

### Integration Tests (`__tests__/integration/`)
- Multi-module workflows
- IPC handler verification
- File lifecycle testing

**Scenarios:**
- Complete file save/open cycle
- Session restoration
- Multi-tab management
- Settings persistence

### Component Tests (`__tests__/component/`)
- DOM manipulation testing
- UI interaction validation

### E2E Tests (`__tests__/e2e/`)
- Full application flows via Playwright
- Real Electron window testing
- User interaction simulation

### Test Commands
```bash
npm test              # Unit + integration
npm run test:unit     # Unit tests only
npm run test:integration  # Integration tests
npm run test:component    # Component tests
npm run test:e2e      # Playwright E2E
npm run test:all      # All tests including E2E
npm run test:coverage # Coverage report
npm run test:watch    # Watch mode
```

## Build & Development

### Project Structure
```
teximg-editor/
├── src/                        # Source files (TypeScript)
│   ├── main/                   # Main process
│   │   ├── main.ts            # Entry point
│   │   ├── preload.ts         # Context bridge
│   │   └── lib/               # Core libraries
│   │       ├── zipHandler.ts
│   │       ├── sessionManager.ts
│   │       └── settingsManager.ts
│   ├── renderer/               # Browser process
│   │   ├── index.html
│   │   ├── style.css
│   │   ├── renderer.ts
│   │   ├── global.d.ts        # Window.teximg types
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
│   └── e2e/                   # End-to-end tests
├── package.json               # Dependencies & scripts
├── tsconfig.json              # Main process TS config
├── tsconfig.renderer.json     # Renderer process TS config
├── jest.config.js             # Test configuration
└── playwright.config.js       # E2E test config
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

**Main Process (`tsconfig.json`):**
- Target: ES2022
- Module: CommonJS
- Output: `dist/main/`

**Renderer Process (`tsconfig.renderer.json`):**
- Target: ES2022
- Module: ES2022
- Output: `dist/renderer/`
- DOM lib included


### Technical Debt
- Add more E2E test coverage
- Implement proper logger (replace console.*)
- Add telemetry/crash reporting (opt-in)

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

### Testing Requirements
- Unit tests for new utility functions
- Integration tests for IPC handlers
- E2E tests for user-facing features
- Maintain >80% code coverage

## License

MIT License - See [LICENSE](LICENSE) file for details.

---

**Last Updated:** 2026-02-02
**Version:** 1.0.0
**Maintainer:** Reymel Sardenia