/**
 * Integration Tests for Main Process - Dialog Handlers
 */

const path = require('path');
const fs = require('fs');
const os = require('os');

const mockTmpDir = os.tmpdir();

jest.mock('electron', () => ({
    app: {
        getPath: jest.fn(() => mockTmpDir),
        on: jest.fn(),
        whenReady: jest.fn(() => Promise.resolve())
    },
    BrowserWindow: Object.assign(
        jest.fn().mockImplementation(() => ({
            loadFile: jest.fn(),
            on: jest.fn(),
            webContents: { send: jest.fn() }
        })),
        {
            fromWebContents: jest.fn(() => ({}))
        }
    ),
    ipcMain: {
        handle: jest.fn(),
        on: jest.fn()
    },
    dialog: {
        showOpenDialog: jest.fn(),
        showSaveDialog: jest.fn(),
        showMessageBox: jest.fn()
    },
    nativeImage: {
        createFromBuffer: jest.fn()
    },
    clipboard: {
        readImage: jest.fn(),
        writeText: jest.fn()
    },
    Menu: {
        buildFromTemplate: jest.fn(),
        setApplicationMenu: jest.fn()
    }
}));

const { ipcMain, dialog } = require('electron');

describe('Main Process - Dialog Handlers', () => {
    let handlers;
    let mockEvent;
    let testDir;

    beforeEach(() => {
        testDir = path.join(os.tmpdir(), 'txti-test-' + Date.now());
        fs.mkdirSync(testDir, { recursive: true });

        handlers = {};
        ipcMain.handle.mockImplementation((channel, handler) => {
            handlers[channel] = handler;
        });

        mockEvent = {
            sender: {
                getOwnerBrowserWindow: jest.fn()
            }
        };

        jest.clearAllMocks();
        jest.isolateModules(() => {
            require('../../dist/main/main.js');
        });
    });

    afterEach(() => {
        if (fs.existsSync(testDir)) {
            fs.rmSync(testDir, { recursive: true, force: true });
        }
    });

    describe('Unsaved Changes Dialog', () => {
        test('dialog:unsaved-changes should show confirmation dialog', async () => {
            dialog.showMessageBox.mockResolvedValue({ response: 0 });

            const handler = handlers['dialog:unsaved-changes'];
            const result = await handler(mockEvent, 'document.txti');

            expect(result).toBe('save');
            expect(dialog.showMessageBox).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    type: 'question',
                    message: expect.stringContaining('document.txti')
                })
            );
        });

        test('dialog:unsaved-changes should handle discard option', async () => {
            dialog.showMessageBox.mockResolvedValue({ response: 1 });

            const handler = handlers['dialog:unsaved-changes'];
            const result = await handler(mockEvent, 'test.txti');

            expect(result).toBe('discard');
        });

        test('dialog:unsaved-changes should handle cancel option', async () => {
            dialog.showMessageBox.mockResolvedValue({ response: 2 });

            const handler = handlers['dialog:unsaved-changes'];
            const result = await handler(mockEvent, 'test.txti');

            expect(result).toBe('cancel');
        });

        test('dialog:unsaved-changes-multiple should show multi-file dialog', async () => {
            dialog.showMessageBox.mockResolvedValue({ response: 0 });

            const handler = handlers['dialog:unsaved-changes-multiple'];
            const filenames = ['file1.txti', 'file2.txti', 'file3.txti'];
            const result = await handler(mockEvent, filenames);

            expect(result).toBe('save');
            expect(dialog.showMessageBox).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    type: 'question',
                    buttons: ['Save All', "Don't Save", 'Cancel'],
                    message: expect.stringContaining('3 files'),
                    detail: expect.stringContaining('file1.txti')
                })
            );
        });

        test('dialog:unsaved-changes-multiple should handle discard', async () => {
            dialog.showMessageBox.mockResolvedValue({ response: 1 });

            const handler = handlers['dialog:unsaved-changes-multiple'];
            const result = await handler(mockEvent, ['file1.txti', 'file2.txti']);

            expect(result).toBe('discard');
        });

        test('dialog:unsaved-changes-multiple should handle cancel', async () => {
            dialog.showMessageBox.mockResolvedValue({ response: 2 });

            const handler = handlers['dialog:unsaved-changes-multiple'];
            const result = await handler(mockEvent, ['file1.txti']);

            expect(result).toBe('cancel');
        });
    });

    describe('File Dialogs', () => {
        test('file:open-dialog should return selected file path', async () => {
            const selectedPath = '/user/selected/file.txti';
            dialog.showOpenDialog.mockResolvedValue({
                canceled: false,
                filePaths: [selectedPath]
            });

            const handler = handlers['file:open-dialog'];
            const result = await handler(mockEvent);

            expect(result).toBe(selectedPath);
            expect(dialog.showOpenDialog).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    filters: expect.arrayContaining([
                        expect.objectContaining({ extensions: ['txti'] })
                    ])
                })
            );
        });

        test('file:open-dialog should return null when canceled', async () => {
            dialog.showOpenDialog.mockResolvedValue({
                canceled: true,
                filePaths: []
            });

            const handler = handlers['file:open-dialog'];
            const result = await handler(mockEvent);

            expect(result).toBeNull();
        });

        test('file:save-dialog should return save path', async () => {
            const savePath = '/user/save/doc.txti';
            dialog.showSaveDialog.mockResolvedValue({
                canceled: false,
                filePath: savePath
            });

            const handler = handlers['file:save-dialog'];
            const result = await handler(mockEvent, 'doc.txti');

            expect(result).toBe(savePath);
        });

        test('file:save-dialog should use default name', async () => {
            dialog.showSaveDialog.mockResolvedValue({
                canceled: false,
                filePath: '/path/custom.txti'
            });

            const handler = handlers['file:save-dialog'];
            await handler(mockEvent, 'custom.txti');

            expect(dialog.showSaveDialog).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    defaultPath: 'custom.txti'
                })
            );
        });

        test('file:save-as-dialog should return save path', async () => {
            const savePath = '/user/saveas/document.txti';
            dialog.showSaveDialog.mockResolvedValue({
                canceled: false,
                filePath: savePath
            });

            const handler = handlers['file:save-as-dialog'];
            const result = await handler(mockEvent, '/current/path.txti');

            expect(result).toBe(savePath);
            expect(dialog.showSaveDialog).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    filters: expect.arrayContaining([
                        expect.objectContaining({ extensions: ['txti'] })
                    ]),
                    defaultPath: '/current/path.txti'
                })
            );
        });

        test('file:save-as-dialog should use default path when no current path', async () => {
            dialog.showSaveDialog.mockResolvedValue({
                canceled: false,
                filePath: '/new/document.txti'
            });

            const handler = handlers['file:save-as-dialog'];
            const result = await handler(mockEvent, null);

            expect(result).toBe('/new/document.txti');
            expect(dialog.showSaveDialog).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    defaultPath: 'document.txti'
                })
            );
        });

        test('file:save-as-dialog should return null when canceled', async () => {
            dialog.showSaveDialog.mockResolvedValue({
                canceled: true,
                filePath: undefined
            });

            const handler = handlers['file:save-as-dialog'];
            const result = await handler(mockEvent, '/current/path.txti');

            expect(result).toBeNull();
        });
    });
});
