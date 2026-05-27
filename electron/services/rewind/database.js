const path = require('path');
const fs = require('fs-extra');
const crypto = require('crypto');

class RewindDatabase {
    constructor() {
        this.dbPath = null;
        this.imageDir = null;
        this.memories = [];
        this.encryptionKey = null;
        this.algorithm = 'aes-256-gcm';
    }

    async init(userDataPath, machineId) {
        this.dbPath = path.join(userDataPath, 'rewind_db.enc');
        this.imageDir = path.join(userDataPath, 'rewind_images');
        
        await fs.ensureDir(this.imageDir);
        
        // Derive a 32-byte key from machineId
        this.encryptionKey = crypto.createHash('sha256').update(machineId + 'qadri_rewind_salt').digest();

        if (await fs.pathExists(this.dbPath)) {
            try {
                const encryptedData = await fs.readFile(this.dbPath, 'utf8');
                const decryptedStr = this.decrypt(encryptedData);
                const data = JSON.parse(decryptedStr);
                this.memories = data.memories || [];
            } catch (err) {
                console.error('[Rewind DB] Error reading/decrypting memory DB:', err);
                this.memories = [];
            }
        } else {
            this.memories = [];
            await this.save();
        }
    }

    encrypt(text) {
        const iv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv(this.algorithm, this.encryptionKey, iv);
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        const authTag = cipher.getAuthTag().toString('hex');
        return JSON.stringify({ iv: iv.toString('hex'), authTag, encrypted });
    }

    decrypt(encryptedJsonStr) {
        const { iv, authTag, encrypted } = JSON.parse(encryptedJsonStr);
        const decipher = crypto.createDecipheriv(this.algorithm, this.encryptionKey, Buffer.from(iv, 'hex'));
        decipher.setAuthTag(Buffer.from(authTag, 'hex'));
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    }

    async save() {
        if (this.dbPath) {
            const dataStr = JSON.stringify({ memories: this.memories });
            const encryptedData = this.encrypt(dataStr);
            await fs.writeFile(this.dbPath, encryptedData, 'utf8');
        }
    }

    async addMemoryFrame(frameData) {
        const memory = {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            app: frameData.app,
            windowTitle: frameData.windowTitle,
            ocrText: frameData.ocrText,
            semanticSummary: frameData.semanticSummary,
            imageFile: frameData.imageFile, // Filename only
            isPinned: false
        };
        this.memories.push(memory);
        await this.save();
        return memory.id;
    }

    async cleanupOldMemories(days = 7) {
        const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
        let deletedCount = 0;

        for (let i = this.memories.length - 1; i >= 0; i--) {
            const mem = this.memories[i];
            if (!mem.isPinned && new Date(mem.timestamp).getTime() < cutoff) {
                // Delete raw screenshot
                if (mem.imageFile) {
                    const imgPath = path.join(this.imageDir, mem.imageFile);
                    if (await fs.pathExists(imgPath)) await fs.unlink(imgPath);
                }
                mem.imageFile = null; // Remove raw image, keep semantic summary
                deletedCount++;
            }
        }

        if (deletedCount > 0) {
            console.log(`[Rewind DB] Cleaned up ${deletedCount} old images.`);
            await this.save();
        }
    }

    getTimeline() {
        // Return reverse chronological
        return [...this.memories].sort((a, b) => b.id - a.id);
    }
}

module.exports = new RewindDatabase();
