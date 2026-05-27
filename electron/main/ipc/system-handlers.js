const { app, BrowserWindow, clipboard, desktopCapturer, dialog, ipcMain, nativeImage, Notification } = require('electron');
const { exec, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const mime = require('mime-types');
const si = require('systeminformation');
const screenshot = require('screenshot-desktop');
const axios = require('axios');
const { GoogleGenAI } = require('@google/genai');
const PDFParse = require('pdf-parse');
const mammoth = require('mammoth');

const { createPaths } = require('../shared/paths');

// Movie player watcher
const MOVIE_REQUEST_FILE = path.join(os.homedir(), 'Documents', 'Qadri Data', '.qadri', 'movie_request.txt');

function initMovieWatcher() {
  const dir = path.dirname(MOVIE_REQUEST_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  if (!fs.existsSync(MOVIE_REQUEST_FILE)) {
    fs.writeFileSync(MOVIE_REQUEST_FILE, '', 'utf8');
  }

  let lastProcessed = '';
  
  fs.watch(dir, (eventType, filename) => {
    if (filename === 'movie_request.txt') {
      try {
        const content = fs.readFileSync(MOVIE_REQUEST_FILE, 'utf8').trim();
        if (content && content !== lastProcessed) {
          lastProcessed = content;
          console.log('[MovieWatcher] Received movie URL:', content);
          
          let videoWin = new BrowserWindow({
            width: 800,
            height: 500,
            frame: false,
            transparent: true,
            backgroundColor: '#000000',
            alwaysOnTop: true,
            webPreferences: {
              nodeIntegration: false,
              contextIsolation: true,
              webSecurity: false
            }
          });
          
          // If it's a direct url, just load it, otherwise we inject CSS to hide ads and full-screen the video iframe
          videoWin.loadURL(content);
          
          videoWin.webContents.on('did-finish-load', () => {
             // Inject JS to make video full screen and hide everything else
             videoWin.webContents.executeJavaScript(`
               setInterval(() => {
                 const iframes = document.querySelectorAll('iframe');
                 iframes.forEach(f => {
                   f.style.position = 'fixed';
                   f.style.top = '0';
                   f.style.left = '0';
                   f.style.width = '100vw';
                   f.style.height = '100vh';
                   f.style.zIndex = '999999';
                 });
                 document.body.style.overflow = 'hidden';
               }, 1000);
             `);
          });
          
          videoWin.once('ready-to-show', () => {
            videoWin.show();
          });
          
          // Clear the file
          fs.writeFileSync(MOVIE_REQUEST_FILE, '', 'utf8');
        }
      } catch (err) {
        console.error('[MovieWatcher] Error processing movie request:', err);
      }
    }
  });
}

function registerSystemHandlers() {
  initMovieWatcher();
  const paths = createPaths(app);
  const activeExecCommands = new Map();
  const killProcessTree = async (child) => {
    if (!child || !child.pid) return false;

    if (process.platform === 'win32') {
      await new Promise((resolve) => {
        const killer = spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true });
        killer.once('close', resolve);
        killer.once('error', () => resolve());
      });
      return true;
    }

    try {
      process.kill(-child.pid, 'SIGKILL');
    } catch (_error) {
      try {
        child.kill('SIGKILL');
      } catch (_innerError) {
        return false;
      }
    }

    return true;
  };

  ipcMain.handle('get-openrouter-models', async () => {
    try {
      const p = paths.getOpenRouterKeyPath();
      let apiKey = process.env.OPENROUTER_API_KEY;

      if (fs.existsSync(p)) {
        const data = JSON.parse(fs.readFileSync(p, 'utf8'));
        if (data.apiKey) apiKey = data.apiKey;
      }

      if (!apiKey) return { error: 'OpenRouter Key missing' };

      const response = await axios.get('https://openrouter.ai/api/v1/models', {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://qadriai.com',
          'X-Title': 'Qadri AI',
        },
      });

      return response.data;
    } catch (error) {
      console.error('[Electron] Error fetching models:', error.message);
      return { error: error.message };
    }
  });

  ipcMain.handle('system-fs-op', async (_event, { operation, path: targetPath, content, dest }) => {
    try {
      let resolvedPath = targetPath;

      if (targetPath && (targetPath.includes('${resolvedNotesPath}') || targetPath.includes('$resolvedNotesPath'))) {
        console.warn(`[FS-OP] WARNING: AI used literal template variable "${targetPath}". Fixing...`);
        resolvedPath = targetPath.replace(/\$\{?resolvedNotesPath\}?[\\/]?/g, '');
        if (!resolvedPath || resolvedPath === targetPath) {
          resolvedPath = app.getPath('documents') + path.sep + 'Qadri Data';
        } else {
          resolvedPath = path.join(app.getPath('documents'), 'Qadri Data', resolvedPath);
        }
        console.log(`[FS-OP] Fixed literal variable: ${targetPath} -> ${resolvedPath}`);
      } else if (targetPath && !path.isAbsolute(targetPath)) {
        if (targetPath.startsWith('Documents\\') || targetPath.startsWith('Documents/')) {
          resolvedPath = path.join(app.getPath('documents'), targetPath.substring('Documents\\'.length));
        } else if (targetPath.startsWith('Qadri Data\\') || targetPath.startsWith('Qadri Data/')) {
          resolvedPath = path.join(app.getPath('documents'), targetPath);
        } else {
          resolvedPath = path.join(app.getPath('documents'), 'Qadri Data', targetPath);
        }
        console.log(`[FS-OP] Resolved relative path: ${targetPath} -> ${resolvedPath}`);
      }

      let resolvedDest = dest;
      if (dest) {
        if (dest.includes('${resolvedNotesPath}') || dest.includes('$resolvedNotesPath')) {
          console.warn(`[FS-OP] WARNING: AI used literal template variable in dest "${dest}". Fixing...`);
          resolvedDest = dest.replace(/\$\{?resolvedNotesPath\}?[\\/]?/g, '');
          if (!resolvedDest || resolvedDest === dest) {
            resolvedDest = app.getPath('documents') + path.sep + 'Qadri Data';
          } else {
            resolvedDest = path.join(app.getPath('documents'), 'Qadri Data', resolvedDest);
          }
          console.log(`[FS-OP] Fixed literal variable in dest: ${dest} -> ${resolvedDest}`);
        } else if (!path.isAbsolute(dest)) {
          if (dest.startsWith('Documents\\') || dest.startsWith('Documents/')) {
            resolvedDest = path.join(app.getPath('documents'), dest.substring('Documents\\'.length));
          } else if (dest.startsWith('Qadri Data\\') || dest.startsWith('Qadri Data/')) {
            resolvedDest = path.join(app.getPath('documents'), dest);
          } else {
            resolvedDest = path.join(app.getPath('documents'), 'Qadri Data', dest);
          }
        }
      }

      switch (operation) {
        case 'read-dir':
          return fs.readdirSync(resolvedPath);
        case 'create-dir':
          if (!fs.existsSync(resolvedPath)) fs.mkdirSync(resolvedPath, { recursive: true });
          return true;
        case 'write-file': {
          const dir = path.dirname(resolvedPath);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(resolvedPath, content || '');
          return true;
        }
        case 'read-file':
          return fs.readFileSync(resolvedPath, 'utf8');
        case 'delete':
          fs.rmSync(resolvedPath, { recursive: true, force: true });
          return true;
        case 'exists':
          return fs.existsSync(resolvedPath);
        case 'rename':
          fs.renameSync(resolvedPath, resolvedDest);
          return true;
        case 'copy-file':
          fs.copyFileSync(resolvedPath, resolvedDest);
          return true;
        default:
          return null;
      }
    } catch (error) {
      throw error;
    }
  });

  ipcMain.handle('system-open', async (_event, { target }) => {
    const open = (await import('open')).default;
    await open(target);
    return true;
  });

  ipcMain.handle('system-exec-command', async (_event, { commandId, command, workingDir, timeout }) => new Promise((resolve) => {
    const effectiveTimeout = Math.max(5000, Math.min(timeout || 30000, 300000));
    const options = {
      maxBuffer: 10 * 1024 * 1024,
      timeout: effectiveTimeout,
      cwd: workingDir || os.homedir(),
      env: { ...process.env, PATH: process.env.PATH },
    };
    const resolvedCommandId = commandId || `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    let settled = false;

    const child = exec(command, options, (error, stdout, stderr) => {
      if (settled) return;
      settled = true;
      activeExecCommands.delete(resolvedCommandId);
      resolve({
        success: !error && !child.__qadriCancelled,
        commandId: resolvedCommandId,
        stdout: stdout ? stdout.toString().substring(0, 100000) : '',
        stderr: stderr ? stderr.toString().substring(0, 50000) : '',
        error: child.__qadriCancelled ? 'Command cancelled by user.' : error?.message,
        cancelled: Boolean(child.__qadriCancelled),
        exitCode: error?.code || 0,
      });
    });
    child.__qadriCancelled = false;
    activeExecCommands.set(resolvedCommandId, child);
  }));

  ipcMain.handle('system-cancel-command', async (_event, { commandId }) => {
    const child = activeExecCommands.get(commandId);
    if (!child) {
      return { success: false, commandId, alreadyFinished: true };
    }

    child.__qadriCancelled = true;
    await killProcessTree(child);
    return { success: true, commandId };
  });

  ipcMain.handle('web-search', async (_event, { query }) => {
    try {
      let apiKey = process.env.GEMINI_API_KEY;
      const keyPath = paths.getSecretKeyPath();
      if (fs.existsSync(keyPath)) {
        try {
          const data = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
          if (data.apiKey || data.geminiKey) apiKey = data.apiKey || data.geminiKey;
        } catch (_error) {
          apiKey = process.env.GEMINI_API_KEY;
        }
      }

      if (!apiKey) {
        return { error: 'Gemini API Key not configured. Please add it in Settings.' };
      }

      const ai = new GoogleGenAI({ apiKey });
      const result = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{
          role: 'user',
          parts: [{ text: `Search the internet and provide comprehensive, detailed results for: "${query}". Include specific facts, data, URLs/sources where possible. Format the response clearly.` }],
        }],
        config: {
          tools: [{ googleSearch: {} }],
        },
      });

      let text = '';
      try {
        if (typeof result.text === 'string') {
          text = result.text;
        } else if (result.candidates?.[0]?.content?.parts?.[0]?.text) {
          text = result.candidates[0].content.parts[0].text;
        } else if (result.response && typeof result.response.text === 'function') {
          text = result.response.text();
        } else {
          console.warn('[Web Search] Unexpected response structure:', JSON.stringify(result).slice(0, 500));
          text = JSON.stringify(result);
        }
      } catch (textErr) {
        console.error('[Web Search] Text extraction error:', textErr.message);
        text = 'Search completed but could not parse result.';
      }

      const sources = [];
      try {
        const metadata = result.candidates?.[0]?.groundingMetadata;
        if (metadata?.groundingChunks) {
          for (const chunk of metadata.groundingChunks) {
            if (chunk.web) {
              sources.push({ title: chunk.web.title || '', url: chunk.web.uri || '' });
            }
          }
        }
      } catch (_error) {
        return { success: true, content: text, sources: sources.slice(0, 10) };
      }

      return { success: true, content: text, sources: sources.slice(0, 10) };
    } catch (error) {
      console.error('[Web Search] Error:', error.message);
      return { error: `Web search failed: ${error.message}` };
    }
  });

  ipcMain.handle('search-files-content', async (_event, { query, searchPath, fileTypes }) => {
    try {
      const MAX_RESULTS = 50;
      const MAX_DEPTH = 5;
      const MAX_FILE_SIZE = 5 * 1024 * 1024;
      const results = [];
      const basePath = searchPath || path.join(app.getPath('documents'), 'Qadri Data');

      if (!fs.existsSync(basePath)) {
        return { success: false, error: `Path does not exist: ${basePath}` };
      }

      const defaultExts = ['.txt', '.md', '.json', '.js', '.ts', '.tsx', '.jsx', '.css', '.html', '.py', '.java', '.cpp', '.c', '.h', '.xml', '.yaml', '.yml', '.csv', '.log', '.ini', '.cfg', '.env', '.sh', '.bat', '.ps1'];
      const searchExts = fileTypes
        ? fileTypes.split(',').map((ext) => ext.trim().startsWith('.') ? ext.trim() : `.${ext.trim()}`)
        : defaultExts;

      const searchRegex = new RegExp(query, 'gi');

      function searchDir(dirPath, depth) {
        if (depth > MAX_DEPTH || results.length >= MAX_RESULTS) return;

        let entries;
        try {
          entries = fs.readdirSync(dirPath, { withFileTypes: true });
        } catch (_error) {
          return;
        }

        for (const entry of entries) {
          if (results.length >= MAX_RESULTS) break;
          const fullPath = path.join(dirPath, entry.name);
          if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === '__pycache__') continue;

          if (entry.isDirectory()) {
            searchDir(fullPath, depth + 1);
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            if (!searchExts.includes(ext)) continue;

            try {
              const stats = fs.statSync(fullPath);
              if (stats.size > MAX_FILE_SIZE) continue;

              const content = fs.readFileSync(fullPath, 'utf8');
              const lines = content.split('\n');
              const matches = [];

              for (let i = 0; i < lines.length; i += 1) {
                if (searchRegex.test(lines[i])) {
                  matches.push({ line: i + 1, content: lines[i].trim().substring(0, 200) });
                  if (matches.length >= 5) break;
                }
                searchRegex.lastIndex = 0;
              }

              if (matches.length > 0) {
                results.push({ file: fullPath, fileName: entry.name, matchCount: matches.length, matches });
              }
            } catch (_error) {
              continue;
            }
          }
        }
      }

      searchDir(basePath, 0);
      return { success: true, query, searchPath: basePath, totalMatches: results.length, results };
    } catch (error) {
      return { error: `File search failed: ${error.message}` };
    }
  });

  ipcMain.handle('save-image', async (_event, { base64Data }) => {
    try {
      const filePath = path.join(app.getPath('downloads'), `qadri_ai_${Date.now()}.png`);
      const buffer = Buffer.from(base64Data.replace(/^data:image\/\w+;base64,/, ''), 'base64');
      fs.writeFileSync(filePath, buffer);
      return filePath;
    } catch (error) {
      throw error;
    }
  });

  ipcMain.handle('read-file-content', async (_event, { path: filePath }) => {
    try {
      console.log(`[File-Reader] Reading file: ${filePath}`);
      if (!fs.existsSync(filePath)) {
        console.error(`[File-Reader] File not found: ${filePath}`);
        return { error: 'File not found' };
      }

      const mimeType = mime.lookup(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const buffer = fs.readFileSync(filePath);
      console.log(`[File-Reader] Detected Mime: ${mimeType}, Ext: ${ext}, Size: ${buffer.length} bytes`);

      if (mimeType === 'application/pdf' || ext === '.pdf') {
        console.log('[File-Reader] Parsing PDF...');
        const data = await PDFParse(buffer);
        console.log(`[File-Reader] PDF Parsed. Content length: ${data.text?.length || 0}`);
        return { content: data.text };
      }
      if (
        mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        || ext === '.docx'
      ) {
        console.log('[File-Reader] Parsing Docx...');
        const result = await mammoth.extractRawText({ buffer });
        console.log(`[File-Reader] Docx Parsed. Content length: ${result.value?.length || 0}`);
        return { content: result.value };
      }
      if (
        mimeType.startsWith('text/')
        || mimeType === 'application/json'
        || mimeType === 'application/javascript'
        || ['.txt', '.md', '.json', '.js', '.ts', '.tsx', '.css'].includes(ext)
      ) {
        console.log('[File-Reader] Reading as Text...');
        return { content: buffer.toString('utf8') };
      }

      console.warn(`[File-Reader] Unsupported file type: ${mimeType}`);
      return { content: `[Binary/Image File: ${path.basename(filePath)}]. The content of this file is visual or binary.` };
    } catch (error) {
      console.error('[File-Reader] CRITICAL ERROR:', error);
      return { error: error.message };
    }
  });

  ipcMain.handle('pick-and-read-files', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Multimodal Files', extensions: ['jpg', 'png', 'jpeg', 'webp', 'pdf', 'doc', 'docx', 'txt', 'mp3', 'wav', 'mpeg'] },
      ],
    });

    if (canceled) return [];

    const results = [];
    for (const filePath of filePaths) {
      const stats = fs.statSync(filePath);
      if (stats.size > 50 * 1024 * 1024) continue;

      const buffer = fs.readFileSync(filePath);
      const mimeType = mime.lookup(filePath) || 'application/octet-stream';
      results.push({
        name: path.basename(filePath),
        data: buffer.toString('base64'),
        mimeType,
        path: filePath,
      });
    }
    return results;
  });

  ipcMain.handle('clipboard-read', async () => {
    try {
      return {
        text: clipboard.readText(),
        html: clipboard.readHTML(),
        image: clipboard.readImage().isEmpty() ? null : clipboard.readImage().toDataURL(),
      };
    } catch (error) {
      return { error: error.message };
    }
  });

  ipcMain.handle('clipboard-write', async (_event, { text, html, image }) => {
    try {
      if (text) clipboard.writeText(text);
      if (html) clipboard.writeHTML(html);
      if (image) {
        const img = nativeImage.createFromDataURL(image);
        clipboard.writeImage(img);
      }
      return { success: true };
    } catch (error) {
      return { error: error.message };
    }
  });

  // Legacy uncompressed screenshot (Deprecated/Removed)
  // Use 'desktop-screenshot' from desktop-manager instead for AI-optimized capture.

  ipcMain.handle('get-screen-sources', async () => {
    try {
      const sources = await desktopCapturer.getSources({ types: ['screen', 'window'] });
      return sources.map((source) => ({
        id: source.id,
        name: source.name,
        thumbnail: source.thumbnail.toDataURL(),
      }));
    } catch (error) {
      return { error: error.message };
    }
  });

  ipcMain.handle('send-notification', async (_event, { title, body, icon }) => {
    try {
      const notification = new Notification({
        title: title || 'Qadri AI',
        body: body || '',
        icon: icon || undefined,
      });
      notification.show();
      return { success: true };
    } catch (error) {
      return { error: error.message };
    }
  });

  ipcMain.handle('http-fetch', async (_event, { url, method, headers, body }) => {
    try {
      const response = await axios({
        url,
        method: method || 'GET',
        headers: headers || {},
        data: body || undefined,
        timeout: 30000,
      });
      return {
        success: true,
        status: response.status,
        data: response.data,
        headers: response.headers,
      };
    } catch (error) {
      return {
        error: error.message,
        status: error.response?.status,
        data: error.response?.data,
      };
    }
  });

  ipcMain.handle('get-detailed-system-info', async () => {
    try {
      const [cpu, mem, graphics, osInfo, network, battery] = await Promise.all([
        si.cpu(),
        si.mem(),
        si.graphics(),
        si.osInfo(),
        si.networkInterfaces(),
        si.battery(),
      ]);
      return { cpu, mem, graphics, os: osInfo, network, battery };
    } catch (error) {
      return { error: error.message };
    }
  });

  ipcMain.handle('window-control', async (_event, { action }) => {
    try {
      const win = BrowserWindow.getFocusedWindow();
      if (!win) return { error: 'No focused window' };

      switch (action) {
        case 'minimize':
          win.minimize();
          break;
        case 'maximize':
          if (win.isMaximized()) win.unmaximize();
          else win.maximize();
          break;
        case 'close':
          win.close();
          break;
        case 'fullscreen':
          win.setFullScreen(!win.isFullScreen());
          break;
        default:
          break;
      }
      return { success: true };
    } catch (error) {
      return { error: error.message };
    }
  });

  ipcMain.handle('get-processes', async () => {
    try {
      const processes = await si.processes();
      return processes.list
        .sort((a, b) => b.cpu - a.cpu)
        .slice(0, 20)
        .map((proc) => ({ name: proc.name, pid: proc.pid, cpu: proc.cpu, mem: proc.mem }));
    } catch (error) {
      return { error: error.message };
    }
  });

  ipcMain.handle('kill-process', async (_event, { pid }) => {
    try {
      process.kill(pid);
      return { success: true };
    } catch (error) {
      return { error: error.message };
    }
  });

  // ─── WhatsApp Smart Send ─────────────────────────────────────────────────
  ipcMain.handle('send-whatsapp-keyboard', async (_event, args) => {
    const name = String(args?.name || '');
    const message = String(args?.message || '');

    if (!name || !message) {
      return { success: false, error: 'Contact name and message are required' };
    }

    let robot;
    try {
      robot = require('@jitsi/robotjs');
    } catch (e) {
      return { success: false, error: 'RobotJS not installed. Run: npm install @jitsi/robotjs' };
    }

    const sleep = (ms) => {
      const start = Date.now();
      while (Date.now() - start < ms) {}
    };

    exec('start whatsapp:', (error) => {
      if (error) console.warn('[WhatsApp] Could not open via protocol:', error.message);
    });

    sleep(3500);
    robot.keyTap('f', 'control'); // Ctrl+F = normal chat search (accurate)
    sleep(1200);

    for (const char of name) {
      robot.typeString(char);
      sleep(60);
    }

    sleep(2000);
    robot.keyTap('down'); // move to first result
    sleep(400);
    robot.keyTap('enter'); // open chat
    sleep(900);

    robot.typeString(message);
    sleep(600);
    robot.keyTap('enter'); // send

    return {
      success: true,
      output: `Message sent to "${name}"`,
      method: 'keyboard_chat_search',
    };
  });
}

module.exports = { registerSystemHandlers };
