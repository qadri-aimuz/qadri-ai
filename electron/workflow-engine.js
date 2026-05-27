const agentBus = require('./agent-bus');
const memoryService = require('./persistent-memory-service');

class WorkflowEngine {
    constructor() {
        this.activeWorkflows = {};
        agentBus.registerAgent('WorkflowAgent');

        agentBus.on('task:WorkflowAgent', async (task) => {
            if (task.action === 'start') {
                await this.startWorkflow(task.workflowName, task.steps);
            }
        });
    }

    async startWorkflow(name, steps) {
        console.log(`[WorkflowAgent] Starting workflow: ${name}`);
        this.activeWorkflows[name] = { status: 'running', currentStep: 0, steps };
        agentBus.broadcast('workflow:started', { name });

        for (let i = 0; i < steps.length; i++) {
            const step = steps[i];
            console.log(`[WorkflowAgent] Executing step ${i+1}/${steps.length}: ${step.action}`);
            
            this.activeWorkflows[name].currentStep = i;
            agentBus.broadcast('workflow:progress', { name, step: i, total: steps.length, action: step.action });

            try {
                // Execute subtask by dispatching to the appropriate agent
                if (step.agent) {
                    agentBus.sendTask(step.agent, step.payload);
                }
                
                // Mock delay to simulate task execution asynchronously
                await new Promise(r => setTimeout(r, 1500));
            } catch (err) {
                console.error(`[WorkflowAgent] Step failed: ${step.action}`);
                this.activeWorkflows[name].status = 'failed';
                agentBus.broadcast('workflow:failed', { name, error: err.message });
                return;
            }
        }

        console.log(`[WorkflowAgent] Workflow completed: ${name}`);
        this.activeWorkflows[name].status = 'completed';
        agentBus.broadcast('workflow:completed', { name });
        
        // Persist history
        const history = memoryService.retrieve('history') || [];
        history.push({ name, timestamp: new Date().toISOString(), status: 'completed' });
        memoryService.save('history', history);
    }
    
    getActiveWorkflows() {
        return this.activeWorkflows;
    }
}

const workflowEngine = new WorkflowEngine();
module.exports = workflowEngine;
