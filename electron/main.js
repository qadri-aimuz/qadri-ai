const { app, BrowserWindow, ipcMain, powerSaveBlocker, nativeImage, desktopCapturer, globalShortcut } = require('electron');
const { autoUpdater } = require('electron-updater');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { exec } = require('child_process');
const { dialog, shell } = require('electron');
const mime = require('mime-types');
const si = require('systeminformation');
const screenshot = require('screenshot-desktop');
const axios = require('axios');
const { clipboard, Notification } = require('electron');
const http = require('http');
require('dotenv').config();
const crypto = require('crypto');
const bootstrapHelpers = require('./main/bootstrap/qadri-bootstrap');
const systemControlService = require('./services/system-control-service');
const memoryService = require('./services/memory-service');
const backgroundAgentService = require('./services/background-agent-service');
const ComputerUseAgent = require('./services/computer-use-agent');
let computerUseAgent = null;

const rewindDb = require('./services/rewind/database');
const rewindObserver = require('./services/rewind/observer');
const RewindSearchEngine = require('./services/rewind/search-engine');
let rewindSearchEngine = null;
let timelineWindow = null;

const LICENSE_API = process.env.LICENSE_API_URL || 'https://qadriai.com';
const getLicensePath = () => path.join(app.getPath('userData'), 'license.json');

async function getMachineId() {
  try {
    const [cpu, disk] = await Promise.all([si.cpu(), si.diskLayout()]);
    const raw = `${cpu.brand}-${cpu.manufacturer}-${disk[0]?.serialNum || 'nodisk'}`;
    return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 32);
  } catch {
    return crypto.createHash('sha256').update(os.hostname() + os.cpus()[0]?.model).digest('hex').slice(0, 32);
  }
}
const { registerDomainHandlers } = require('./main/ipc');

let wakeWordProcess = null;

// Production Server for YouTube embeds (file:// origin is blocked by YouTube)
let productionServer = null;
let productionPort = 45678;

// Document Parsers
const PDFParse = require('pdf-parse');
const mammoth = require('mammoth');

let currentVertexToken = null;


// NEURAL BROWSER GLOBAL HANDLERS
// Embedded window disabled - Playwright now runs headless:false and shows its own native Chromium window
// app.on('open-qadri-neural-browser', (url) => {
//   createBrowserWindow(url);
// });

// app.on('sync-qadri-neural-browser', (url) => { ... });

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;
let videoWindows = new Set();


// Initialize Google GenAI SDK
const { GoogleGenAI } = require('@google/genai');

let powerSaveId = null;
// Splash screen removed in favor of React-based loading screen



const ensureQadriDirectories = () => bootstrapHelpers.ensureQadriDirectories(app);
const getQadriBootstrapDir = () => bootstrapHelpers.getQadriBootstrapDir(app);
const getQadriMemoryDir = () => bootstrapHelpers.getQadriMemoryDir(app);

// NOTE: Single production server instance — see startProductionServer() below (line ~280)
// This avoids duplicate server conflicts. All windows reuse productionPort.

function createWindow() {
  // Ensure directories exist before UI loads
  ensureQadriDirectories();

  mainWindow = new BrowserWindow({
    width: 600,
    height: 220,
    resizable: false,
    show: false,
    transparent: false, backgroundColor: '#000000', alwaysOnTop: false, frame: false,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#07090c',
      symbolColor: '#ffffff',
      height: 44
    },
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webviewTag: true,
      webSecurity: false, // CRITICAL: Allow YouTube iframe to load in production
      allowRunningInsecureContent: true, // Allow external media content
    },
    autoHideMenuBar: true,
    icon: nativeImage.createFromPath(
      app.isPackaged
        ? path.join(process.resourcesPath, 'public/logo.png')
        : path.join(__dirname, '../public/logo.png')
    )
  });

  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[Renderer] ${message} (${sourceId}:${line})`);
  });

  // ── FULL-SCREEN CINEMATIC SPLASH ──
  const { screen } = require('electron');
  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;

  const splashWin = new BrowserWindow({
    width: sw, height: sh,
    x: 0, y: 0,
    frame: false,
    show: false,
    transparent: false,
    backgroundColor: '#030509',
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
    },
    icon: nativeImage.createFromPath(
      app.isPackaged
        ? path.join(process.resourcesPath, 'public/logo.png')
        : path.join(__dirname, '../public/logo.png')
    )
  });

  const splashPath = app.isPackaged
    ? path.join(process.resourcesPath, 'public/splash.html')
    : path.join(__dirname, '../public/splash.html');

  splashWin.loadFile(splashPath);

  // Show splash once it's fully loaded
  splashWin.once('ready-to-show', () => {
    splashWin.show();
    splashWin.center();
    console.log('[Splash] Cinematic splash screen displayed.');
  });

  // Fallback: force-show splash after 1s if ready-to-show is slow
  setTimeout(() => {
    if (splashWin && !splashWin.isDestroyed() && !splashWin.isVisible()) {
      splashWin.show();
      splashWin.center();
      console.log('[Splash] Fallback show triggered.');
    }
  }, 1000);

  // After 8 seconds: close splash, then ensure main window is shown
  setTimeout(() => {
    if (splashWin && !splashWin.isDestroyed()) {
      splashWin.close();
      console.log('[Splash] Splash closed after 8s.');
    }
    // Fallback: if license-passed IPC was never called, show main window anyway
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        console.log('[Main] Fallback: showing main window after splash.');
        mainWindow.show();
        mainWindow.focus();
      }
    }, 500);
  }, 8000);

  // Main window loads in background — license-passed IPC will show it
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    // PRODUCTION: Serve via local HTTP server (also used when running unpackaged via npm start)
    startProductionServer().then(port => {
      mainWindow.loadURL(`http://localhost:${port}/index.html`);
    }).catch(err => {
      console.error('Failed to start production server:', err);
      // The dist folder is bundled inside app.asar. So __dirname + '../dist' is always correct!
      const fallbackPath = path.join(__dirname, '../dist/index.html');
      mainWindow.loadFile(fallbackPath);
    });
  }

  return mainWindow;
}

