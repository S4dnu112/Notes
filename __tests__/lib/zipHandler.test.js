const fs = require('fs').promises;
const path = require('path');
const AdmZip = require('adm-zip');
const {
    readContentJson,
    extractImages,
    createZip,
    createEmptyDocument
} = require('../../dist/lib/zipHandler');

describe('zipHandler', () => {
    const testDir = '/tmp/ziphandler-test';
    const testFilePath = path.join(testDir, 'test.txti');
    const extractDir = path.join(testDir, 'extracted');

    beforeAll(async () => {
        await fs.mkdir(testDir, { recursive: true });
    });

    afterAll(async () => {
        await fs.rm(testDir, { recursive: true, force: true });
    });

    beforeEach(async () => {
        // Clean up test files
        try {
            await fs.unlink(testFilePath);
        } catch (err) {
            // Ignore if file doesn't exist
        }
        try {
            await fs.rm(extractDir, { recursive: true, force: true });
        } catch (err) {
            // Ignore if directory doesn't exist
        }
    });

    describe('createEmptyDocument', () => {
        test('should create empty document structure', () => {
            const doc = createEmptyDocument();
            expect(doc).toHaveProperty('content');
            expect(doc).toHaveProperty('assetList');
            expect(doc.content).toEqual([]);
            expect(doc.assetList).toEqual([]);
        });
    });

    describe('createZip', () => {
        test('should create a valid .txti file', async () => {
            const contentJson = {
                content: [
                    { type: 'text', value: 'Hello World' }
                ]
            };

            await createZip(contentJson, {}, testFilePath);

            expect(await fs.access(testFilePath).then(() => true).catch(() => false)).toBe(true);

            // Verify zip contents
            const zip = new AdmZip(await fs.readFile(testFilePath));
            const contentEntry = zip.getEntry('content.json');
            expect(contentEntry).toBeTruthy();

            const content = JSON.parse(contentEntry.getData().toString('utf-8'));
            expect(content.content).toEqual(contentJson.content);
        });

        test('should include images in assets folder', async () => {
            const contentJson = {
                content: [
                    { type: 'text', value: 'Test' },
                    { type: 'image', filename: 'test.png' }
                ]
            };

            // Create a dummy image file
            const imageDir = path.join(testDir, 'images');
            await fs.mkdir(imageDir, { recursive: true });
            const imagePath = path.join(imageDir, 'test.png');
            await fs.writeFile(imagePath, Buffer.from('fake-image-data'));

            const imageFiles = {
                'test.png': imagePath
            };

            await createZip(contentJson, imageFiles, testFilePath);

            // Verify zip contents
            const zip = new AdmZip(await fs.readFile(testFilePath));
            const imageEntry = zip.getEntry('assets/test.png');
            expect(imageEntry).toBeTruthy();
            expect(imageEntry.getData().toString()).toBe('fake-image-data');
        });

        test('should handle missing image files gracefully', async () => {
            const contentJson = { content: [] };
            const imageFiles = {
                'missing.png': '/non/existent/path.png'
            };

            const consoleWarn = jest.spyOn(console, 'warn').mockImplementation();

            await createZip(contentJson, imageFiles, testFilePath);

            expect(consoleWarn).toHaveBeenCalled();
            expect(await fs.access(testFilePath).then(() => true).catch(() => false)).toBe(true);

            consoleWarn.mockRestore();
        });
    });

    describe('readContentJson', () => {
        test('should read content.json from .txti file', async () => {
            // Create a test .txti file
            const contentJson = {
                content: [
                    { type: 'text', value: 'Test content' }
                ]
            };

            const zip = new AdmZip();
            zip.addFile('content.json', Buffer.from(JSON.stringify(contentJson)));
            zip.writeZip(testFilePath);

            const result = await readContentJson(testFilePath);
            expect(result.content).toEqual(contentJson);
            expect(result.assetList).toEqual([]);
        });

        test('should list assets from .txti file', async () => {
            const contentJson = {
                content: [
                    { type: 'image', filename: 'image1.png' },
                    { type: 'image', filename: 'image2.jpg' }
                ]
            };

            const zip = new AdmZip();
            zip.addFile('content.json', Buffer.from(JSON.stringify(contentJson)));
            zip.addFile('assets/image1.png', Buffer.from('image1'));
            zip.addFile('assets/image2.jpg', Buffer.from('image2'));
            zip.writeZip(testFilePath);

            const result = await readContentJson(testFilePath);
            expect(result.content).toEqual(contentJson);
            expect(result.assetList).toHaveLength(2);
            expect(result.assetList).toContain('image1.png');
            expect(result.assetList).toContain('image2.jpg');
        });

        test('should throw error for missing content.json', async () => {
            const zip = new AdmZip();
            zip.addFile('other.json', Buffer.from('{}'));
            zip.writeZip(testFilePath);

            await expect(readContentJson(testFilePath)).rejects.toThrow('Invalid .txti file');
        });

        test('should throw error for non-existent file', async () => {
            await expect(readContentJson('/non/existent/file.txti')).rejects.toThrow();
        });
    });

    describe('extractImages', () => {
        test('should extract all images to destination directory', async () => {
            // Create test .txti with images
            const zip = new AdmZip();
            zip.addFile('content.json', Buffer.from('{}'));
            zip.addFile('assets/image1.png', Buffer.from('image1-data'));
            zip.addFile('assets/image2.jpg', Buffer.from('image2-data'));
            zip.writeZip(testFilePath);

            const imageMap = await extractImages(testFilePath, extractDir);

            expect(Object.keys(imageMap)).toHaveLength(2);
            expect(imageMap['image1.png']).toBeDefined();
            expect(imageMap['image2.jpg']).toBeDefined();

            // Verify files were extracted
            const img1 = await fs.readFile(imageMap['image1.png'], 'utf-8');
            const img2 = await fs.readFile(imageMap['image2.jpg'], 'utf-8');
            expect(img1).toBe('image1-data');
            expect(img2).toBe('image2-data');
        });

        test('should create destination directory if it does not exist', async () => {
            const zip = new AdmZip();
            zip.addFile('content.json', Buffer.from('{}'));
            zip.addFile('assets/test.png', Buffer.from('test'));
            zip.writeZip(testFilePath);

            const newExtractDir = path.join(testDir, 'new', 'nested', 'dir');
            await extractImages(testFilePath, newExtractDir);

            const dirExists = await fs.access(newExtractDir).then(() => true).catch(() => false);
            expect(dirExists).toBe(true);
        });

        test('should return empty map for .txti with no images', async () => {
            const zip = new AdmZip();
            zip.addFile('content.json', Buffer.from('{}'));
            zip.writeZip(testFilePath);

            const imageMap = await extractImages(testFilePath, extractDir);
            expect(Object.keys(imageMap)).toHaveLength(0);
        });

        test('should handle zip files with subdirectories in assets', async () => {
            const zip = new AdmZip();
            zip.addFile('content.json', Buffer.from('{}'));
            zip.addFile('assets/subfolder/', Buffer.alloc(0)); // Directory entry
            zip.addFile('assets/image.png', Buffer.from('image-data'));
            zip.writeZip(testFilePath);

            const imageMap = await extractImages(testFilePath, extractDir);

            expect(Object.keys(imageMap)).toHaveLength(1);
            expect(imageMap['image.png']).toBeDefined();
        });
    });
});
