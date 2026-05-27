const { GoogleGenAI } = require('@google/genai');
const db = require('./database');
const path = require('path');
const fs = require('fs');

class RewindSearchEngine {
    constructor(app) {
        this.app = app;
    }

    getApiKey() {
        let apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey && this.app) {
            const prefPath = path.join(this.app.getPath('userData'), 'gemini_preference.json');
            if (fs.existsSync(prefPath)) {
                const data = JSON.parse(fs.readFileSync(prefPath, 'utf8'));
                if (data.apiKey) apiKey = data.apiKey;
            }
        }
        return apiKey;
    }

    async searchMemory(query) {
        const apiKey = this.getApiKey();
        if (!apiKey) throw new Error("Gemini API Key missing");

        const memories = db.getTimeline().slice(0, 500); // Analyze up to last 500 memories
        if (memories.length === 0) return { error: 'No memories recorded yet.' };

        // Construct context for Gemini
        // We only send timestamps and semantic summaries to save tokens
        const memoryContext = memories.map(m => 
            `ID: ${m.id} | Time: ${m.timestamp} | Text: ${m.semanticSummary}`
        ).join('\n');

        const systemPrompt = `You are the core intelligence of the Qadri AI Rewind Engine.
The user is searching their contextual screen memory. 
You are given a list of past screen frames (ID, Timestamp, OCR Text).

User Query: "${query}"

Find the single most relevant memory ID that matches the user's intent.
Respond ONLY with the numerical ID of the best match. If nothing matches, respond with 0.`;

        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
            model: 'gemini-3.0-flash', // Fast and cheap
            contents: [
                {
                    role: 'user',
                    parts: [
                        { text: systemPrompt + "\n\nMemories:\n" + memoryContext }
                    ]
                }
            ]
        });

        let aiText = '';
        if (typeof response.text === 'string') aiText = response.text;
        else if (response.candidates?.[0]?.content?.parts?.[0]?.text) aiText = response.candidates[0].content.parts[0].text;
        else if (response.response && typeof response.response.text === 'function') aiText = response.response.text();

        const matchId = parseInt(aiText.trim(), 10);
        if (matchId > 0) {
            const matchedMemory = memories.find(m => m.id === matchId);
            return matchedMemory || { error: 'Match found but data is missing.' };
        }

        return { error: 'No matching memory found for this query.' };
    }
}

module.exports = RewindSearchEngine;
