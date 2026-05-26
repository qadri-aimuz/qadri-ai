const agentBus = require('./agent-bus');

class SelfHealingEngine {
    constructor() {
        this.heartbeats = {};
        this.thresholdMs = 15000; // 15 seconds

        agentBus.registerAgent('SecurityAgent');

        // Watchdog Loop
        setInterval(() => {
            this.checkHealth();
        }, 5000);
    }

    ping(serviceName) {
        this.heartbeats[serviceName] = Date.now();
    }

    checkHealth() {
        const now = Date.now();
        for (const [service, lastPing] of Object.entries(this.heartbeats)) {
            if (now - lastPing > this.thresholdMs) {
                console.warn(`[SelfHealingEngine] WARNING: ${service} heartbeat timeout detected.`);
                this.recoverService(service);
            }
        }
    }

    recoverService(serviceName) {
        agentBus.broadcast('system:recovery_started', { service: serviceName });
        console.log(`[SelfHealingEngine] Attempting recovery of ${serviceName}...`);
        
        if (serviceName === 'RendererUI') {
            console.log('[SelfHealingEngine] Restarting Sentinel overlay services...');
            // In a real implementation, we would reload the electron window
        } else if (serviceName === 'BrowserAgent') {
            console.log('[SelfHealingEngine] Recovering autonomous session...');
            // Re-initialize puppeteer/browser connection
        }

        // Reset heartbeat so we don't spam
        this.heartbeats[serviceName] = Date.now() + 30000; // Give it 30s to recover
        
        agentBus.broadcast('system:recovery_completed', { service: serviceName });
    }
}

const selfHealingEngine = new SelfHealingEngine();
module.exports = selfHealingEngine;
