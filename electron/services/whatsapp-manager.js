const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');
const axios = require('axios');
const FormData = require('form-data');

const BOT_SIGNATURE = '[QADRI_AI_BOT]';

class WhatsAppManager {
    constructor(mainWindow, app) {
        this.mainWindow = mainWindow;
        this.app = app;

        this.client = null;
        this.isReady = false;
        this.isInitializing = false;
        this.destroying = false;
        this.manualLogout = false;

        this.status = 'disconnected';
        this.statusReason = null;
        this.qrCode = null;
        this.lastQr = null;

        this.sessionPath = path.join(app.getPath('userData'), '.wwebjs_auth');
        this.webCachePath = path.join(app.getPath('userData'), '.wwebjs_cache');

        this.processedMessageIds = new Set();
        this.initTimeout = null;
        this.reconnectTimer = null;
        this.reconnectAttempts = 0;

        this.qrError = null;
        this.qrGeneratedAt = null;

        this.maxReconnectAttempts = 8;
        this.maxInitTimeMs = 60000;
    }

    updateMainWindow(mainWindow) {
        this.mainWindow = mainWindow;
    }

    getState() {
        return {
            status: this.status,
            reason: this.statusReason,
            isReady: this.isReady,
            isInitializing: this.isInitializing,
            qrCode: this.qrCode,
            qrError: this.qrError,
            qrGeneratedAt: this.qrGeneratedAt,
            reconnectAttempts: this.reconnectAttempts
        };
    }

    setStatus(status, extra = {}) {
        this.status = status;
        this.statusReason = extra.reason || null;
        this.sendToFrontend('status', { status, ...extra });
    }

    ensureRuntimeDirectories() {
        for (const dir of [this.sessionPath, this.webCachePath]) {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        }
    }

    getSessionProfilePath() {
        return path.join(this.sessionPath, 'session-qadri-desktop-client');
    }

    clearSessionProfileLocks() {
        const profilePath = this.getSessionProfilePath();
        const lockFiles = [
            'SingletonLock',
            'SingletonCookie',
            'SingletonSocket',
            'DevToolsActivePort'
        ];

        for (const fileName of lockFiles) {
            const filePath = path.join(profilePath, fileName);
            try {
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            } catch (error) {
                console.warn('[WhatsApp] Failed removing lock file:', filePath, error.message || error);
            }
        }
    }

    killSessionBrowserProcesses() {
        if (process.platform !== 'win32') return;

        const psCommand = [
            "$ErrorActionPreference='SilentlyContinue'",
            "Get-CimInstance Win32_Process",
            "| Where-Object {",
            "    ($_.Name -in @('chrome.exe','msedge.exe')) -and",
            "    ($_.CommandLine -like '*session-qadri-desktop-client*')",
            "}",
            "| ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"
        ].join(' ');

        try {
            spawnSync(
                'powershell.exe',
                ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', psCommand],
                { windowsHide: true, timeout: 12000, encoding: 'utf8' }
            );
        } catch (error) {
            console.warn('[WhatsApp] Failed to terminate stale browser process:', error.message || error);
        }
    }

    async recoverFromProfileLock(errorMessage = '') {
        console.warn('[WhatsApp] Recovering from browser profile lock...', errorMessage);
        await this.destroyClient({ preserveSession: true });
        this.killSessionBrowserProcesses();
        this.clearSessionProfileLocks();
        await new Promise(resolve => setTimeout(resolve, 1200));
    }

    clearInitTimeout() {
        if (this.initTimeout) {
            clearTimeout(this.initTimeout);
            this.initTimeout = null;
        }
    }

