/**
 * ═══════════════════════════════════════════════════════════════
 *  JARVIS OVERLAY — Premium Real-Time AI Overlay  (v1.23.1)
 *  Floating hologram, animated avatar, always-available assistant
 * ═══════════════════════════════════════════════════════════════
 */

const { ipcMain, BrowserWindow, screen, nativeImage, app } = require('electron');
const path = require('path');

let jarvisWindow = null;      // the floating overlay
let isCollapsed  = false;     // bubble vs expanded mode

// ── Resolve icon ────────────────────────────────────────────────────────────
function resolveIcon() {
  try {
    const iconPath = app.isPackaged
      ? path.join(process.resourcesPath, 'public/logo.png')
      : path.join(app.getAppPath(), 'public/logo.png');
    return nativeImage.createFromPath(iconPath);
  } catch (_) { return undefined; }
}

// ── Get or create the overlay window ────────────────────────────────────────
function getJarvisWindow() {
  if (jarvisWindow && !jarvisWindow.isDestroyed()) return jarvisWindow;

  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;

  jarvisWindow = new BrowserWindow({
    width:           380,
    height:          520,
    x:               sw - 400,
    y:               sh - 560,
    frame:           false,
    transparent:     true,
    backgroundColor: '#00000000',
    alwaysOnTop:     true,
    skipTaskbar:     true,
    resizable:       false,
    hasShadow:       false,
    show:            false,
    type:            'toolbar',   // stays above other windows on Win
    icon:            resolveIcon(),
    webPreferences: {
      nodeIntegration:        false,
      contextIsolation:       true,
      preload:                path.join(__dirname, '../../preload.js'),
      webSecurity:            false,
      backgroundThrottling:   false,
    },
  });

  jarvisWindow.setAlwaysOnTop(true, 'screen-saver');
  jarvisWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  const isDev = process.env.NODE_ENV === 'development';

  if (isDev) {
    jarvisWindow.loadURL('http://localhost:5173/?mode=jarvis');
  } else {
    // Dynamically resolve production port from main process
    // productionPort is set in main.js startProductionServer()
    let port = 45678; // fallback default
    try {
      // Try to get the actual port from main module if accessible
      const mainModule = require.main;
      if (mainModule && mainModule.exports && mainModule.exports.getProductionPort) {
        port = mainModule.exports.getProductionPort() || 45678;
      }
    } catch (_) {}
    jarvisWindow.loadURL(`http://localhost:${port}/index.html?mode=jarvis`);
  }

  jarvisWindow.once('ready-to-show', () => {
    jarvisWindow.show();
    jarvisWindow.setIgnoreMouseEvents(false);
    console.log('[Jarvis] Overlay window ready.');
  });

  jarvisWindow.on('closed', () => {
    jarvisWindow = null;
    console.log('[Jarvis] Overlay window closed.');
  });

  return jarvisWindow;
}

