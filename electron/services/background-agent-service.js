const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const path = require('path');
const crypto = require('crypto');

class BackgroundAgentService {
  constructor() {
    this.tasks = new Map();
    this.queue = [];
    this.maxConcurrent = 3;
    this.runningCount = 0;
  }

  // Submit a new background task
  submitTask(name, payload, scriptPath = null) {
    const taskId = crypto.randomUUID();
    const task = {
      id: taskId,
      name,
      payload,
      status: 'pending',
      scriptPath: scriptPath || path.join(__dirname, 'default-worker.js'),
      createdAt: Date.now(),
      result: null,
      error: null
    };

    this.tasks.set(taskId, task);
    this.queue.push(taskId);
    this.processQueue();

    return taskId;
  }

  processQueue() {
    if (this.queue.length === 0 || this.runningCount >= this.maxConcurrent) return;

    const taskId = this.queue.shift();
    const task = this.tasks.get(taskId);
    if (!task) return;

    this.runningCount++;
    task.status = 'running';
    task.startedAt = Date.now();

    try {
      const worker = new Worker(task.scriptPath, {
        workerData: { taskId, name: task.name, payload: task.payload }
      });

      worker.on('message', (message) => {
        if (message.type === 'progress') {
          task.progress = message.data;
        } else if (message.type === 'done') {
          task.status = 'completed';
          task.result = message.data;
          task.finishedAt = Date.now();
        }
      });

      worker.on('error', (error) => {
        task.status = 'failed';
        task.error = error.message;
        task.finishedAt = Date.now();
      });

      worker.on('exit', (code) => {
        if (code !== 0 && task.status !== 'failed') {
          task.status = 'failed';
          task.error = `Worker stopped with exit code ${code}`;
          task.finishedAt = Date.now();
        }
        this.runningCount--;
        this.processQueue(); // Process next task
      });
    } catch (error) {
      task.status = 'failed';
      task.error = error.message;
      this.runningCount--;
      this.processQueue();
    }
  }

  getTaskStatus(taskId) {
    return this.tasks.get(taskId) || null;
  }

  getAllTasks() {
    return Array.from(this.tasks.values());
  }
}

module.exports = new BackgroundAgentService();
