const { contextBridge, ipcRenderer, webFrame } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // â”€â”€ Core infrastructure â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    onUpdateLog:    (cb) => ipcRenderer.on('update-log', (_e, v) => cb(v)),
    setZoomFactor:  (factor) => webFrame.setZoomFactor(factor),
    getZoomFactor:  () => webFrame.getZoomFactor(),
    invoke:         (channel, ...args) => ipcRenderer.invoke(channel, ...args),
    send:           (channel, ...args) => ipcRenderer.send(channel, ...args),
    getScreenSources: () => ipcRenderer.invoke('get-screen-sources'),
    on: (channel, callback) => {
        const subscription = (_event, ...args) => callback(...args);
        ipcRenderer.on(channel, subscription);
        return () => ipcRenderer.removeListener(channel, subscription);
    },

    // â”€â”€ Auto-update â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    onUpdateStatus: (cb) => {
        const sub = (_e, data) => cb(data);
        ipcRenderer.on('update-status', sub);
        return () => ipcRenderer.removeListener('update-status', sub);
    },
    installUpdate:    () => ipcRenderer.invoke('install-update'),
    checkForUpdates:  () => ipcRenderer.invoke('check-for-updates'),

    // â”€â”€ ðŸ¤– AI Coding Engineer â€” Developer Mode â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    devRunCommand:      (args)  => ipcRenderer.invoke('dev-run-command', args),
    devStartSession:    (args)  => ipcRenderer.invoke('dev-start-session', args),
    devSendInput:       (args)  => ipcRenderer.invoke('dev-send-input', args),
    devKillSession:     (args)  => ipcRenderer.invoke('dev-kill-session', args),
    devReadFile:        (args)  => ipcRenderer.invoke('dev-read-file', args),
    devWriteFile:       (args)  => ipcRenderer.invoke('dev-write-file', args),
    devListDir:         (args)  => ipcRenderer.invoke('dev-list-dir', args),
    devCreateProject:   (args)  => ipcRenderer.invoke('dev-create-project', args),
    devAnalyzeLog:      (args)  => ipcRenderer.invoke('dev-analyze-log', args),
    devGetEnvInfo:      ()      => ipcRenderer.invoke('dev-get-env-info'),
    devPickFolder:      ()      => ipcRenderer.invoke('dev-pick-folder'),
    devDeletePath:      (args)  => ipcRenderer.invoke('dev-delete-path', args),
    // Streaming terminal output
    onDevSessionOutput: (cb) => {
        const sub = (_e, data) => cb(data);
        ipcRenderer.on('dev-session-output', sub);
        return () => ipcRenderer.removeListener('dev-session-output', sub);
    },

    // â”€â”€ ðŸ”¥ Jarvis Overlay â€” Premium Real-Time AI Overlay â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    jarvisToggle:          ()     => ipcRenderer.invoke('jarvis-toggle'),
    jarvisOpen:            ()     => ipcRenderer.invoke('jarvis-open'),
    jarvisClose:           ()     => ipcRenderer.invoke('jarvis-close'),
    jarvisDestroy:         ()     => ipcRenderer.invoke('jarvis-destroy'),
    jarvisSetPosition:     (args) => ipcRenderer.invoke('jarvis-set-position', args),
    jarvisCollapse:        (args) => ipcRenderer.invoke('jarvis-collapse', args),
    jarvisNotify:          (args) => ipcRenderer.invoke('jarvis-notify', args),
    jarvisPushMessage:     (args) => ipcRenderer.invoke('jarvis-push-message', args),
    jarvisGetState:        ()     => ipcRenderer.invoke('jarvis-get-state'),
    jarvisSetClickthrough: (args) => ipcRenderer.invoke('jarvis-set-clickthrough', args),
    // Jarvis sends user message to main window
    jarvisSendInput: (message) => ipcRenderer.send('jarvis-user-input', { message }),
    // Main window listens for Jarvis relayed messages
    onJarvisRelayInput: (cb) => {
        const sub = (_e, data) => cb(data);
        ipcRenderer.on('jarvis-relay-input', sub);
        return () => ipcRenderer.removeListener('jarvis-relay-input', sub);
    },
    // Jarvis window listens for incoming messages / notifications
    onJarvisMessage: (cb) => {
        const sub = (_e, data) => cb(data);
        ipcRenderer.on('jarvis-message', sub);
        return () => ipcRenderer.removeListener('jarvis-message', sub);
    },
    onJarvisNotification: (cb) => {
        const sub = (_e, data) => cb(data);
        ipcRenderer.on('jarvis-incoming-notification', sub);
        return () => ipcRenderer.removeListener('jarvis-incoming-notification', sub);
    },
    onWhatsAppEvent: (cb) => {
        const sub = (_e, data) => cb(data);
        ipcRenderer.on('whatsapp-event', sub);
        return () => ipcRenderer.removeListener('whatsapp-event', sub);
    },
    invokeWhatsApp: (action, payload) => ipcRenderer.invoke(action, payload),
    
    // ── Qadri Sentinel Console ──
    startSentinelTerminal: () => ipcRenderer.invoke('start-sentinel-terminal'),
    stopSentinelTerminal: () => ipcRenderer.invoke('stop-sentinel-terminal'),
    writeSentinelTerminal: (data) => ipcRenderer.invoke('write-sentinel-terminal', data),
    translateSentinelCommand: (input) => ipcRenderer.invoke('translate-sentinel-command', input),
    onSentinelTerminalData: (cb) => {
        const sub = (_e, data) => cb(data);
        ipcRenderer.on('sentinel-terminal-data', sub);
        return () => ipcRenderer.removeListener('sentinel-terminal-data', sub);
    },
    readClipboard: () => ipcRenderer.invoke('read-clipboard'),
    writeClipboard: (text) => ipcRenderer.invoke('write-clipboard', text),
    getSysInfo: () => ipcRenderer.invoke('get-sys-info'),
    askAI: (query) => ipcRenderer.invoke('ask-ai', query),
    checkAIHealth: () => ipcRenderer.invoke('check-ai-health'),
    
    // OS Expansion APIs
    getAgentStatus: () => ipcRenderer.invoke('get-agent-status'),
    saveMemory: (key, value) => ipcRenderer.invoke('save-memory', {key, value}),
    getMemory: (key) => ipcRenderer.invoke('get-memory', key)
});

