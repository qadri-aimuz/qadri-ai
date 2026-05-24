/**
 * ═══════════════════════════════════════════════════════
 *  AI Coding Engineer — Developer Mode IPC Handlers
 *  Qadri AI v1.23.1
 *
 *  Capabilities:
 *   • Generate code (routed through AI model in renderer)
 *   • Fix bugs (log analysis + patch generation)
 *   • Run terminal commands (sandboxed shell execution)
 *   • Create projects (scaffold generator)
 *   • Analyze logs
 *   • Read/write/diff files for the AI to reason about
 * ═══════════════════════════════════════════════════════
 */

const { ipcMain, app, dialog } = require('electron');
const { exec, spawn }          = require('child_process');
const path   = require('path');
const fs     = require('fs-extra');
const os     = require('os');
const crypto = require('crypto');

// ── Active terminal sessions (streaming) ──────────────────────────────────
const activeSessions = new Map();

// ── Sandboxed execution root ───────────────────────────────────────────────
const getSandboxRoot = () => {
  const sandboxDir = path.join(app.getPath('userData'), 'coding-sandbox');
  fs.ensureDirSync(sandboxDir);
  return sandboxDir;
};

// ── Helper: run a command and collect all output ───────────────────────────
function runCommand(command, cwd, env = {}) {
  return new Promise((resolve) => {
    const timeout  = 120_000;
    const options  = {
      cwd: cwd || os.homedir(),
      env: { ...process.env, ...env },
      timeout,
      maxBuffer: 20 * 1024 * 1024,
      shell: true,
    };

    exec(command, options, (error, stdout, stderr) => {
      resolve({
        success:  !error,
        stdout:   stdout?.toString().slice(0, 80_000) || '',
        stderr:   stderr?.toString().slice(0, 40_000) || '',
        exitCode: error?.code ?? 0,
        error:    error?.message || null,
      });
    });
  });
}

// ── Scaffold templates ─────────────────────────────────────────────────────
const PROJECT_TEMPLATES = {
  'react-vite': {
    cmd:    'npx -y create-vite@latest . --template react',
    deps:   'npm install',
    desc:   'React + Vite',
  },
  'node-express': {
    cmd:    null,   // generated manually below
    deps:   'npm install',
    desc:   'Node.js + Express REST API',
  },
  'next-app': {
    cmd:    'npx -y create-next-app@latest . --ts --eslint --tailwind --app --no-git',
    deps:   null,
    desc:   'Next.js App Router + Tailwind',
  },
  'electron-app': {
    cmd:    null,
    deps:   'npm install',
    desc:   'Electron Desktop App',
  },
  'vanilla-html': {
    cmd:    null,
    deps:   null,
    desc:   'Plain HTML/CSS/JS',
  },
};

