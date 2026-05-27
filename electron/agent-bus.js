const EventEmitter = require('events');

class AgentBus extends EventEmitter {
    constructor() {
        super();
        this.agents = new Set();
        this.taskQueue = [];
    }

    registerAgent(name) {
        this.agents.add(name);
        console.log(`[AgentBus] Agent Registered: ${name}`);
    }

    broadcast(event, payload) {
        this.emit(event, payload);
    }

    sendTask(targetAgent, task) {
        if (!this.agents.has(targetAgent)) {
            console.warn(`[AgentBus] Warning: Target agent ${targetAgent} not registered.`);
        }
        this.emit(`task:${targetAgent}`, task);
    }

    getActiveAgents() {
        return Array.from(this.agents);
    }
}

const globalAgentBus = new AgentBus();
module.exports = globalAgentBus;
