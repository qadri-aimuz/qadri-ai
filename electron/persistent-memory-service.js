const fs = require('fs');
const path = require('path');
const os = require('os');
const agentBus = require('./agent-bus');

class PersistentMemoryService {
    constructor() {
        this.memoryDir = path.join(os.homedir(), 'Documents', 'Qadri Data', '.qadri', 'memory');
        this.memoryFile = path.join(this.memoryDir, 'sentinel-memory.json');
        
        // Ensure directory exists
        if (!fs.existsSync(this.memoryDir)) {
            fs.mkdirSync(this.memoryDir, { recursive: true });
        }

        this.memory = this.loadMemory();
        agentBus.registerAgent('MemoryAgent');

        agentBus.on('task:MemoryAgent', (task) => {
            if (task.action === 'save') {
                this.save(task.key, task.value);
            } else if (task.action === 'retrieve') {
                const data = this.retrieve(task.key);
                agentBus.broadcast('memory:retrieved', { key: task.key, data });
            }
        });
    }

    loadMemory() {
        if (fs.existsSync(this.memoryFile)) {
            try {
                const data = fs.readFileSync(this.memoryFile, 'utf8');
                return JSON.parse(data);
            } catch (err) {
                console.error('[MemoryAgent] Failed to load memory. Creating new.', err);
                return { preferences: {}, history: [], workflows: {} };
            }
        }
        return { preferences: {}, history: [], workflows: {} };
    }

    saveMemory() {
        try {
            fs.writeFileSync(this.memoryFile, JSON.stringify(this.memory, null, 2));
        } catch (err) {
            console.error('[MemoryAgent] Failed to save memory.', err);
        }
    }

    save(key, value) {
        this.memory[key] = value;
        this.saveMemory();
        console.log(`[MemoryAgent] Saved key: ${key}`);
    }

    retrieve(key) {
        return this.memory[key] || null;
    }

    search(query) {
        // Very basic semantic search mock
        const results = [];
        for (const [key, value] of Object.entries(this.memory)) {
            if (JSON.stringify(value).toLowerCase().includes(query.toLowerCase())) {
                results.push({ key, value });
            }
        }
        return results;
    }
}

const memoryService = new PersistentMemoryService();
module.exports = memoryService;
