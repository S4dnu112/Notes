# TexImg Editor - Architecture Documentation

## Overview

TexImg Editor is an Electron-based desktop application for editing `.txti` files - text documents with embedded images stored as ZIP archives. The application follows a clean separation of concerns with distinct main, preload, and renderer processes.

## Technology Stack

- **Runtime**: Electron 28.0
- **Language**: JavaScript/TypeScript (migration in progress)
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
│  │ main.js      │  │ IPC Handlers │  │ Window Mgmt  │      │
│  │              │  │              │  │              │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│  ┌──────────────────────────────────────────────────┐      │
│  │ Core Libraries (lib/)                            │      │
│  │  • zipHandler.js    - ZIP read/write            │      │
│  │  • sessionManager.js - Session persistence      │      │
│  │  • settingsManager.js - User preferences        │      │
│  └──────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            │
                   ┌────────┴────────┐
                   │   preload.js    │
                   │  Context Bridge │
                   └────────┬────────┘
                            │
┌─────────────────────────────────────────────────────────────┐
│                    Renderer Process (Browser)                │
│  ┌──────────────────────────────────────────────────┐      │
│  │ renderer/                                        │      │
│  │  ┌────────────────┐  ┌────────────────┐         │      │
│  │  │ renderer.js    │  │ index.html     │         │      │
│  │  │ (Entry point)  │  │ (UI Structure) │         │      │
│  │  └────────────────┘  └────────────────┘         │      │
│  │                                                  │      │
│  │  modules/                                        │      │
│  │  ┌────────────────────────────────────────┐     │      │
│  │  │ • Editor.js        - Content editing   │     │      │
│  │  │ • TabManager.js    - Multi-tab logic   │     │      │
│  │  │ • UIManager.js     - Window controls   │     │      │
│  │  │ • SettingsManager.js - UI settings     │     │      │
│  │  │ • state.js         - Application state │     │      │
│  │  │ • utils.js         - Helper functions  │     │      │
│  │  └────────────────────────────────────────┘     │      │
│  └──────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

## Core Modules

### Main Process (`main.js`)

**Responsibilities:**
- Window lifecycle management
- IPC handler registration
- Temporary directory management for images
- Native menu creation
- Session/settings persistence coordination

**Key Functions:**
- `createWindow()` - Creates new browser window
- `createTempDir(tabId)` - Per-tab temporary directories
- `cleanupTempDir(tabId)` - Cleanup on tab close

### Preload (`preload.js`)

**Responsibilities:**
- Secure IPC channel exposure via Context Bridge
- Type-safe API between renderer and main

**Exposed API (`window.teximg`):**
```javascript
{
  // Window controls
  minimize, maximize, forceClose, newWindow,
  
  // File operations
  openDialog, openFile, saveFile, loadImages,
  
  // Session management
  getSession, saveSession, getFullSession, saveFullSession,
  
  // Settings
  getSettings, saveSettings,
  
  // Clipboard & temp management
  readClipboardImage, saveClipboardBuffer,
  readTempImages, restoreTempImages
}
```

### Renderer Modules

#### `renderer.js`
- Application entry point
- Module initialization orchestration
- Session restoration on startup

#### `modules/state.js`
- Centralized application state
- Tab data structure
- Settings cache

**State Structure:**
```javascript
{
  tabs: Map<string, TabState>,
  tabOrder: string[],
  activeTabId: string | null,
  tabCounter: number,
  settings: {
    lineFeed: 'LF' | 'CRLF' | 'CR',
    autoIndent: boolean,
    indentChar: 'tab' | 'space',
    tabSize: number,
    indentSize: number,
    wordWrap: boolean
  },
  zoomLevel: number
}
```

**TabState Structure:**
```javascript
{
  id: string,
  filePath: string | null,
  title: string,
  modified: boolean,
  imagesLoaded: boolean,
  content: ContentItem[],
  imageMap: Record<string, string>,    // saved images
  tempImages: Record<string, string>   // unsaved images
}
```

#### `modules/Editor.js`
- ContentEditable management
- Image insertion & resizing
- Paste handling (text + images)
- Auto-indentation
- Content serialization to state

**Key Features:**
- Direct DOM manipulation for performance
- Lazy image loading
- Clipboard image support
- Undo/redo via `execCommand`

#### `modules/TabManager.js`
- Tab lifecycle (create, close, switch)
- Drag-and-drop tab reordering
- File operations (open, save, save-as)
- Session persistence
- Welcome screen management

**Tab Operations Flow:**
```
createTab → renderTab → switchToTab → renderContentToEditor
openFile → extractContent → createTab → loadImages (lazy)
saveFile → saveEditorToState → createZip → IPC save
```