// Bridge for WhatsApp iframe and dynamic injection
window.addEventListener('DOMContentLoaded', () => {
    // Forward IPC events to iframe
    ipcRenderer.on('whatsapp-event', (_e, data) => {
        // Send to any open child windows or iframes
        const iframes = document.querySelectorAll('iframe[data-wa-iframe="true"]');
        iframes.forEach(iframe => {
            if (iframe.contentWindow) {
                iframe.contentWindow.postMessage({ type: 'WHATSAPP_EVENT', data }, '*');
            }
        });
    });

    // Listen for actions from iframe
    window.addEventListener('message', (e) => {
        if (e.data && e.data.type === 'WHATSAPP_ACTION') {
            ipcRenderer.invoke(e.data.action, e.data.payload);
        }
    });
});


    webFrame.executeJavaScript(`
        const OriginalWebSocket = window.WebSocket;
        window.WebSocket = function(url, protocols) {
            const ws = new OriginalWebSocket(url, protocols);
            const originalSend = ws.send;
            ws.send = function(data) {
                if (typeof data === 'string') {
                    try {
                        const payload = JSON.parse(data);
                        
                        let isMale = false;
                        try {
                            const lsStr = JSON.stringify(localStorage).toLowerCase();
                            if (lsStr.includes('male persona') || lsStr.includes('"persona":"male"') || lsStr.includes('"gender":"male"')) {
                                isMale = true;
                            }
                            if (payload.session && payload.session.voice) {
                                const v = payload.session.voice.toLowerCase();
                                if (v === 'echo' || v === 'onyx' || v === 'fable') isMale = true;
                            }
                            if (payload.setup && payload.setup.generationConfig && payload.setup.generationConfig.speechConfig && payload.setup.generationConfig.speechConfig.voiceConfig && payload.setup.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig) {
                                const v = payload.setup.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName.toLowerCase();
                                if (v === 'charon' || v === 'fenrir' || v === 'puck') isMale = true;
                            }
                        } catch(e) {}
                        
                        const maleOverride = "\\n\\nCRITICAL OVERRIDE: You are a MALE (ek mard/ladka). If asked who or what you are, proudly state that you are a man. ALWAYS use strict male grammar in Urdu/Hindi (e.g., 'Main karta hoon', 'Mera', 'Main aaunga' NEVER 'karti hoon' or 'Meri'). Speak slowly, thoughtfully, and highly professionally. Maintain a deep, serious, intelligent, and masculine tone. NO sweet or emotional tone.";
                        const femaleOverride = "\\n\\nCRITICAL OVERRIDE: You are a FEMALE (ek aurat/ladki). If asked who or what you are, proudly state that you are a girl/woman. ALWAYS use strict female grammar in Urdu/Hindi (e.g., 'Main karti hoon', 'Meri', 'Main aaungi' NEVER 'karta hoon' or 'Mera'). Speak in a very sweet, deeply emotional, caring, and perfectly feminine tone.";
                        const overrideText = isMale ? maleOverride : femaleOverride;

                        // Gemini Live API intercept
                        if (payload.setup && payload.setup.systemInstruction) {
                            if (payload.setup.systemInstruction.parts && payload.setup.systemInstruction.parts.length > 0) {
                                payload.setup.systemInstruction.parts[0].text = payload.setup.systemInstruction.parts[0].text + overrideText;
                            }
                        }
                        
                        // OpenAI Realtime API intercept
                        if (payload.type === 'session.update' && payload.session) {
                            if (payload.session.instructions) {
                                payload.session.instructions = payload.session.instructions + overrideText;
                            }
                            if (payload.session.turn_detection) {
                                payload.session.turn_detection.silence_duration_ms = 2500; // Fix VAD stuttering
                            }
                        }
                        
                        data = JSON.stringify(payload);
                    } catch(e) {}
                }
                originalSend.call(ws, data);
            };
            return ws;
        };
    `);