function createVideoWindow(videoId) {
  let videoWin = new BrowserWindow({
    width: 800,
    height: 500,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: false,
    },
    icon: nativeImage.createFromPath(
      app.isPackaged
        ? path.join(process.resourcesPath, 'public/logo.png')
        : path.join(__dirname, '../public/logo.png')
    )
  });

  videoWindows.add(videoWin);

  const urlParam = `?videoId=${videoId}&mode=player`;
  
  if (process.env.NODE_ENV === 'development') {
    videoWin.loadURL(`http://localhost:5173${urlParam}`);
  } else {
    // Reuse already-running production server (started in createWindow)
    videoWin.loadURL(`http://localhost:${productionPort}/index.html${urlParam}`);
  }

  videoWin.on('closed', () => {
    videoWindows.delete(videoWin);
  });

  return videoWin;
}

function createBrowserWindow(url = '') {
  let browserWin = new BrowserWindow({
    width: 900,
    height: 600,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webviewTag: true,
      webSecurity: false,
    },
    show: false,
    icon: nativeImage.createFromPath(
      app.isPackaged
        ? path.join(process.resourcesPath, 'public/logo.png')
        : path.join(__dirname, '../public/logo.png')
    )
  });

  browserWin.center();

  browserWin.once('ready-to-show', () => {
    console.log('[Main] Neural Browser Window Ready-to-show');
    browserWin.show();
    browserWin.focus();
  });

  // Fallback show if ready-to-show is too slow
  setTimeout(() => {
    if (browserWin && !browserWin.isVisible()) {
        console.log('[Main] Neural Browser Fallback Show');
        browserWin.show();
    }
  }, 3000);

  const urlParam = `#mode=browser${url ? `&url=${encodeURIComponent(url)}` : ''}`;
  
  if (process.env.NODE_ENV === 'development') {
    browserWin.loadURL(`http://localhost:5173/${urlParam}`);
  } else {
    // Reuse already-running production server (started in createWindow)
    browserWin.loadURL(`http://localhost:${productionPort}/index.html${urlParam}`);
  }

  return browserWin;
}

// Production HTTP Server - serves dist folder on localhost
function startProductionServer() {
  return new Promise((resolve, reject) => {
    const distPath = path.join(__dirname, '../dist');

    productionServer = http.createServer((req, res) => {
      let filePath = path.join(distPath, req.url === '/' ? 'index.html' : req.url);

      // Security: prevent directory traversal
      if (!filePath.startsWith(distPath)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }

      const extname = path.extname(filePath).toLowerCase();
      const mimeTypes = {
        '.html': 'text/html',
        '.js': 'application/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.wav': 'audio/wav',
        '.mp3': 'audio/mpeg',
        '.mp4': 'video/mp4',
        '.woff': 'font/woff',
        '.woff2': 'font/woff2',
        '.ttf': 'font/ttf',
        '.ico': 'image/x-icon'
      };

      const contentType = mimeTypes[extname] || 'application/octet-stream';

      fs.readFile(filePath, (error, content) => {
        if (error) {
          if (error.code === 'ENOENT') {
            // SPA fallback - serve index.html for any unknown route
            fs.readFile(path.join(distPath, 'index.html'), (err, indexContent) => {
              if (err) {
                res.writeHead(500);
                res.end('Server Error');
              } else {
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(indexContent, 'utf-8');
              }
            });
          } else {
            res.writeHead(500);
            res.end(`Server Error: ${error.code}`);
          }
        } else {
          res.writeHead(200, { 'Content-Type': contentType });
          res.end(content, 'utf-8');
        }
      });
    });

    const tryListen = (port) => {
      productionServer.listen(port, '127.0.0.1', () => {
        productionPort = port;
        console.log(`Production server running at http://localhost:${productionPort}`);
        resolve(productionPort);
      });
    };

    productionServer.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        // Create a new server instance — can't re-listen on same instance after EADDRINUSE
        productionServer = http.createServer(productionServer._events.request);
        productionServer.on('error', (e) => reject(e));
        tryListen(productionPort + 1);
      } else {
        reject(err);
      }
    });

    tryListen(productionPort);
  });
}


function setupPermissions(session) {
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    const allowedPermissions = ['media', 'camera', 'microphone', 'display-capture'];
    if (allowedPermissions.includes(permission)) {
      callback(true);
    } else {
      callback(false);
    }
  });

  session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
    desktopCapturer.getSources({ types: ['screen'] }).then((sources) => {
      callback({ video: sources[0], audio: 'loopback' });
    }).catch(err => {
      console.error('Error getting screen sources', err);
      callback();
    });
  });
}