#### `modules/UIManager.js`
- Window controls (minimize, maximize, close)
- Keyboard shortcuts
- Native menu integration
- Status bar updates
- Close confirmation for unsaved tabs

#### `modules/SettingsManager.js`
- Settings UI panel
- Real-time setting application
- Debounced save to main process

#### `modules/utils.js`
- `generateTabId()` - Unique tab identifiers
- `getFilename()` - Path parsing
- `formatDirectoryPath()` - Breadcrumb display
- `truncateTabTitle()` - Tab title length management
- `debounce()` - Function throttling

### Core Libraries (`lib/`)

#### `zipHandler.js`
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

#### `sessionManager.js`
Persists open tabs and window state across restarts.

**Functions:**
- `getSession()` - Legacy: file paths only
- `getFullSession()` - Complete session with content
- `saveFullSession(sessionData)` - Save all tab data
- `saveTabContent(tabData)` - Incremental tab updates

**Storage:** `~/.config/txti-editor/session.json`

#### `settingsManager.js`
User preferences persistence.

**Functions:**
- `getSettings()` - Load with defaults fallback
- `saveSettings(settings)` - Write to disk

**Storage:** `~/.config/txti-editor/settings.json`

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
  → saveFullSession() via IPC
  → sessionManager writes to disk
```

**On app start:**
```
renderer.js initialization
  → restoreSession()
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
- `zipHandler.js` - ZIP operations
- `sessionManager.js` - Session persistence
- `settingsManager.js` - Settings I/O
- `utils.js` - Helper functions

### Integration Tests (`__tests__/integration/`)
- Multi-module workflows
- IPC handler verification
- File lifecycle testing

**Scenarios:**
- Complete file save/open cycle
- Session restoration
- Multi-tab management
- Settings persistence

### Component Tests (`__tests__/component/`) [Currently disabled due to ESM issues]
- DOM manipulation testing
- UI interaction validation
- Will be re-enabled after TypeScript migration

### E2E Tests (`__tests__/e2e/`)
- Full application flows via Playwright
- Real Electron window testing
- User interaction simulation

**Test Files:**
- `basic-functionality.spec.js` - Core features
- `file-operations.spec.js` - Open/save workflows
- `tab-management.spec.js` - Multi-tab scenarios
- `settings.spec.js` - Settings persistence

### Test Commands
```bash
npm test              # Unit + integration
npm run test:e2e      # Playwright E2E
npm run test:coverage # Coverage report
npm run test:watch    # Watch mode
```

## Build & Development

### Project Structure
```
teximg-editor/
├── main.js                  # Main process entry
├── preload.js              # Context bridge
├── package.json            # Dependencies & scripts
├── tsconfig.json           # TypeScript config
├── jest.config.js          # Test configuration
├── playwright.config.js    # E2E test config
│
├── lib/                    # Core libraries (Node.js)
│   ├── zipHandler.js
│   ├── sessionManager.js
│   └── settingsManager.js
│
├── renderer/               # Browser process
│   ├── index.html
│   ├── style.css
│   ├── renderer.js
│   └── modules/
│       ├── Editor.js
│       ├── TabManager.js
│       ├── UIManager.js
│       ├── SettingsManager.js
│       ├── state.js
│       └── utils.js
│
└── __tests__/              # Test suites
    ├── lib/                # Library unit tests
    ├── renderer/           # Renderer unit tests
    ├── integration/        # Integration tests
    ├── component/          # Component tests
    └── e2e/                # End-to-end tests
```

### Development Workflow
```bash
npm run build       # Compile TypeScript
npm run dev         # Build + start Electron
npm run start       # Production start
npm test            # Run tests
```

### TypeScript Migration (In Progress)
- Target: Full TypeScript conversion
- Strategy: Gradual module-by-module migration
- Current: Type definitions in `types.ts`
- Benefits: Better IntelliSense, type safety, refactoring confidence

## Future Enhancements

### Planned Features
- [ ] Collaborative editing (WebRTC/WebSocket)
- [ ] Plugin system for extensibility
- [ ] Markdown export
- [ ] Cloud sync (optional)
- [ ] Mobile companion app
- [ ] Theme customization

### Technical Debt
- Complete TypeScript migration
- Fix component tests (ESM issues)
- Add more E2E test coverage
- Implement proper logger (replace console.*)
- Add telemetry/crash reporting (opt-in)

## Contributing

### Code Style
- ES6+ JavaScript/TypeScript
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

**Last Updated:** 2026-01-XX
**Version:** 1.0.0
**Maintainer:** Reymel Sardenia