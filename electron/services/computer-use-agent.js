const screenshot = require('screenshot-desktop');
const robot = require('@jitsi/robotjs');
const { GoogleGenAI } = require('@google/genai');
const path = require('path');
const fs = require('fs');

class ComputerUseAgent {
    constructor(app) {
        this.app = app;
        this.isRunning = false;
        this.currentGoal = null;
    }

    getApiKey() {
        let apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            const prefPath = path.join(this.app.getPath('userData'), 'gemini_preference.json');
            if (fs.existsSync(prefPath)) {
                const data = JSON.parse(fs.readFileSync(prefPath, 'utf8'));
                if (data.apiKey) apiKey = data.apiKey;
            }
        }
        return apiKey;
    }

    start(goal) {
        if (this.isRunning) return;
        console.log('[Computer Use Agent] Starting automation for goal:', goal);
        this.isRunning = true;
        this.currentGoal = goal;
        this.loop();
    }

    stop() {
        if (!this.isRunning) return;
        console.log('[Computer Use Agent] Emergency Stop Activated.');
        this.isRunning = false;
        this.currentGoal = null;
    }

    async loop() {
        while (this.isRunning) {
            try {
                await this.step();
                // Wait 2.5 seconds for UI to settle
                await new Promise(resolve => setTimeout(resolve, 2500));
            } catch (err) {
                console.error('[Computer Use Agent] Error in step:', err);
                this.stop();
            }
        }
    }

    async step() {
        if (!this.isRunning) return;

        const apiKey = this.getApiKey();
        if (!apiKey) throw new Error("Gemini API Key missing");

        const ai = new GoogleGenAI({ apiKey });

        // Get Screen Dimensions
        const screenSize = robot.getScreenSize();
        
        // Take Screenshot
        const imgBuffer = await screenshot({ format: 'png' });
        
        const systemPrompt = `You are an autonomous Desktop Assistant operating a Windows PC.
Your overall goal is: "${this.currentGoal}"

You are given a screenshot of the current screen.
You must analyze the screen and decide the single NEXT action to take to progress toward the goal.
Screen size is ${screenSize.width}x${screenSize.height}.

When you need to click something, you must find its location on the screen and provide normalized coordinates [y, x].
y and x MUST be integers between 0 and 1000, where [0,0] is top-left and [1000,1000] is bottom-right.
Example: the exact center is [500, 500].

Respond ONLY with one of the following exact formats. Do not add any conversational text.

To click:
ACTION: CLICK
COORD: [y, x]

To type text (make sure you clicked the input field first in a previous step):
ACTION: TYPE
TEXT: your text here

To press a special key (e.g., enter, escape, tab):
ACTION: PRESS
KEY: enter

To finish the task if the goal is fully met:
ACTION: DONE`;

        const response = await ai.models.generateContent({
            model: 'gemini-1.5-pro', // Pro is better at spatial reasoning
            contents: [
                {
                    role: 'user',
                    parts: [
                        { text: "What is the next action?" },
                        { inlineData: { data: imgBuffer.toString('base64'), mimeType: 'image/png' } }
                    ]
                }
            ],
            config: { systemInstruction: { parts: [{ text: systemPrompt }] } }
        });

        let aiText = '';
        if (typeof response.text === 'string') aiText = response.text;
        else if (response.candidates?.[0]?.content?.parts?.[0]?.text) aiText = response.candidates[0].content.parts[0].text;
        else if (response.response && typeof response.response.text === 'function') aiText = response.response.text();

        console.log('[Computer Use Agent] Decision:\n' + aiText);

        if (aiText.includes('ACTION: DONE')) {
            console.log('[Computer Use Agent] Task Completed!');
            this.stop();
            return;
        }

        if (aiText.includes('ACTION: CLICK')) {
            const coordMatch = aiText.match(/COORD:\s*\[(\d+),\s*(\d+)\]/);
            if (coordMatch) {
                const ny = parseInt(coordMatch[1], 10);
                const nx = parseInt(coordMatch[2], 10);
                
                // Map [0,1000] to actual screen pixels
                const pixelY = Math.round((ny / 1000) * screenSize.height);
                const pixelX = Math.round((nx / 1000) * screenSize.width);

                console.log(`[Computer Use Agent] Clicking at ${pixelX}, ${pixelY}`);
                robot.moveMouseSmooth(pixelX, pixelY);
                robot.mouseClick();
            }
        } else if (aiText.includes('ACTION: TYPE')) {
            const textMatch = aiText.match(/TEXT:\s*(.+)/);
            if (textMatch) {
                console.log(`[Computer Use Agent] Typing: ${textMatch[1]}`);
                robot.typeString(textMatch[1]);
            }
        } else if (aiText.includes('ACTION: PRESS')) {
            const keyMatch = aiText.match(/KEY:\s*(.+)/);
            if (keyMatch) {
                console.log(`[Computer Use Agent] Pressing: ${keyMatch[1].trim()}`);
                try {
                    robot.keyTap(keyMatch[1].trim().toLowerCase());
                } catch(e) {
                    console.error('[Computer Use Agent] Invalid key:', keyMatch[1]);
                }
            }
        }
    }
}

module.exports = ComputerUseAgent;