// Utility Paths
const getMemoryPath = () => path.join(app.getPath('userData'), 'memories.json');
const getUserProfilePath = () => path.join(app.getPath('userData'), 'user_profile.json');
const getDashboardSettingsPath = () => path.join(app.getPath('userData'), 'dashboard_settings.json');
const getFolderConfigPath = () => path.join(app.getPath('userData'), 'imported_folders.json');
const getVaultPath = () => path.join(app.getPath('documents'), 'Qadri_Vault');
const getHistoryPath = () => path.join(app.getPath('userData'), 'history.json');
const getHistorySettingsPath = () => path.join(app.getPath('userData'), 'history_settings.json');
const getContactsPath = () => path.join(app.getPath('userData'), 'contacts.json');
const getNotesPath = () => path.join(app.getPath('userData'), 'notes.json');
const getTasksPath = () => path.join(app.getPath('userData'), 'tasks.json');
const getSecretKeyPath = () => path.join(app.getPath('userData'), 'secret_key.json');
const getGroqKeyPath = () => path.join(app.getPath('userData'), 'groq_key.json');
const getOpenAIKeyPath = () => path.join(app.getPath('userData'), 'openai_key.json');
const getOpenRouterKeyPath = () => path.join(app.getPath('userData'), 'openrouter_key.json');
const getKimiKeyPath = () => path.join(app.getPath('userData'), 'kimi_key.json');
const getThinkingSettingsPath = () => path.join(app.getPath('userData'), 'thinking_settings.json');
const getGeminiPreferencePath = () => path.join(app.getPath('userData'), 'gemini_preference.json');
const getVoiceAssistantModePath = () => path.join(app.getPath('userData'), 'voice_assistant_mode.json');
const getVoiceProviderPath = () => path.join(app.getPath('userData'), 'voice_provider_preference.json');
const getChatsPath = () => path.join(app.getPath('userData'), 'chats.json');
const getCustomModelsPath = () => path.join(app.getPath('userData'), 'custom_models.json');
const getSubAgentConfigPath = () => path.join(app.getPath('userData'), 'sub_agent_config.json');