    clearReconnectTimer() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
    }

    clearAllTimers() {
        this.clearInitTimeout();
        this.clearReconnectTimer();
    }

    startInitTimeout() {
        this.clearInitTimeout();
        this.initTimeout = setTimeout(async () => {
            console.error('[WhatsApp] Initialization timeout. Rebuilding client.');
            this.isInitializing = false;
            this.isReady = false;
            this.qrCode = null;
            this.lastQr = null;
            this.setStatus('disconnected', { reason: 'init-timeout' });

            await this.destroyClient({ preserveSession: true });
            this.scheduleReconnect('init-timeout');
        }, this.maxInitTimeMs);
    }

    scheduleReconnect(reason = 'unknown') {
        if (this.manualLogout) return;
        if (this.reconnectTimer) return;

        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('[WhatsApp] Reconnect limit reached. Waiting for manual restart.');
            this.setStatus('disconnected', { reason: 'reconnect-limit-reached' });
            return;
        }

        this.reconnectAttempts += 1;
        const baseDelay = 2000;
        const delayMs = Math.min(30000, baseDelay * (2 ** (this.reconnectAttempts - 1)));

        this.setStatus('reconnecting', {
            reason,
            attempt: this.reconnectAttempts,
            delayMs
        });

        this.reconnectTimer = setTimeout(async () => {
            this.reconnectTimer = null;
            await this.initialize({ isReconnect: true });
        }, delayMs);
    }

    resolveBrowserExecutable() {
        const candidates = [];

        if (process.env.PUPPETEER_EXECUTABLE_PATH) {
            candidates.push(process.env.PUPPETEER_EXECUTABLE_PATH);
        }

        const browserRoots = [
            process.resourcesPath ? path.join(process.resourcesPath, 'browsers') : null,
            path.join(process.cwd(), 'browsers'),
            path.join(this.app.getPath('userData'), 'browsers')
        ].filter(Boolean);

        for (const root of browserRoots) {
            if (!fs.existsSync(root)) continue;

            candidates.push(path.join(root, 'chromium-1208', 'chrome-win64', 'chrome.exe'));

            try {
                const chromiumDirs = fs.readdirSync(root, { withFileTypes: true })
                    .filter(entry => entry.isDirectory() && entry.name.startsWith('chromium-'))
                    .map(entry => entry.name)
                    .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));

                for (const dirName of chromiumDirs) {
                    candidates.push(path.join(root, dirName, 'chrome-win64', 'chrome.exe'));
                }
            } catch (error) {
                console.warn('[WhatsApp] Failed scanning browser directory:', root, error.message);
            }
        }

        candidates.push('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe');
        candidates.push('C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe');
        candidates.push('C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe');

        for (const candidate of candidates) {
            if (candidate && fs.existsSync(candidate)) {
                console.log('[WhatsApp] Browser executable:', candidate);
                return candidate;
            }
        }

        console.warn('[WhatsApp] No explicit browser executable found. Puppeteer default resolution will be used.');
        return null;
    }

    async destroyClient({ preserveSession = true } = {}) {
        if (!this.client || this.destroying) return;

        this.destroying = true;
        const client = this.client;
        this.client = null;

        try {
            client.removeAllListeners();
        } catch (_error) { }

        try {
            if (!preserveSession && typeof client.logout === 'function') {
                await client.logout();
            }
        } catch (error) {
            console.warn('[WhatsApp] Logout during destroy failed:', error.message || error);
        }

        try {
            await client.destroy();
        } catch (error) {
            console.warn('[WhatsApp] Destroy failed:', error.message || error);
        } finally {
            this.destroying = false;
        }
    }

    async initialize(options = {}) {
        const { isReconnect = false } = options;

        if (this.isInitializing) {
            console.log('[WhatsApp] Initialize skipped (already initializing).');
            return;
        }

        if (this.client && this.isReady) {
            console.log('[WhatsApp] Initialize skipped (already connected).');
            this.setStatus('connected');
            return;
        }

        this.manualLogout = false;
        this.ensureRuntimeDirectories();
        this.clearReconnectTimer();

        if (this.client && !this.isReady) {
            await this.destroyClient({ preserveSession: true });
        }

        this.isInitializing = true;
        this.isReady = false;
        this.qrCode = null;
        this.lastQr = null;
        this.qrError = null;
        this.qrGeneratedAt = null;
        this.setStatus(isReconnect ? 'reconnecting' : 'initializing', {
            attempt: this.reconnectAttempts || 0
        });

        this.startInitTimeout();

        const executablePath = this.resolveBrowserExecutable();
        const puppeteerOptions = {
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu'
            ]
        };

        if (executablePath) {
            puppeteerOptions.executablePath = executablePath;
        }

        this.client = new Client({
            authStrategy: new LocalAuth({
                clientId: 'qadri-desktop-client',
                dataPath: this.sessionPath
            }),
            authTimeoutMs: 120000,
            qrMaxRetries: 3,
            takeoverOnConflict: true,
            takeoverTimeoutMs: 15000,
            webVersionCache: {
                type: 'local',
                path: this.webCachePath
            },
            puppeteer: puppeteerOptions
        });

        this.registerClientEvents(this.client);

        try {
            await this.client.initialize();
        } catch (error) {
            const errorMessage = String(error?.message || error || '');
            console.error('[WhatsApp] Initialize error:', errorMessage);
            this.clearInitTimeout();
            this.isInitializing = false;
            this.isReady = false;

            const isProfileLockError =
                errorMessage.includes('already running for') ||
                errorMessage.includes('SingletonLock') ||
                errorMessage.includes('userDataDir');

            const isBrowserMissing =
                errorMessage.includes('Failed to launch') ||
                errorMessage.includes('Could not find expected browser') ||
                errorMessage.includes('ENOENT') ||
                errorMessage.includes('spawn') ||
                errorMessage.includes('executable') ||
                errorMessage.includes('browserExecutable');

            if (isProfileLockError) {
                this.setStatus('reconnecting', { reason: 'profile-lock' });
                await this.recoverFromProfileLock(errorMessage);
                this.scheduleReconnect('profile-lock');
                return;
            }

            if (isBrowserMissing) {
                console.error('[WhatsApp] Browser executable not found. Install Google Chrome to fix this.');
                this.qrError = 'Browser not found. Please install Google Chrome and restart the app.';
                this.setStatus('disconnected', { reason: 'browser-not-found' });
                this.sendToFrontend('qr-error', {
                    error: this.qrError,
                    code: 'BROWSER_NOT_FOUND',
                    retryable: false
                });
                await this.destroyClient({ preserveSession: true });
                return;
            }

            this.qrError = errorMessage || 'Initialization failed';
            this.setStatus('disconnected', { reason: errorMessage || 'init-error' });
            this.sendToFrontend('qr-error', {
                error: this.qrError,
                code: 'INIT_ERROR',
                retryable: true
            });

            await this.destroyClient({ preserveSession: true });
            this.scheduleReconnect('init-error');
        }
    }

    registerClientEvents(client) {
        client.on('qr', async (qr) => {
            if (this.lastQr === qr) return;
            this.lastQr = qr;
            this.isInitializing = false;
            this.qrError = null;
            this.clearInitTimeout();
            this.setStatus('scan_qr');

            try {
                const url = await qrcode.toDataURL(qr, {
                    errorCorrectionLevel: 'M',
                    type: 'image/png',
                    quality: 0.92,
                    margin: 1
                });
                this.qrCode = url;
                this.qrError = null;
                this.qrGeneratedAt = Date.now();
                this.sendToFrontend('qr-code', { url, generatedAt: this.qrGeneratedAt });
            } catch (error) {
                const errMsg = error.message || String(error);
                console.error('[WhatsApp] QR encode error:', errMsg);
                this.qrCode = null;
                this.qrError = `QR generation failed: ${errMsg}`;
                this.qrGeneratedAt = null;
                this.setStatus('qr_error', { reason: 'qr-encode-failed' });
                this.sendToFrontend('qr-error', {
                    error: this.qrError,
                    code: 'QR_ENCODE_FAILED',
                    retryable: true
                });
            }
        });

        client.on('loading_screen', (percent, message) => {
            this.sendToFrontend('loading', { percent, message });
        });

        client.on('authenticated', () => {
            this.clearInitTimeout();
            this.isInitializing = false;
            this.setStatus('authenticated');
            console.log('[WhatsApp] Authenticated');
        });

        client.on('ready', () => {
            this.clearInitTimeout();
            this.isInitializing = false;
            this.isReady = true;
            this.qrCode = null;
            this.lastQr = null;
            this.qrError = null;
            this.qrGeneratedAt = null;
            this.reconnectAttempts = 0;
            this.setStatus('connected');
            console.log('[WhatsApp] Client ready');
        });

        client.on('remote_session_saved', () => {
            console.log('[WhatsApp] Remote session saved');
        });

        client.on('auth_failure', async (msg) => {
            console.error('[WhatsApp] Auth failure:', msg);
            this.clearInitTimeout();
            this.isInitializing = false;
            this.isReady = false;
            this.qrCode = null;
            this.lastQr = null;
            this.setStatus('auth_failure', { reason: msg });

            await this.destroyClient({ preserveSession: true });
            this.scheduleReconnect('auth_failure');
        });

        client.on('disconnected', async (reason) => {
            console.warn('[WhatsApp] Disconnected:', reason);
            this.clearInitTimeout();
            this.isInitializing = false;
            this.isReady = false;
            this.qrCode = null;
            this.lastQr = null;
            this.setStatus('disconnected', { reason });

            await this.destroyClient({ preserveSession: true });
            this.scheduleReconnect(reason || 'disconnected');
        });

        client.on('message_create', async (msg) => {
            await this.handleCreatedMessage(msg);
        });
    }

    async handleCreatedMessage(msg) {
        if (!msg || !msg.fromMe) return;
        if (msg.to === 'status@broadcast') return;

        const myId = this.client?.info?.wid?._serialized || null;
        if (!myId) return;
        const targetId = msg?.to || msg?.from || '';
        if (!targetId) return;

        if (targetId !== myId) return;

        const messageId = msg?.id?._serialized;
        if (messageId && this.processedMessageIds.has(messageId)) {
            this.processedMessageIds.delete(messageId);
            return;
        }

        let parsedMessage = String(msg.body || '').trim();

        if (parsedMessage.includes(BOT_SIGNATURE)) {
            return;
        }

        if (msg.hasMedia && (msg.type === 'ptt' || msg.type === 'audio')) {
            try {
                console.log('[WhatsApp] Voice message detected');
                const media = await msg.downloadMedia();
                if (media?.data) {
                    const transcription = await this.transcribeAudio(media.data);
                    if (!transcription) return;
                    parsedMessage = transcription;
                }
            } catch (error) {
                console.error('[WhatsApp] Voice handling error:', error.message || error);
                return;
            }
        }

        if (!parsedMessage) return;

        this.sendToFrontend('mobile-message', {
            message: parsedMessage,
            chatId: targetId,
            timestamp: msg.timestamp,
            messageId: messageId || null
        });

        // Trigger AI processing for remote control
        this.processWithAI(parsedMessage, targetId);
    }

    async processWithAI(parsedMessage, chatId) {
        try {
            const { GoogleGenAI } = require('@google/genai');
            const path = require('path');
            const fs = require('fs');

            // Find API Key (env or preferences)
            let apiKey = process.env.GEMINI_API_KEY;
            if (!apiKey) {
                const prefPath = path.join(this.app.getPath('userData'), 'gemini_preference.json');
                if (fs.existsSync(prefPath)) {
                    const data = JSON.parse(fs.readFileSync(prefPath, 'utf8'));
                    if (data.apiKey) apiKey = data.apiKey;
                }
            }

            if (!apiKey) {
                console.warn('[WhatsApp AI] Missing Gemini API Key');
                return;
            }

            const ai = new GoogleGenAI({ apiKey });

            // Read Qadri Core Identity
            const bootstrapDir = path.join(this.app.getPath('documents'), '.qadri');
            const sysPath = path.join(bootstrapDir, 'SYSTEM.md');
            let systemPrompt = "You are Qadri AI, a highly advanced desktop assistant.";
            if (fs.existsSync(sysPath)) systemPrompt = fs.readFileSync(sysPath, 'utf8');

            systemPrompt += "\n\nCRITICAL REMOTE MODE RULES: The user is messaging you remotely via WhatsApp while away from their PC. Keep answers concise (WhatsApp style). You can control their PC using commands! If they ask you to open an app, you MUST include exactly '[OPEN_APP: app_name]' in your reply (e.g., [OPEN_APP: chrome]). If they ask to close an app, include '[CLOSE_APP: app_name]'. If they ask to shutdown the PC, include '[SHUTDOWN]'. If they ask to lock the PC, include '[LOCK]'. ONLY output these exact bracketed commands when taking action.";

            const response = await ai.models.generateContent({
                model: 'gemini-1.5-flash',
                contents: [{ role: 'user', parts: [{ text: parsedMessage }] }],
                config: { systemInstruction: { parts: [{ text: systemPrompt }] } }
            });

            // Handle different SDK response formats
            let aiText = '';
            if (typeof response.text === 'string') aiText = response.text;
            else if (response.candidates?.[0]?.content?.parts?.[0]?.text) aiText = response.candidates[0].content.parts[0].text;
            else if (response.response && typeof response.response.text === 'function') aiText = response.response.text();
            
            if (!aiText) return;

            // Execute System Commands safely using Qadri's systemControlService
            try {
                const systemControlService = require('./system-control-service');
                const { exec } = require('child_process');

                const openMatch = aiText.match(/\[OPEN_APP:\s*(.+?)\]/i);
                if (openMatch) {
                    await systemControlService.openApp(openMatch[1].trim());
                    aiText = aiText.replace(openMatch[0], `(Opening ${openMatch[1].trim()} on your PC...)`);
                }

                const closeMatch = aiText.match(/\[CLOSE_APP:\s*(.+?)\]/i);
                if (closeMatch) {
                    await systemControlService.closeApp(closeMatch[1].trim());
                    aiText = aiText.replace(closeMatch[0], `(Closing ${closeMatch[1].trim()} on your PC...)`);
                }

                if (aiText.includes('[SHUTDOWN]')) {
                    exec('shutdown /s /t 30');
                    aiText = aiText.replace('[SHUTDOWN]', '(PC will shutdown in 30 seconds...)');
                }

                if (aiText.includes('[LOCK]')) {
                    exec('rundll32.exe user32.dll,LockWorkStation');
                    aiText = aiText.replace('[LOCK]', '(PC Locked)');
                }

                const doItMatch = aiText.match(/\[DO_IT_FOR_ME:\s*(.+?)\]/i) || parsedMessage.match(/do it for me:\s*(.+)/i);
                if (doItMatch) {
                    const taskGoal = doItMatch[1].trim();
                    // Trigger the global agent via app event
                    this.app.emit('trigger-computer-use', taskGoal);
                    aiText += `\n*(I have initiated the Automation Agent to: ${taskGoal}. Press ESC on your PC to stop it at any time!)*`;
                }
            } catch (err) {
                console.error('[WhatsApp System Control Error]', err);
            }

            await this.sendReply(chatId, aiText);
        } catch (error) {
            console.error('[WhatsApp AI Error]', error);
        }

    async transcribeAudio(base64Data) {
        try {
            let apiKey = process.env.GROQ_API_KEY;
            const keyPath = path.join(this.app.getPath('userData'), 'groq_key.json');

            if (fs.existsSync(keyPath)) {
                const data = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
                if (data.apiKey) apiKey = data.apiKey;
            }

            if (!apiKey) {
                console.error('[WhatsApp] Groq API key missing for transcription.');
                return null;
            }

            const audioBuffer = Buffer.from(base64Data, 'base64');
            const form = new FormData();
            form.append('file', audioBuffer, {
                filename: 'audio.ogg',
                contentType: 'audio/ogg'
            });
            form.append('model', 'whisper-large-v3');
            form.append('response_format', 'json');

            const response = await axios.post(
                'https://api.groq.com/openai/v1/audio/transcriptions',
                form,
                {
                    headers: {
                        ...form.getHeaders(),
                        Authorization: `Bearer ${apiKey}`
                    },
                    timeout: 45000,
                    maxBodyLength: Infinity
                }
            );

            const text = String(response?.data?.text || '').trim();
            return text || null;
        } catch (error) {
            console.error('[WhatsApp] Transcription error:', error?.response?.data || error.message || error);
            return null;
        }
    }

    async sendReply(chatId, text) {
        if (!this.client || !this.isReady) {
            console.warn('[WhatsApp] Send skipped. Client not ready.');
            return false;
        }

        const targetChatId = String(chatId || '').trim();
        const messageText = String(text || '').trim();
        if (!targetChatId || !messageText) {
            console.warn('[WhatsApp] Send skipped. Invalid chatId or message.');
            return false;
        }

        try {
            const replyText = `${messageText}\n\n_${BOT_SIGNATURE}_`;
            const sentMsg = await this.client.sendMessage(targetChatId, replyText);
            const sentId = sentMsg?.id?._serialized;

            if (sentId) {
                this.processedMessageIds.add(sentId);
                setTimeout(() => this.processedMessageIds.delete(sentId), 120000);
            }

            return true;
        } catch (error) {
            console.error('[WhatsApp] Send error:', error.message || error);
            return false;
        }
    }

    async logout() {
        this.manualLogout = true;
        this.clearAllTimers();
        this.reconnectAttempts = 0;
        this.isReady = false;
        this.isInitializing = false;
        this.qrCode = null;
        this.lastQr = null;

        await this.destroyClient({ preserveSession: false });
        this.setStatus('disconnected', { reason: 'manual-logout' });
    }

    async shutdown() {
        this.manualLogout = true;
        this.clearAllTimers();
        this.isReady = false;
        this.isInitializing = false;
        this.qrCode = null;
        this.lastQr = null;
        await this.destroyClient({ preserveSession: true });
    }

    sendToFrontend(event, data) {
        if (!this.mainWindow || this.mainWindow.isDestroyed()) return;

        try {
            this.mainWindow.webContents.send('whatsapp-event', { event, data });
        } catch (error) {
            console.error('[WhatsApp] Failed to send IPC event:', error.message || error);
        }
    }
}

module.exports = WhatsAppManager;
