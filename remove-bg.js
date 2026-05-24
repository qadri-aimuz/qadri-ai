const fs = require('fs');
const { removeBackground } = require('@imgly/background-removal-node');

async function processImage(inputPath, outputPath) {
    try {
        console.log(`Processing ${inputPath}...`);
        const blob = await removeBackground(inputPath);
        const buffer = Buffer.from(await blob.arrayBuffer());
        fs.writeFileSync(outputPath, buffer);
        console.log(`Successfully saved transparent image to ${outputPath}`);
    } catch (e) {
        console.error(`Failed to process ${inputPath}:`, e.message);
    }
}

async function main() {
    const filesToProcess = [
        'public/logo.png',
        'public/icon.png',
        'public/logo_new.png'
    ];

    for (const file of filesToProcess) {
        if (fs.existsSync(file)) {
            // Overwrite original with the transparent one
            await processImage(file, file);
        }
    }
}

main();
