const AdmZip = require('adm-zip');
const fs = require('fs').promises;
const path = require('path');

/**
 * Read only content.json from a .txti file (lazy - no images)
 * @param {string} filePath - Path to .txti file
 * @returns {Promise<{ content: object[], assetList: string[] }>} Document content and list of asset filenames
 */
async function readContentJson(filePath) {
    try {
        // Read file asynchronously first
        const buffer = await fs.readFile(filePath);
        const zip = new AdmZip(buffer);
        const contentEntry = zip.getEntry('content.json');

        if (!contentEntry) {
            throw new Error('Invalid .txti file: missing content.json');
        }

        // getData is sync but strictly in-memory here if buffer was passed
        const contentJson = JSON.parse(contentEntry.getData().toString('utf-8'));

        // Get list of assets without extracting them
        const assetList = zip.getEntries()
            .filter(entry => entry.entryName.startsWith('assets/') && !entry.isDirectory)
            .map(entry => path.basename(entry.entryName));

        return { content: contentJson, assetList };
    } catch (err) {
        throw new Error(`Failed to read file: ${err.message}`);
    }
}

/**
 * Extract images from assets/ folder to a destination directory
 * @param {string} filePath - Path to .txti file
 * @param {string} destDir - Destination directory for extracted images
 * @returns {Promise<Object.<string, string>>} Map of original filename to extracted file path
 */
async function extractImages(filePath, destDir) {
    // Ensure destination directory exists
    await fs.mkdir(destDir, { recursive: true });

    const buffer = await fs.readFile(filePath);
    const zip = new AdmZip(buffer);
    const imageMap = {};

    const assetEntries = zip.getEntries()
        .filter(entry => entry.entryName.startsWith('assets/') && !entry.isDirectory);

    // Write files in parallel
    const writePromises = assetEntries.map(async (entry) => {
        const filename = path.basename(entry.entryName);
        const destPath = path.join(destDir, filename);
        const data = entry.getData(); // Sync but in-memory
        await fs.writeFile(destPath, data);
        imageMap[filename] = destPath;
    });

    await Promise.all(writePromises);

    return imageMap;
}

/**
 * Create a .txti zip file from content and images
 * @param {object[]} contentJson - Document content array
 * @param {Object.<string, string>} imageFiles - Map of filename to source file path
 * @param {string} outputPath - Output .txti file path
 */
async function createZip(contentJson, imageFiles, outputPath) {
    const zip = new AdmZip();

    // Add content.json
    const contentBuffer = Buffer.from(JSON.stringify(contentJson, null, 2), 'utf-8');
    zip.addFile('content.json', contentBuffer);

    // Add images to assets/ folder
    for (const [filename, sourcePath] of Object.entries(imageFiles)) {
        try {
            const imageData = await fs.readFile(sourcePath);
            zip.addFile(`assets/${filename}`, imageData);
        } catch (err) {
            console.warn(`Failed to read image ${sourcePath}: ${err.message}`);
            // Continue skipping this image
        }
    }

    // writeZip is sync or async-callback. Using promise wrapper for async write.
    return new Promise((resolve, reject) => {
        zip.writeZip(outputPath, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

/**
 * Create an empty document structure
 * @returns {{ content: object[], assetList: string[] }}
 */
function createEmptyDocument() {
    return {
        content: [],
        assetList: []
    };
}

module.exports = { readContentJson, extractImages, createZip, createEmptyDocument };
