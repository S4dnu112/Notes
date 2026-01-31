const AdmZip = require('adm-zip');
const fs = require('fs').promises;
const path = require('path');

async function readContentJson(filePath) {
    try {
        const buffer = await fs.readFile(filePath);
        const zip = new AdmZip(buffer);
        const contentEntry = zip.getEntry('content.json');

        if (!contentEntry) {
            throw new Error('Invalid .txti file: missing content.json');
        }

        const contentJson = JSON.parse(contentEntry.getData().toString('utf-8'));

        const assetList = zip.getEntries()
            .filter(entry => entry.entryName.startsWith('assets/') && !entry.isDirectory)
            .map(entry => path.basename(entry.entryName));

        return { content: contentJson, assetList };
    } catch (err) {
        throw new Error(`Failed to read file: ${err.message}`);
    }
}

async function extractImages(filePath, destDir) {
    await fs.mkdir(destDir, { recursive: true });

    const buffer = await fs.readFile(filePath);
    const zip = new AdmZip(buffer);
    const imageMap = {};

    const assetEntries = zip.getEntries()
        .filter(entry => entry.entryName.startsWith('assets/') && !entry.isDirectory);

    const writePromises = assetEntries.map(async (entry) => {
        const filename = path.basename(entry.entryName);
        const destPath = path.join(destDir, filename);
        const data = entry.getData();
        await fs.writeFile(destPath, data);
        imageMap[filename] = destPath;
    });

    await Promise.all(writePromises);

    return imageMap;
}

async function createZip(contentJson, imageFiles, outputPath) {
    const zip = new AdmZip();

    const contentBuffer = Buffer.from(JSON.stringify(contentJson, null, 2), 'utf-8');
    zip.addFile('content.json', contentBuffer);

    for (const [filename, sourcePath] of Object.entries(imageFiles)) {
        try {
            const imageData = await fs.readFile(sourcePath);
            zip.addFile(`assets/${filename}`, imageData);
        } catch (err) {
            console.warn(`Failed to read image ${sourcePath}: ${err.message}`);
        }
    }

    return new Promise((resolve, reject) => {
        zip.writeZip(outputPath, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

function createEmptyDocument() {
    return {
        content: [],
        assetList: []
    };
}

module.exports = { readContentJson, extractImages, createZip, createEmptyDocument };