// --- IPC Handlers Registration ---
function registerHandlers() {
  registerDomainHandlers();

  // System Control Handlers
  ipcMain.handle('open-app', async (event, appName) => await systemControlService.openApp(appName));
  ipcMain.handle('close-app', async (event, processName) => await systemControlService.closeApp(processName));
  ipcMain.handle('get-running-apps', async () => await systemControlService.getRunningApps());
  ipcMain.handle('get-system-health', async () => await systemControlService.getSystemHealth());

  // Memory Service Handlers
  ipcMain.handle('add-agent-memory', async (event, { content, category }) => await memoryService.addMemory(content, category));
  ipcMain.handle('get-agent-memories', async (event, category) => await memoryService.getMemories(category));

  // Background Agent Handlers
  ipcMain.handle('submit-background-task', (event, { name, payload }) => backgroundAgentService.submitTask(name, payload));
  ipcMain.handle('get-task-status', (event, taskId) => backgroundAgentService.getTaskStatus(taskId));
  ipcMain.handle('get-all-tasks', () => backgroundAgentService.getAllTasks());

  // Computer Use Agent Handlers
  ipcMain.handle('start-computer-use', async (event, goal) => {
      if (computerUseAgent) computerUseAgent.start(goal);
      return true;
  });
  ipcMain.handle('stop-computer-use', async () => {
      if (computerUseAgent) computerUseAgent.stop();
      return true;
  });

  // Rewind Engine Handlers
  ipcMain.handle('get-timeline-memories', async () => {
      const memories = rewindDb.getTimeline();
      return memories.map(m => ({
          ...m,
          imagePath: m.imageFile ? path.join(rewindDb.imageDir, m.imageFile).replace(/\\/g, '/') : null
      }));
  });

  ipcMain.handle('toggle-memory-recording', async (event, start) => {
      if (start) rewindObserver.start();
      else rewindObserver.pause();
      return true;
  });

  ipcMain.handle('semantic-search-memory', async (event, query) => {
      if (rewindSearchEngine) {
          const match = await rewindSearchEngine.searchMemory(query);
          if (match && !match.error) {
              match.imagePath = match.imageFile ? path.join(rewindDb.imageDir, match.imageFile).replace(/\\/g, '/') : null;
          }
          return match;
      }
      return { error: 'Search engine not ready.' };
  });

  ipcMain.handle('reopen-memory-context', async (event, memory) => {
      // Very basic attempt: if OCR text has a URL or path, try opening it
      const text = memory.ocrText || '';
      const urlMatch = text.match(/https?:\/\/[^\s]+/);
      if (urlMatch) {
          shell.openExternal(urlMatch[0]);
      }
      return true;
  });

  ipcMain.handle('open-external-link', async (event, url) => {
    return shell.openExternal(url);
  });

  ipcMain.handle('get-stored-user', async () => {
    return null;
  });

  ipcMain.handle('play-youtube-video', async (event, videoId) => {
    createVideoWindow(videoId);
    return true;
  });

  ipcMain.handle('close-window', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) win.close();
    return true;
  });

  ipcMain.handle('minimize-window', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) win.minimize();
    return true;
  });

  ipcMain.handle('license-passed', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      win.setResizable(true);
      win.setMinimumSize(1000, 700);
      win.center();
      win.show();
      win.focus();
      win.maximize();
    }
    return true;
  });

  ipcMain.handle('open-neural-browser', async (event, url) => {
    createBrowserWindow(url);
    return true;
  });
  // Listener removed from here to global scope

  // Custom Models Persistence
  ipcMain.handle('get-custom-models', async () => {
    try {
      const p = getCustomModelsPath();
      if (fs.existsSync(p)) {
        const saved = JSON.parse(fs.readFileSync(p, 'utf8'));
        return {
          openRouter: Array.isArray(saved?.openRouter) ? saved.openRouter : [],
          gemini: Array.isArray(saved?.gemini) ? saved.gemini : [],
          openai: Array.isArray(saved?.openai) ? saved.openai : []
        };
      }
      return { openRouter: [], gemini: [], openai: [] };
    } catch (e) { return { openRouter: [], gemini: [], openai: [] }; }
  });

  ipcMain.handle('save-custom-models', async (event, models) => {
    try {
      const normalizedModels = {
        openRouter: Array.isArray(models?.openRouter) ? models.openRouter : [],
        gemini: Array.isArray(models?.gemini) ? models.gemini : [],
        openai: Array.isArray(models?.openai) ? models.openai : []
      };
      fs.writeFileSync(getCustomModelsPath(), JSON.stringify(normalizedModels, null, 2));
      return true;
    } catch (e) { return false; }
  });

  // Memory Management
  ipcMain.handle('load-memories', async () => {
    try {
      const p = getMemoryPath();
      if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
      return [];
    } catch (e) { return []; }
  });

  ipcMain.handle('save-memories', async (event, memories) => {
    try {
      fs.writeFileSync(getMemoryPath(), JSON.stringify(memories, null, 2));
      return true;
    } catch (e) { return false; }
  });

  // ---------------------------------------
  //  BOOTSTRAP FILE SYSTEM (.qadri/)
  // ---------------------------------------

  // Read all bootstrap files for system prompt injection
  ipcMain.handle('read-bootstrap-files', async () => {
    try {
      const dir = getQadriBootstrapDir();

      const readSafely = (filePath) => {
        try {
          if (fs.existsSync(filePath)) return fs.readFileSync(filePath, 'utf8');
          return '';
        } catch { return ''; }
      };

      // Read SYSTEM.md, USER.md and MEMORY.md
      const system = readSafely(path.join(dir, 'SYSTEM.md'));
      const user = readSafely(path.join(dir, 'USER.md'));
      const memory = readSafely(path.join(dir, 'MEMORY.md'));

      return {
        system,
        user,
        memory
      };
    } catch (e) {
      console.error('[Bootstrap] Failed to read bootstrap files:', e);
      return { system: '', user: '', memory: '' };
    }
  });

  // Write/update a bootstrap file (USER.md or MEMORY.md)
  ipcMain.handle('write-bootstrap-file', async (event, { filename, content }) => {
    try {
      // Security: only allow specific files
      const allowedFiles = ['USER.md', 'MEMORY.md'];
      if (!allowedFiles.includes(filename)) {
        console.warn(`[Bootstrap] Blocked write to unauthorized file: ${filename}`);
        return false;
      }

      const dir = getQadriBootstrapDir();
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      fs.writeFileSync(path.join(dir, filename), content, 'utf8');
      console.log(`[Bootstrap] Updated ${filename}`);
      return true;
    } catch (e) {
      console.error(`[Bootstrap] Failed to write ${filename}:`, e);
      return false;
    }
  });



  // User Profile
  ipcMain.handle('load-user-profile', async () => {
    try {
      const p = getUserProfilePath();
      if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
      return {};
    } catch (e) { return {}; }
  });

  ipcMain.handle('save-user-profile', async (event, profile) => {
    try {
      fs.writeFileSync(getUserProfilePath(), JSON.stringify(profile, null, 2));
      return true;
    } catch (e) { return false; }
  });

  // Dashboard Settings & Fetching
  ipcMain.handle('load-dashboard-settings', async () => {
    try {
      const p = getDashboardSettingsPath();
      if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
      return { interests: ['Tech', 'Pakistan', 'Global Economy'], refreshInterval: 3600 };
    } catch (e) { return { interests: [], refreshInterval: 3600 }; }
  });

  ipcMain.handle('save-dashboard-settings', async (event, settings) => {
    try {
      fs.writeFileSync(getDashboardSettingsPath(), JSON.stringify(settings, null, 2));
      return true;
    } catch (e) { return false; }
  });

  ipcMain.handle('fetch-dashboard-data', async (event, { location, interests }) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error('API Key missing');
      const ai = new GoogleGenAI({ apiKey });
      const prompt = `Search for top 5 news headlines for: ${interests.join(', ')} in ${location || 'Pakistan'}. Also get weather. Respond in ROMAN URDU and return JSON: {"headlines": [...], "weather": {"today": "...", "tomorrow": "...", "dayAfter": "..."}}`;
      const result = await ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { tools: [{ googleSearch: {} }] }
      });
      // @google/genai SDK: result.text (not result.response.text())
      let text = '';
      if (typeof result.text === 'string') {
        text = result.text;
      } else if (result.candidates?.[0]?.content?.parts?.[0]?.text) {
        text = result.candidates[0].content.parts[0].text;
      } else if (result.response && typeof result.response.text === 'function') {
        text = result.response.text();
      }
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      return jsonMatch ? JSON.parse(jsonMatch[0]) : { headlines: ['Error parsing data'], weather: { today: 'N/A' } };
    } catch (error) {
      return { headlines: [`Error: ${error.message}`], weather: { today: "Error ??" } };
    }
  });

  // History
  ipcMain.handle('load-history', async () => {
    try {
      const p = getHistoryPath();
      if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
      return [];
    } catch (e) { return []; }
  });

  ipcMain.handle('save-history', async (event, history) => {
    try {
      fs.writeFileSync(getHistoryPath(), JSON.stringify(history, null, 2));
      return true;
    } catch (e) { return false; }
  });

  ipcMain.handle('clear-history', async () => {
    try {
      const p = getHistoryPath();
      if (fs.existsSync(p)) fs.unlinkSync(p);
      return true;
    } catch (e) { return false; }
  });

  // Multi-Chat Management
  ipcMain.handle('load-chats', async () => {
    try {
      const p = getChatsPath();
      if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));

      // Fallback to legacy history if exists
      const h = getHistoryPath();
      if (fs.existsSync(h)) {
        const legacyMessages = JSON.parse(fs.readFileSync(h, 'utf8'));
        if (legacyMessages && legacyMessages.length > 0) {
          const firstChat = {
            id: 'legacy-history',
            title: 'Legacy Chat',
            messages: legacyMessages,
            timestamp: Date.now(),
            model: 'Claude 4.5 Sonnet'
          };
          return [firstChat];
        }
      }
      return [];
    } catch (e) { return []; }
  });

  ipcMain.handle('save-chats', async (event, chats) => {
    try {
      fs.writeFileSync(getChatsPath(), JSON.stringify(chats, null, 2));
      return true;
    } catch (e) { return false; }
  });

  ipcMain.handle('load-history-settings', async () => {
    try {
      const p = getHistorySettingsPath();
      if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
      return { maxContextMessages: 20, storeHistory: true };
    } catch (e) { return { maxContextMessages: 20, storeHistory: true }; }
  });

  ipcMain.handle('save-history-settings', async (event, settings) => {
    try {
      fs.writeFileSync(getHistorySettingsPath(), JSON.stringify(settings, null, 2));
      return true;
    } catch (e) { return false; }
  });

  // Contacts
  ipcMain.handle('load-contacts', async () => {
    try {
      const p = getContactsPath();
      if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
      return [];
    } catch (e) { return []; }
  });

  ipcMain.handle('save-contacts', async (event, contacts) => {
    try {
      fs.writeFileSync(getContactsPath(), JSON.stringify(contacts, null, 2));
      return true;
    } catch (e) { return false; }
  });

  // Notes
  ipcMain.handle('load-notes', async () => {
    try {
      const p = getNotesPath();
      if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
      return [];
    } catch (e) { return []; }
  });

  ipcMain.handle('save-notes', async (event, notes) => {
    try {
      fs.writeFileSync(getNotesPath(), JSON.stringify(notes, null, 2));
      return true;
    } catch (e) { return false; }
  });

  // Tasks
  ipcMain.handle('load-tasks', async () => {
    try {
      const p = getTasksPath();
      if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
      return [];
    } catch (e) { return []; }
  });

  ipcMain.handle('save-tasks', async (event, tasks) => {
    try {
      fs.writeFileSync(getTasksPath(), JSON.stringify(tasks, null, 2));
      return true;
    } catch (e) { return false; }
  });

  const getMarkdownNotesPath = () => path.join(app.getPath('documents'), 'Qadri Data');

  ipcMain.handle('get-documents-path', async () => {
    return app.getPath('documents');
  });

  ipcMain.handle('get-notes-path', async () => {
    const notesPath = path.join(app.getPath('documents'), 'Qadri Data');
    if (!fs.existsSync(notesPath)) {
      fs.mkdirSync(notesPath, { recursive: true });
    }
    return notesPath;
  });

  // Alias for AI/Frontend clarity - Returns Qadri Data folder path
  ipcMain.handle('get-qadri-data-path', async () => {
    const qadriDataPath = path.join(app.getPath('documents'), 'Qadri Data');
    if (!fs.existsSync(qadriDataPath)) {
      fs.mkdirSync(qadriDataPath, { recursive: true });
    }
    return qadriDataPath;
  });


  // Vault & Folders
  ipcMain.handle('initialize-vault', async () => {
    console.log('IPC: Initializing Vault...');
    try {
      // 1. Initialize Markdown Notes Folder (ONLY)
      const notesDir = getMarkdownNotesPath();
      if (!fs.existsSync(notesDir)) {
        fs.mkdirSync(notesDir, { recursive: true });
        console.log('IPC: Re-created Qadri Data:', notesDir);
      }

      return { notesDir };
    } catch (e) {
      console.error('IPC: Vault Initialization Failed:', e);
      // Fallback: Return at least the notes path
      try { return { notesDir: getMarkdownNotesPath() }; } catch (err) { return null; }
    }
  });

  ipcMain.handle('open-vault-folder', async (event, folderName) => {
    try {
      const folderPath = path.join(getVaultPath(), folderName);
      const open = (await import('open')).default;
      await open(folderPath);
      return true;
    } catch (e) { return false; }
  });

  ipcMain.handle('load-imported-folders', async () => {
    try {
      const p = getFolderConfigPath();
      if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
      return [];
    } catch (e) { return []; }
  });

  ipcMain.handle('save-imported-folders', async (event, folders) => {
    try {
      fs.writeFileSync(getFolderConfigPath(), JSON.stringify(folders, null, 2));
      return true;
    } catch (e) { return false; }
  });

  ipcMain.handle('pick-folder', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Select Folder to Import'
    });
    if (canceled || filePaths.length === 0) return null;
    return {
      name: path.basename(filePaths[0]),
      path: filePaths[0]
    };
  });

  // System Tools
  ipcMain.handle('get-gemini-token', async () => {
    try {
      if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
      const p = getSecretKeyPath();
      if (fs.existsSync(p)) {
        const data = JSON.parse(fs.readFileSync(p, 'utf8'));
        return data.apiKey || data.geminiKey || null;
      }
      return null;
    } catch (e) {
      return process.env.GEMINI_API_KEY || null;
    }
  });

  ipcMain.handle('register-vertex-token', async (event, token) => {
    currentVertexToken = token;
    return true;
  });

  ipcMain.handle('save-gemini-token', async (event, apiKey) => {
    try {
      const p = getSecretKeyPath();
      let data = {};
      if (fs.existsSync(p)) {
        try { data = JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { }
      }
      data.apiKey = apiKey; // Keep for backward compatibility
      data.geminiKey = apiKey;
      data.updatedAt = Date.now();
      fs.writeFileSync(p, JSON.stringify(data, null, 2));
      return true;
    } catch (e) {
      return false;
    }
  });

  ipcMain.handle('get-groq-token', async () => {
    try {
      if (process.env.GROQ_API_KEY) return process.env.GROQ_API_KEY;
      const p = getGroqKeyPath();
      if (fs.existsSync(p)) {
        const data = JSON.parse(fs.readFileSync(p, 'utf8'));
        return data.apiKey || null;
      }
      return null;
    } catch (e) { return process.env.GROQ_API_KEY || null; }
  });

  ipcMain.handle('save-groq-token', async (event, apiKey) => {
    try {
      fs.writeFileSync(getGroqKeyPath(), JSON.stringify({ apiKey, updatedAt: Date.now() }, null, 2));
      return true;
    } catch (e) { return false; }
  });

  ipcMain.handle('get-openai-token', async () => {
    try {
      if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY;
      const p = getOpenAIKeyPath();
      if (fs.existsSync(p)) {
        const data = JSON.parse(fs.readFileSync(p, 'utf8'));
        return data.apiKey || null;
      }
      return null;
    } catch (e) { return process.env.OPENAI_API_KEY || null; }
  });

  ipcMain.handle('save-openai-token', async (event, apiKey) => {
    try {
      fs.writeFileSync(getOpenAIKeyPath(), JSON.stringify({ apiKey, updatedAt: Date.now() }, null, 2));
      return true;
    } catch (e) { return false; }
  });

  ipcMain.handle('get-openrouter-token', async () => {
    try {
      if (process.env.OPENROUTER_API_KEY) return process.env.OPENROUTER_API_KEY;
      const p = getOpenRouterKeyPath();
      if (fs.existsSync(p)) {
        const data = JSON.parse(fs.readFileSync(p, 'utf8'));
        return data.apiKey || null;
      }
      return null;
    } catch (e) { return process.env.OPENROUTER_API_KEY || null; }
  });

  ipcMain.handle('save-openrouter-token', async (event, apiKey) => {
    try {
      fs.writeFileSync(getOpenRouterKeyPath(), JSON.stringify({ apiKey, updatedAt: Date.now() }, null, 2));
      return true;
    } catch (e) { return false; }
  });

  // Sub-Agent Model Config (OpenRouter model selection for background workers)
  ipcMain.handle('get-sub-agent-config', async () => {
    try {
      const p = getSubAgentConfigPath();
      if (fs.existsSync(p)) {
        const data = JSON.parse(fs.readFileSync(p, 'utf8'));
        return {
          enabled: Boolean(data.enabled),
          modelId: data.modelId || '',
        };
      }
      return { enabled: false, modelId: '' };
    } catch (e) { return { enabled: false, modelId: '' }; }
  });

  ipcMain.handle('save-sub-agent-config', async (event, config) => {
    try {
      const normalized = {
        enabled: Boolean(config?.enabled),
        modelId: String(config?.modelId || '').trim(),
        updatedAt: Date.now(),
      };
      fs.writeFileSync(getSubAgentConfigPath(), JSON.stringify(normalized, null, 2));
      return true;
    } catch (e) { return false; }
  });

  ipcMain.handle('get-kimi-token', async () => {
    try {
      if (process.env.KIMI_API_KEY) return process.env.KIMI_API_KEY;
      const p = getKimiKeyPath();
      if (fs.existsSync(p)) {
        const data = JSON.parse(fs.readFileSync(p, 'utf8'));
        return data.apiKey || null;
      }
      return null;
    } catch (e) { return process.env.KIMI_API_KEY || null; }
  });

  ipcMain.handle('save-kimi-token', async (event, apiKey) => {
    try {
      fs.writeFileSync(getKimiKeyPath(), JSON.stringify({ apiKey, updatedAt: Date.now() }, null, 2));
      return true;
    } catch (e) { return false; }
  });

  // Thinking Mode Settings
  ipcMain.handle('get-thinking-enabled', async () => {
    try {
      const p = getThinkingSettingsPath();
      if (fs.existsSync(p)) {
        const data = JSON.parse(fs.readFileSync(p, 'utf8'));
        return data.enabled !== undefined ? data.enabled : true; // Default to true
      }
      return true; // Default to true if no settings file
    } catch (e) { return true; }
  });

  ipcMain.handle('save-thinking-enabled', async (event, enabled) => {
    try {
      fs.writeFileSync(getThinkingSettingsPath(), JSON.stringify({ enabled, updatedAt: Date.now() }, null, 2));
      return true;
    } catch (e) { return false; }
  });

  // Gemini API Preference (Direct vs OpenRouter)
  ipcMain.handle('get-prefer-direct-gemini', async () => {
    try {
      const p = getGeminiPreferencePath();
      if (fs.existsSync(p)) {
        const data = JSON.parse(fs.readFileSync(p, 'utf8'));
        return data.preferDirect !== undefined ? data.preferDirect : false; // Default to OpenRouter
      }
      return false;
    } catch (e) { return false; }
  });

  ipcMain.handle('save-prefer-direct-gemini', async (event, preferDirect) => {
    try {
      fs.writeFileSync(getGeminiPreferencePath(), JSON.stringify({ preferDirect, updatedAt: Date.now() }, null, 2));
      return true;
    } catch (e) { return false; }
  });

  ipcMain.handle('get-voice-assistant-mode', async () => {
    try {
      const p = getVoiceAssistantModePath();
      if (fs.existsSync(p)) {
        const data = JSON.parse(fs.readFileSync(p, 'utf8'));
        return data.mode === 'direct' ? 'direct' : 'agentic';
      }
      return 'agentic';
    } catch (e) { return 'agentic'; }
  });

  ipcMain.handle('save-voice-assistant-mode', async (_event, mode) => {
    try {
      const normalizedMode = mode === 'direct' ? 'direct' : 'agentic';
      fs.writeFileSync(getVoiceAssistantModePath(), JSON.stringify({ mode: normalizedMode, updatedAt: Date.now() }, null, 2));
      return true;
    } catch (e) { return false; }
  });

  ipcMain.handle('get-voice-provider', async () => {
    // Force OpenAI as the only provider temporarily per user request
    return 'openai';
  });

  ipcMain.handle('save-voice-provider', async (event, provider) => {
    try {
      const normalizedProvider = provider === 'openai' ? 'openai' : 'gemini';
      fs.writeFileSync(getVoiceProviderPath(), JSON.stringify({ provider: normalizedProvider, updatedAt: Date.now() }, null, 2));
      return true;
    } catch (e) { return false; }
  });

  // ─── LICENSE HANDLERS ───────────────────────────────────────────────────────
  ipcMain.handle('license-get-machine-id', async () => {
    return getMachineId();
  });

  ipcMain.handle('license-get-stored', async () => {
    return { license_key: 'BYPASS_KEY' };
  });

  ipcMain.handle('license-save', async (_, data) => {
    return true;
  });

  ipcMain.handle('license-verify', async (_, { license_key, machine_id }) => {
    return { valid: true };
  });

  ipcMain.handle('license-activate', async (_, { license_key, machine_id }) => {
    return { success: true };
  });
  // ────────────────────────────────────────────────────────────────────────────

  ipcMain.handle('get-app-version', async () => {
    return app.getVersion();
  });
}



