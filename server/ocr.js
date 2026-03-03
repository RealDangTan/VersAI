const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const Tesseract = require('tesseract.js');
const os = require('os');

async function convertPdfToImages(pdfPath, outputDir) {
    return new Promise((resolve, reject) => {
        // Output format will be outputPrefix-1.png, outputPrefix-2.png, etc.
        const outputPrefix = path.join(outputDir, 'page');

        // -png: Output PNG format
        // -r 300: Resolution 300 DPI (good for OCR)
        const command = `pdftoppm -png -r 300 "${pdfPath}" "${outputPrefix}"`;

        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error(`pdftoppm error: ${stderr}`);
                return reject(error);
            }
            resolve();
        });
    });
}

async function performOCR(filePath, mimeType) {
    if (mimeType !== 'application/pdf') {
        // For direct images, we could just run Tesseract, but for now we focus on PDF fallback
        return "";
    }

    let tempDir = null;
    try {
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ocr-'));
        console.log(`Starting OCR for ${filePath}, temp dir: ${tempDir}`);

        await convertPdfToImages(filePath, tempDir);

        const files = await fs.readdir(tempDir);
        // Sort files to keep page order (page-1, page-2, page-10)
        // Natural sort might be needed if pages > 9, but pdftoppm usually pads or puts numbers?
        // Actually pdftoppm uses -1, -2. Quick sort:
        const imageFiles = files.filter(f => f.endsWith('.png')).sort((a, b) => {
            const numA = parseInt(a.match(/page-(\d+)/)[1]);
            const numB = parseInt(b.match(/page-(\d+)/)[1]);
            return numA - numB;
        });

        console.log(`Converted PDF to ${imageFiles.length} images. Recognizing text...`);

        let fullText = "";
        const worker = await Tesseract.createWorker('eng');

        for (const imageFile of imageFiles) {
            const imagePath = path.join(tempDir, imageFile);
            const { data: { text } } = await worker.recognize(imagePath);
            fullText += text + "\n\n";
        }

        await worker.terminate();
        return fullText;

    } catch (error) {
        console.error("OCR Error:", error);
        throw error;
    } finally {
        // Cleanup
        if (tempDir) {
            try {
                await fs.rm(tempDir, { recursive: true, force: true });
            } catch (cleanupErr) {
                console.error("Failed to clean up temp dir:", cleanupErr);
            }
        }
    }
}

module.exports = { performOCR };