// ── Register all Jarvis IPC handlers ────────────────────────────────────────
function registerJarvisHandlers() {
  console.log('[Jarvis] Registering Premium Jarvis Mode handlers...');

  // Toggle overlay on/off
  ipcMain.handle('jarvis-toggle', async () => {
    if (!jarvisWindow || jarvisWindow.isDestroyed()) {
      getJarvisWindow();
      return { visible: true };
    }
    if (jarvisWindow.isVisible()) {
      jarvisWindow.hide();
      return { visible: false };
    } else {
      jarvisWindow.show();
      return { visible: true };
    }
  });

  // Open (create if not exists, show if hidden)
  ipcMain.handle('jarvis-open', async () => {
    const win = getJarvisWindow();
    if (!win.isVisible()) win.show();
    win.focus();
    return { success: true };
  });

  // Close/hide overlay
  ipcMain.handle('jarvis-close', async () => {
    if (jarvisWindow && !jarvisWindow.isDestroyed()) {
      jarvisWindow.hide();
    }
    return { success: true };
  });

  // Destroy overlay entirely
  ipcMain.handle('jarvis-destroy', async () => {
    if (jarvisWindow && !jarvisWindow.isDestroyed()) {
      jarvisWindow.close();
      jarvisWindow = null;
    }
    return { success: true };
  });

  // Move overlay to a corner
  ipcMain.handle('jarvis-set-position', async (_e, { corner, x, y }) => {
    if (!jarvisWindow || jarvisWindow.isDestroyed()) return { error: 'Overlay not open' };
    const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;
    const [ww, wh] = jarvisWindow.getSize();

    if (corner) {
      const corners = {
        'bottom-right': { x: sw - ww - 20, y: sh - wh - 20 },
        'bottom-left':  { x: 20,           y: sh - wh - 20 },
        'top-right':    { x: sw - ww - 20, y: 20 },
        'top-left':     { x: 20,           y: 20 },
        'center':       { x: Math.floor((sw - ww) / 2), y: Math.floor((sh - wh) / 2) },
      };
      const pos = corners[corner] || corners['bottom-right'];
      jarvisWindow.setPosition(pos.x, pos.y);
    } else if (x !== undefined && y !== undefined) {
      jarvisWindow.setPosition(Math.round(x), Math.round(y));
    }
    return { success: true };
  });

  // Resize (collapsed bubble vs expanded panel)
  ipcMain.handle('jarvis-collapse', async (_e, { collapsed }) => {
    if (!jarvisWindow || jarvisWindow.isDestroyed()) return { error: 'Not open' };
    isCollapsed = collapsed;
    const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;
    if (collapsed) {
      jarvisWindow.setSize(80, 80);
      jarvisWindow.setPosition(sw - 100, sh - 100);
    } else {
      jarvisWindow.setSize(380, 520);
      jarvisWindow.setPosition(sw - 400, sh - 560);
    }
    return { success: true, collapsed };
  });

  // Push a notification / message into the overlay
  ipcMain.handle('jarvis-notify', async (_e, { title, body, type }) => {
    if (!jarvisWindow || jarvisWindow.isDestroyed()) {
      // Auto-open on notify
      getJarvisWindow();
    }
    const win = jarvisWindow;
    if (win && !win.isDestroyed()) {
      win.webContents.send('jarvis-incoming-notification', { title, body, type: type || 'info', timestamp: Date.now() });
      if (!win.isVisible()) win.show();
    }
    return { success: true };
  });

  // Forward AI response to the overlay (real-time streaming display)
  ipcMain.handle('jarvis-push-message', async (_e, { role, content, partial }) => {
    if (jarvisWindow && !jarvisWindow.isDestroyed()) {
      jarvisWindow.webContents.send('jarvis-message', { role, content, partial: !!partial });
    }
    return { success: true };
  });

  // Allow overlay to relay user input back to main window
  ipcMain.on('jarvis-user-input', (_e, { message }) => {
    BrowserWindow.getAllWindows().forEach(win => {
      if (win !== jarvisWindow && !win.isDestroyed()) {
        win.webContents.send('jarvis-relay-input', { message });
      }
    });
  });

  // Get current overlay state
  ipcMain.handle('jarvis-get-state', async () => {
    if (!jarvisWindow || jarvisWindow.isDestroyed()) return { open: false };
    const [x, y]    = jarvisWindow.getPosition();
    const [w, h]    = jarvisWindow.getSize();
    const visible   = jarvisWindow.isVisible();
    return { open: true, visible, x, y, width: w, height: h, collapsed: isCollapsed };
  });

  // Make overlay click-through (so mouse passes through to the desktop)
  ipcMain.handle('jarvis-set-clickthrough', async (_e, { enabled }) => {
    if (!jarvisWindow || jarvisWindow.isDestroyed()) return { error: 'Not open' };
    jarvisWindow.setIgnoreMouseEvents(enabled, { forward: true });
    return { success: true, clickthrough: enabled };
  });

  console.log('[Jarvis] ✅ 9 Jarvis Overlay handlers registered.');
}

module.exports = { registerJarvisHandlers, getJarvisWindow };
