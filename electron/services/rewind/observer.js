const screenshot = require('screenshot-desktop');
const { createWorker } = require('tesseract.js');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs-extra');
const db = require('./database');

class RewindObserver {
    constructor() {
        this.intervalId = null;
        this.worker = null;
        this.lastImageHash = null;
        this.isRecording = false;
        
        // Privacy settings
        this.excludedKeywords = ['bank', 'password', 'incognito', 'private', 'login', 'otp'];
    }

    async init() {
        console.log('[Rewind Observer] Initializing Tesseract Worker...');
        this.worker = await createWorker('eng');
    }

    start() {
        if (this.isRecording) return;
        this.isRecording = true;
        console.log('[Rewind Observer] Memory Recording Started.');
        
        // 10 second interval
        this.intervalId = setInterval(() => this.captureFrame(), 10000);
    }

    pause() {
        if (!this.isRecording) return;
        this.isRecording = false;
        clearInterval(this.intervalId);
        console.log('[Rewind Observer] Memory Recording Paused.');
    }

    async captureFrame() {
        if (!this.isRecording || !this.worker) return;

        try {
            // 1. Capture screen
            const imgBuffer = await screenshot({ format: 'png' });
            
            // 2. Check for duplicate/static screen using SHA-1 hash
            const currentHash = crypto.createHash('sha1').update(imgBuffer).digest('hex');
            if (currentHash === this.lastImageHash) {
                // Screen hasn't changed, skip to save CPU
                return; 
            }
            this.lastImageHash = currentHash;

            // 3. OCR Text Extraction
            const { data: { text } } = await this.worker.recognize(imgBuffer);
            const lowerText = text.toLowerCase();

            // 4. Privacy Filter Check
            const isSensitive = this.excludedKeywords.some(kw => lowerText.includes(kw));
            if (isSensitive) {
                console.log('[Rewind Observer] Sensitive content detected. Frame skipped.');
                return;
            }

            // 5. Semantic Summary (Lightweight extraction for now, can be passed to Gemini later)
            // Just take first 200 chars of meaningful text as a rough summary to save tokens.
            const cleanText = text.replace(/\s+/g, ' ').trim();
            const semanticSummary = cleanText.substring(0, 250);

            if (cleanText.length < 10) return; // Ignore blank/empty screens

            // 6. Save Image to disk
            const fileName = `mem_${Date.now()}.png`;
            const filePath = path.join(db.imageDir, fileName);
            await fs.writeFile(filePath, imgBuffer);

            // 7. Save to DB
            await db.addMemoryFrame({
                app: 'Desktop', // Would use active-win if available
                windowTitle: 'System',
                ocrText: cleanText,
                semanticSummary: semanticSummary,
                imageFile: fileName
            });

            // Run cleanup every capture (or could be daily)
            await db.cleanupOldMemories(7);

        } catch (error) {
            console.error('[Rewind Observer] Capture error:', error);
        }
    }
}

module.exports = new RewindObserver();
