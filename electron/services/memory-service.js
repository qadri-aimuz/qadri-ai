const path = require('path');
const fs = require('fs-extra');

class MemoryService {
  constructor() {
    this.dbPath = null;
    this.memories = [];
  }

  async init(dbPath) {
    this.dbPath = dbPath;
    await fs.ensureDir(path.dirname(dbPath));
    if (await fs.pathExists(dbPath)) {
      try {
        const data = await fs.readJson(dbPath);
        this.memories = data.memories || [];
      } catch (err) {
        console.error('Error reading memory DB:', err);
        this.memories = [];
      }
    } else {
      this.memories = [];
      await this.save();
    }
  }

  async save() {
    if (this.dbPath) {
      await fs.writeJson(this.dbPath, { memories: this.memories }, { spaces: 2 });
    }
  }

  async addMemory(content, category = 'general') {
    const memory = {
      id: Date.now(),
      content,
      category,
      timestamp: new Date().toISOString()
    };
    this.memories.push(memory);
    await this.save();
    return memory.id;
  }

  async getMemories(category = null) {
    if (category) {
      return this.memories.filter(m => m.category === category).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }
    return [...this.memories].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }
}

module.exports = new MemoryService();
