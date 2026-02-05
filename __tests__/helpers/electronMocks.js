/**
 * Shared Electron mock utilities for testing
 */

const os = require('os');

/**
 * Create a mock Electron BrowserWindow instance
 */
export function createMockBrowserWindow(overrides = {}) {
    return {
        loadFile: jest.fn(),
        on: jest.fn(),
        webContents: {
            send: jest.fn()
        },
        isMaximized: jest.fn(() => false),
        isMinimized: jest.fn(() => false),
        maximize: jest.fn(),
        unmaximize: jest.fn(),
        minimize: jest.fn(),
        close: jest.fn(),
        removeAllListeners: jest.fn(),
        getBounds: jest.fn(() => ({ width: 1200, height: 800, x: 0, y: 0 })),
        ...overrides
    };
}

/**
 * Create a mock Electron app object
 */
export function createMockApp(userDataPath = os.tmpdir()) {
    return {
        getPath: jest.fn(() => userDataPath),
        on: jest.fn(),
        whenReady: jest.fn(() => Promise.resolve()),
        quit: jest.fn()
    };
}

/**
 * Create a mock Electron dialog object
 */
export function createMockDialog() {
    return {
        showOpenDialog: jest.fn(),
        showSaveDialog: jest.fn(),
        showMessageBox: jest.fn()
    };
}

/**
 * Create a mock Electron ipcMain object
 */
export function createMockIpcMain() {
    return {
        handle: jest.fn(),
        on: jest.fn()
    };
}

/**
 * Create a mock Electron event object
 */
export function createMockEvent(overrides = {}) {
    return {
        sender: {
            getOwnerBrowserWindow: jest.fn()
        },
        preventDefault: jest.fn(),
        ...overrides
    };
}

/**
 * Create a complete Electron mock for jest.mock('electron')
 */
export function createElectronMock(options = {}) {
    const {
        userDataPath = os.tmpdir(),
        mockWindow = createMockBrowserWindow(),
        mockDialog = createMockDialog(),
        mockIpcMain = createMockIpcMain()
    } = options;

    return {
        app: createMockApp(userDataPath),
        BrowserWindow: Object.assign(
            jest.fn().mockImplementation(() => mockWindow),
            {
                fromWebContents: jest.fn(() => mockWindow),
                getAllWindows: jest.fn(() => [mockWindow])
            }
        ),
        ipcMain: mockIpcMain,
        dialog: mockDialog,
        nativeImage: {
            createFromBuffer: jest.fn(),
            createFromPath: jest.fn()
        },
        clipboard: {
            readImage: jest.fn(),
            writeText: jest.fn(),
            writeImage: jest.fn()
        },
        Menu: {
            buildFromTemplate: jest.fn(),
            setApplicationMenu: jest.fn()
        },
        shell: {
            openExternal: jest.fn()
        }
    };
}

/**
 * Setup Electron mocks with beforeEach/afterEach hooks
 */
export function setupElectronMocks(options = {}) {
    let electronMock;
    
    beforeEach(() => {
        electronMock = createElectronMock(options);
        jest.resetModules();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    return () => electronMock;
}

/**
 * Mock Electron with specific handlers
 */
export function mockElectronWithHandlers(handlers = {}) {
    const mock = createElectronMock();
    
    // Setup IPC handlers
    mock.ipcMain.handle.mockImplementation((channel, handler) => {
        handlers[channel] = handler;
    });

    return { mock, handlers };
}

/**
 * Create a mock dialog response for file open
 */
export function mockOpenDialogResponse(filePaths = [], canceled = false) {
    return {
        canceled,
        filePaths
    };
}

/**
 * Create a mock dialog response for file save
 */
export function mockSaveDialogResponse(filePath = null, canceled = false) {
    return {
        canceled,
        filePath
    };
}

/**
 * Create a mock dialog response for message box
 */
export function mockMessageBoxResponse(response = 0, checkboxChecked = false) {
    return {
        response,
        checkboxChecked
    };
}

/**
 * Extract all event handlers registered on a mock window
 */
export function getWindowEventHandlers(mockWindow) {
    const handlers = {};
    mockWindow.on.mock.calls.forEach(([event, handler]) => {
        handlers[event] = handler;
    });
    return handlers;
}

/**
 * Extract all IPC handlers registered
 */
export function getIpcHandlers(mockIpcMain) {
    const handlers = {};
    mockIpcMain.handle.mock.calls.forEach(([channel, handler]) => {
        handlers[channel] = handler;
    });
    return handlers;
}