function registerCodingEngineerHandlers() {
  console.log('[CodingEngineer] Registering AI Developer Mode handlers...');

  // ─── 1. Run terminal command (sandboxed) ────────────────────────────────
  ipcMain.handle('dev-run-command', async (_e, { command, cwd, sessionId, env }) => {
    const safeCwd = cwd || getSandboxRoot();
    const sid     = sessionId || crypto.randomUUID();

    console.log(`[CodingEngineer] Running: ${command}  cwd=${safeCwd}`);
    const result  = await runCommand(command, safeCwd, env || {});
    return { ...result, sessionId: sid, command };
  });

  // ─── 2. Streaming terminal session (long-running processes) ─────────────
  ipcMain.handle('dev-start-session', async (_e, { command, cwd }) => {
    const sessionId = crypto.randomUUID();
    const safeCwd   = cwd || getSandboxRoot();

    const child = spawn(command, [], {
      cwd:   safeCwd,
      env:   process.env,
      shell: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    activeSessions.set(sessionId, child);

    child.stdout.on('data', (data) => {
      const win = require('electron').BrowserWindow.getAllWindows()[0];
      if (win && !win.isDestroyed()) {
        win.webContents.send('dev-session-output', { sessionId, type: 'stdout', data: data.toString() });
      }
    });

    child.stderr.on('data', (data) => {
      const win = require('electron').BrowserWindow.getAllWindows()[0];
      if (win && !win.isDestroyed()) {
        win.webContents.send('dev-session-output', { sessionId, type: 'stderr', data: data.toString() });
      }
    });

    child.on('close', (code) => {
      activeSessions.delete(sessionId);
      const win = require('electron').BrowserWindow.getAllWindows()[0];
      if (win && !win.isDestroyed()) {
        win.webContents.send('dev-session-output', { sessionId, type: 'exit', code });
      }
    });

    return { sessionId, pid: child.pid };
  });

  ipcMain.handle('dev-send-input', (_e, { sessionId, input }) => {
    const child = activeSessions.get(sessionId);
    if (child) { child.stdin.write(input); return true; }
    return false;
  });

  ipcMain.handle('dev-kill-session', (_e, { sessionId }) => {
    const child = activeSessions.get(sessionId);
    if (child) {
      child.kill('SIGKILL');
      activeSessions.delete(sessionId);
      return true;
    }
    return false;
  });

  // ─── 3. Read file for AI analysis ───────────────────────────────────────
  ipcMain.handle('dev-read-file', async (_e, { filePath }) => {
    try {
      if (!filePath || !fs.existsSync(filePath)) return { error: 'File not found' };
      const content = await fs.readFile(filePath, 'utf8');
      return { success: true, content, lines: content.split('\n').length };
    } catch (err) {
      return { error: err.message };
    }
  });

  // ─── 4. Write / patch file ───────────────────────────────────────────────
  ipcMain.handle('dev-write-file', async (_e, { filePath, content }) => {
    try {
      await fs.ensureDir(path.dirname(filePath));
      await fs.writeFile(filePath, content, 'utf8');
      return { success: true, filePath };
    } catch (err) {
      return { error: err.message };
    }
  });

  // ─── 5. List directory (project explorer) ───────────────────────────────
  ipcMain.handle('dev-list-dir', async (_e, { dirPath, depth = 2 }) => {
    const MAX_DEPTH = Math.min(depth, 5);

    async function scanDir(dir, d) {
      if (d > MAX_DEPTH) return [];
      const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
      const result  = [];
      for (const entry of entries) {
        if (['node_modules', '.git', 'dist', '.next', '__pycache__', '.venv'].includes(entry.name)) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          result.push({ name: entry.name, type: 'dir', children: await scanDir(full, d + 1), path: full });
        } else {
          const stat = await fs.stat(full).catch(() => null);
          result.push({ name: entry.name, type: 'file', size: stat?.size || 0, path: full });
        }
      }
      return result;
    }

    try {
      const tree = await scanDir(dirPath || getSandboxRoot(), 0);
      return { success: true, tree, root: dirPath };
    } catch (err) {
      return { error: err.message };
    }
  });

  // ─── 6. Create project scaffold ─────────────────────────────────────────
  ipcMain.handle('dev-create-project', async (_e, { template, projectName, targetDir }) => {
    try {
      const tpl     = PROJECT_TEMPLATES[template];
      if (!tpl) return { error: `Unknown template: ${template}. Available: ${Object.keys(PROJECT_TEMPLATES).join(', ')}` };

      const projDir = path.join(targetDir || getSandboxRoot(), projectName || `project_${Date.now()}`);
      await fs.ensureDir(projDir);

      let result;

      // ── Express template ─────────────────────────────────────
      if (template === 'node-express') {
        const pkgJson = {
          name:        projectName || 'qadri-api',
          version:     '1.0.0',
          description: 'Express API generated by Qadri AI',
          main:        'index.js',
          scripts:     { start: 'node index.js', dev: 'nodemon index.js' },
          dependencies: { express: '^4.18.2', cors: '^2.8.5', dotenv: '^16.3.1' },
        };
        await fs.writeJson(path.join(projDir, 'package.json'), pkgJson, { spaces: 2 });
        await fs.writeFile(path.join(projDir, 'index.js'), `const express = require('express');\nconst cors = require('cors');\nconst app = express();\n\napp.use(cors());\napp.use(express.json());\n\napp.get('/', (req, res) => res.json({ message: 'Qadri AI API is running!' }));\n\nconst PORT = process.env.PORT || 3000;\napp.listen(PORT, () => console.log(\`Server running on http://localhost:\${PORT}\`));\n`);
        result = await runCommand('npm install', projDir);
      }

      // ── Vanilla template ─────────────────────────────────────
      else if (template === 'vanilla-html') {
        await fs.writeFile(path.join(projDir, 'index.html'), `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8" />\n  <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n  <title>${projectName || 'Qadri AI Project'}</title>\n  <link rel="stylesheet" href="style.css" />\n</head>\n<body>\n  <h1>${projectName || 'Qadri AI Project'}</h1>\n  <p>Built with Qadri AI</p>\n  <script src="main.js"></script>\n</body>\n</html>\n`);
        await fs.writeFile(path.join(projDir, 'style.css'), `* { margin: 0; padding: 0; box-sizing: border-box; }\nbody { font-family: sans-serif; background: #0d0d0d; color: #fff; display: flex; justify-content: center; align-items: center; min-height: 100vh; }\nh1 { font-size: 2rem; background: linear-gradient(135deg, #7c3aed, #c026d3); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }\n`);
        await fs.writeFile(path.join(projDir, 'main.js'), `console.log('${projectName || 'Qadri AI Project'} loaded!');\n`);
        result = { success: true, stdout: 'Vanilla project scaffold created.' };
      }

      // ── Electron template ────────────────────────────────────
      else if (template === 'electron-app') {
        const pkgJson = {
          name:        projectName || 'qadri-electron',
          version:     '1.0.0',
          description: 'Electron app by Qadri AI',
          main:        'main.js',
          scripts:     { start: 'electron .' },
          devDependencies: { electron: '^28.0.0' },
        };
        await fs.writeJson(path.join(projDir, 'package.json'), pkgJson, { spaces: 2 });
        await fs.writeFile(path.join(projDir, 'main.js'), `const { app, BrowserWindow } = require('electron');\nfunction createWindow() {\n  const win = new BrowserWindow({ width: 900, height: 600, webPreferences: { nodeIntegration: true } });\n  win.loadFile('index.html');\n}\napp.whenReady().then(createWindow);\n`);
        await fs.writeFile(path.join(projDir, 'index.html'), `<!DOCTYPE html><html><body><h1>${projectName || 'Qadri AI Electron'}</h1></body></html>`);
        result = await runCommand('npm install', projDir);
      }

      // ── npm-based templates ──────────────────────────────────
      else {
        result = await runCommand(tpl.cmd, projDir);
        if (tpl.deps && result.success) {
          const depsResult = await runCommand(tpl.deps, projDir);
          result.stdout += '\n' + depsResult.stdout;
        }
      }

      return {
        success:    result.success,
        projectDir: projDir,
        template:   tpl.desc,
        stdout:     result.stdout,
        stderr:     result.stderr,
        error:      result.error || null,
      };
    } catch (err) {
      return { error: err.message };
    }
  });

  // ─── 7. Analyze log file / error trace ──────────────────────────────────
  ipcMain.handle('dev-analyze-log', async (_e, { logPath, content, maxLines = 200 }) => {
    try {
      let raw = content;
      if (!raw && logPath) {
        if (!fs.existsSync(logPath)) return { error: 'Log file not found' };
        raw = await fs.readFile(logPath, 'utf8');
      }
      if (!raw) return { error: 'No log content provided' };

      const lines   = raw.split('\n');
      const total   = lines.length;
      const snippet = lines.slice(-maxLines).join('\n');

      // Extract errors, warnings, stack traces
      const errors   = lines.filter(l => /error|exception|fatal|critical|failed/i.test(l));
      const warnings = lines.filter(l => /warn|warning|deprecated/i.test(l));
      const stacks   = lines.filter(l => /^\s+at\s/i.test(l));

      return {
        success:    true,
        totalLines: total,
        snippet,
        summary: {
          errorCount:   errors.length,
          warningCount: warnings.length,
          stackFrames:  stacks.length,
          topErrors:    errors.slice(0, 10),
          topWarnings:  warnings.slice(0, 5),
        }
      };
    } catch (err) {
      return { error: err.message };
    }
  });

  // ─── 8. Get environment info ─────────────────────────────────────────────
  ipcMain.handle('dev-get-env-info', async () => {
    const [nodeResult, npmResult, gitResult, pythonResult] = await Promise.all([
      runCommand('node --version',   os.homedir()),
      runCommand('npm --version',    os.homedir()),
      runCommand('git --version',    os.homedir()),
      runCommand('python --version', os.homedir()),
    ]);

    return {
      node:      nodeResult.stdout.trim()   || nodeResult.error,
      npm:       npmResult.stdout.trim()    || npmResult.error,
      git:       gitResult.stdout.trim()    || gitResult.error,
      python:    pythonResult.stdout.trim() || pythonResult.error,
      platform:  os.platform(),
      arch:      os.arch(),
      homedir:   os.homedir(),
      sandbox:   getSandboxRoot(),
    };
  });

  // ─── 9. Pick project folder ──────────────────────────────────────────────
  ipcMain.handle('dev-pick-folder', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({ properties: ['openDirectory'] });
    if (canceled) return null;
    return filePaths[0];
  });

  // ─── 10. Delete path ─────────────────────────────────────────────────────
  ipcMain.handle('dev-delete-path', async (_e, { targetPath }) => {
    try {
      await fs.remove(targetPath);
      return { success: true };
    } catch (err) {
      return { error: err.message };
    }
  });

  console.log('[CodingEngineer] ✅ 10 Developer Mode handlers registered.');
}

module.exports = { registerCodingEngineerHandlers };