function startWakeWordDetector(mainWindow) {
  if (wakeWordProcess) return;

  console.log('Starting Wake Word Detector (Python)...');
  wakeWordProcess = spawn('python', [path.join(__dirname, '../wake_word_bg.py')]);

  wakeWordProcess.stdout.on('data', (data) => {
    try {
      const output = data.toString().trim();
      const lines = output.split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        const result = JSON.parse(line);
        // Forward all events (WAKE_WORD, INFO, ERROR) to the UI
        mainWindow.webContents.send('wake-word-detected', result);
      }
    } catch (e) {
      console.error('Error parsing wake word output:', e);
    }
  });

  wakeWordProcess.stderr.on('data', (data) => {
    console.error(`Wake Word Error: ${data}`);
  });

  wakeWordProcess.on('close', (code) => {
    console.log(`Wake word process exited with code ${code}`);
    wakeWordProcess = null;
  });
}



app.on('window-all-closed', () => {
  // Cleanup production server
  if (productionServer) {
    productionServer.close();
    productionServer = null;
  }

  if (wakeWordProcess) {
    wakeWordProcess.kill();
    wakeWordProcess = null;
  }

  if (process.platform !== 'darwin') app.quit();
});

// SINGLE INSTANCE LOCK
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // Someone tried to run a second instance, we should focus our window.
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  // Create myWindow, load the rest of the app, etc...
  app.whenReady().then(async () => {
    const memoryDbPath = path.join(app.getPath('userData'), 'qadri_memory.json');
    await memoryService.init(memoryDbPath);

    // Initialize Computer Use Agent
    computerUseAgent = new ComputerUseAgent(app);
    
    // Initialize Rewind Engine
    try {
        const machineId = await getMachineId();
        await rewindDb.init(app.getPath('userData'), machineId);
        await rewindObserver.init();
        rewindObserver.start();
        rewindSearchEngine = new RewindSearchEngine(app);
        console.log('[Rewind Engine] Fully Initialized and Recording.');
    } catch (e) {
        console.error('[Rewind Engine] Initialization failed:', e);
    }

    globalShortcut.register('Escape', () => {
        if (computerUseAgent && computerUseAgent.isRunning) {
            computerUseAgent.stop();
            console.log('[Computer Use Agent] Killswitch triggered via Escape key.');
        }
    });

    globalShortcut.register('CommandOrControl+Shift+T', () => {
        if (timelineWindow) {
            timelineWindow.focus();
            return;
        }
        timelineWindow = new BrowserWindow({
            width: 1200, height: 800,
            titleBarStyle: 'hidden',
            titleBarOverlay: { color: '#0a0a0f', symbolColor: '#00f0ff' },
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false,
                webSecurity: false // allow file:// for images
            }
        });
        timelineWindow.loadFile(path.join(__dirname, '../public/timeline.html'));
        timelineWindow.on('closed', () => { timelineWindow = null; });
    });

    app.on('trigger-computer-use', (goal) => {
        if (computerUseAgent) computerUseAgent.start(goal);
    });

    // ── BOOT SOUND ── Play initialize.wav at the very start
    try {
      const soundPath = app.isPackaged
        ? path.join(process.resourcesPath, 'public/audio/initialize.wav')
        : path.join(__dirname, '../public/audio/initialize.wav');
      exec(`powershell -c "(New-Object Media.SoundPlayer '${soundPath.replace(/\\/g, '\\\\')}').Play()"`, () => {});
    } catch (e) { console.log('Boot sound failed:', e.message); }

    const { session } = require('electron');
    setupPermissions(session);

    // ===== CRITICAL: Configure CSP to allow YouTube embeds in production =====
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; " +
            "connect-src * ws: wss: data: blob:; " +
            "media-src * data: blob:; " +
            "frame-src *; " +
            "img-src * data: blob:; " +
            "script-src * 'unsafe-inline' 'unsafe-eval'; " +
            "style-src * 'unsafe-inline'; " +
            "font-src * data:;"
          ]
        }
      });
    });

    // PRODUCTION: Remove CSP completely for local file protocol
    session.defaultSession.webRequest.onHeadersReceived({ urls: ['file://*'] }, (details, callback) => {
      const responseHeaders = { ...details.responseHeaders };
      delete responseHeaders['Content-Security-Policy'];
      delete responseHeaders['content-security-policy'];
      callback({ responseHeaders });
    });

    session.defaultSession.webRequest.onBeforeSendHeaders(
      { urls: ['wss://*.aiplatform.googleapis.com/*', 'wss://generativelanguage.googleapis.com/*'] },
      (details, callback) => {
        if (currentVertexToken) {
          details.requestHeaders['Authorization'] = `Bearer ${currentVertexToken}`;
          console.log('[Vertex AI] Injected Authorization Bearer token into WebSocket request.');
        }
        callback({ requestHeaders: details.requestHeaders });
      }
    );

    registerHandlers();

    const createdWindow = createWindow();

    // Connect wake word detector to main window
    if (createdWindow) startWakeWordDetector(createdWindow);

    // === Auto Updater Setup ===
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on('checking-for-update', () => {
      console.log('Checking for updates...');
    });
    autoUpdater.on('update-available', (info) => {
      console.log('Update available:', info.version);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.executeJavaScript(`
            if (!document.getElementById('qadri-updater-ui')) {
                const updaterUI = document.createElement('div');
                updaterUI.id = 'qadri-updater-ui';
                updaterUI.style.cssText = "position:fixed;bottom:20px;right:20px;background:rgba(0,0,0,0.85);color:#fff;padding:15px;border-radius:12px;font-family:sans-serif;z-index:999999;box-shadow:0 8px 32px rgba(0,0,0,0.5);border:1px solid rgba(255,255,255,0.1);backdrop-filter:blur(10px);width:320px;transition:all 0.3s ease;";
                updaterUI.innerHTML = '<div style="display:flex;align-items:center;margin-bottom:10px;"><div style="width:10px;height:10px;border-radius:50%;background:#00ffcc;margin-right:10px;box-shadow:0 0 10px #00ffcc;"></div><b style="font-size:14px;letter-spacing:0.5px;">Qadri AI Update</b></div><span id="qadri-updater-text" style="font-size:13px;color:#aaa;">Update ${info.version} available! Downloading...</span><div style="margin-top:12px;background:rgba(255,255,255,0.1);border-radius:6px;height:6px;overflow:hidden;"><div id="qadri-updater-bar" style="width:0%;height:100%;background:linear-gradient(90deg, #00ffcc, #0088ff);transition:width 0.3s ease;"></div></div>';
                document.body.appendChild(updaterUI);
            } else {
                document.getElementById('qadri-updater-text').innerText = 'Update ${info.version} available! Downloading...';
            }
        `).catch(e => console.error(e));
      }
    });
    autoUpdater.on('update-not-available', (info) => {
      console.log('Update not available.');
    });
    autoUpdater.on('error', (err) => {
      console.error('Error in auto-updater:', err);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.executeJavaScript(`
            if (document.getElementById('qadri-updater-text')) {
                document.getElementById('qadri-updater-text').innerText = 'Update failed. Retrying later...';
                document.getElementById('qadri-updater-bar').style.background = '#ff4444';
                setTimeout(() => { if (document.getElementById('qadri-updater-ui')) document.getElementById('qadri-updater-ui').style.opacity = '0'; }, 3000);
                setTimeout(() => { if (document.getElementById('qadri-updater-ui')) document.getElementById('qadri-updater-ui').remove(); }, 3500);
            }
        `).catch(e => console.error(e));
      }
    });
    autoUpdater.on('download-progress', (progressObj) => {
      let percent = Math.round(progressObj.percent);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.executeJavaScript(`
            if (document.getElementById('qadri-updater-bar')) {
                document.getElementById('qadri-updater-bar').style.width = '${percent}%';
                document.getElementById('qadri-updater-text').innerText = 'Downloading Update... ${percent}%';
            }
        `).catch(e => console.error(e));
      }
    });
    autoUpdater.on('update-downloaded', (info) => {
      console.log('Update downloaded:', info.version);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.executeJavaScript(`
            if (document.getElementById('qadri-updater-text')) {
                document.getElementById('qadri-updater-text').innerText = 'Update v${info.version} Ready!';
                document.getElementById('qadri-updater-bar').style.background = '#00ffcc';
                document.getElementById('qadri-updater-bar').style.width = '100%';
                
                if (!document.getElementById('qadri-updater-btn')) {
                    const btn = document.createElement('button');
                    btn.id = 'qadri-updater-btn';
                    btn.innerText = 'Restart App';
                    btn.style.cssText = 'margin-top:12px;width:100%;padding:8px;background:#00ffcc;color:#000;border:none;border-radius:6px;font-weight:bold;cursor:pointer;font-family:sans-serif;font-size:13px;transition:0.2s;';
                    btn.onmouseover = () => btn.style.background = '#00e6b8';
                    btn.onmouseout = () => btn.style.background = '#00ffcc';
                    btn.onclick = () => window.electronAPI.invoke('install-update');
                    document.getElementById('qadri-updater-ui').appendChild(btn);
                }
            }
        `).catch(e => console.error(e));
      }
    });

    try {
      autoUpdater.checkForUpdatesAndNotify();
    } catch (err) {
      console.error('Failed to check for updates:', err);
    }

    ipcMain.handle('install-update', () => {
      if (wakeWordProcess) {
        try { wakeWordProcess.kill(); } catch(e) {}
      }
      autoUpdater.quitAndInstall(false, true);
    });
    // ==========================

    // ── 🔥 Jarvis Overlay — Global keyboard shortcut (Ctrl+Shift+J) ─────────
    try {
      const { getJarvisWindow } = require('./main/ipc/jarvis-handlers');
      globalShortcut.register('CommandOrControl+Shift+J', () => {
        try {
          const jWin = getJarvisWindow();
          if (jWin.isVisible()) jWin.hide();
          else { jWin.show(); jWin.focus(); }
        } catch (err) {
          console.error('[Jarvis] Shortcut toggle error:', err.message);
        }
      });
      console.log('[Qadri AI] Jarvis shortcut registered: Ctrl+Shift+J');
    } catch (err) {
      console.warn('[Jarvis] Could not register global shortcut:', err.message);
    }

    console.log(`[Qadri AI] v${require('../package.json').version} — AI Coding Engineer + Jarvis Mode ACTIVE`);

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        const win = createWindow();
        startWakeWordDetector(win);
      }
    });

    app.on('will-quit', () => globalShortcut.unregisterAll());
  });
}

// Export getProductionPort so Jarvis and sub-windows can get the dynamic port
module.exports = {
  getProductionPort: () => productionPort
};
