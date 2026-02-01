import AdmZip = require('adm-zip');
import { promises as fs } from 'fs';
import * as path from 'path';
import { Content, ZipContent, ExtractImagesResult, ImageMap } from '../types';

export async function readContentJson(filePath: string): Promise<ZipContent> {
    try {
        const buffer = await fs.readFile(filePath);
        const zip = new AdmZip(buffer);
        const contentEntry = zip.getEntry('content.json');

        if (!contentEntry) {
            throw new Error('Invalid .txti file: missing content.json');
        }

        const contentJson: Content = JSON.parse(contentEntry.getData().toString('utf-8'));

        const assetList = zip.getEntries()
            .filter((entry: AdmZip.IZipEntry) => entry.entryName.startsWith('assets/') && !entry.isDirectory)
            .map((entry: AdmZip.IZipEntry) => path.basename(entry.entryName));

        return { content: contentJson, assetList };
    } catch (err) {
        const error = err as Error;
        throw new Error(`Failed to read file: ${error.message}`);
    }
}

export async function extractImages(filePath: string, destDir: string): Promise<ExtractImagesResult> {
    await fs.mkdir(destDir, { recursive: true });

    const buffer = await fs.readFile(filePath);
    const zip = new AdmZip(buffer);
    const imageMap: ExtractImagesResult = {};

    const assetEntries = zip.getEntries()
        .filter((entry: AdmZip.IZipEntry) => entry.entryName.startsWith('assets/') && !entry.isDirectory);

    const writePromises = assetEntries.map(async (entry: AdmZip.IZipEntry) => {
        const filename = path.basename(entry.entryName);
        const destPath = path.join(destDir, filename);
        const data = entry.getData();
        await fs.writeFile(destPath, data);
        imageMap[filename] = destPath;
    });

    await Promise.all(writePromises);

    return imageMap;
}

export async function createZip(contentJson: Content, imageFiles: ImageMap, outputPath: string): Promise<void> {
    const zip = new AdmZip();

    const contentBuffer = Buffer.from(JSON.stringify(contentJson, null, 2), 'utf-8');
    zip.addFile('content.json', contentBuffer);

    for (const [filename, sourcePath] of Object.entries(imageFiles)) {
        try {
            const imageData = await fs.readFile(sourcePath);
            zip.addFile(`assets/${filename}`, imageData);
        } catch (err) {
            const error = err as Error;
            console.warn(`Failed to read image ${sourcePath}: ${error.message}`);
        }
    }

    return new Promise((resolve, reject) => {
        zip.writeZip(outputPath, (err: Error | null) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

export function createEmptyDocument(): ZipContent {
    return {
        content: [],
        assetList: []
    };
}
