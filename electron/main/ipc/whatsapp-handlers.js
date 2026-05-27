const { app, ipcMain } = require('electron');
const { exec } = require('child_process');
const fs = require('fs');

const WhatsAppManager = require('../../services/whatsapp-manager');
const { createPaths } = require('../shared/paths');

function loadRobotModule() {
  return require('@jitsi/robotjs');
}

function registerWhatsAppHandlers({ getMainWindow, getWhatsAppManager, setWhatsAppManager }) {
  const paths = createPaths(app);

  ipcMain.handle('whatsapp-init', async () => {
    try {
      let manager = getWhatsAppManager();
      if (!manager) {
        manager = new WhatsAppManager(getMainWindow(), app);
        setWhatsAppManager(manager);
      } else {
        manager.updateMainWindow(getMainWindow());
      }
      await manager.initialize();
      return { success: true, state: manager.getState() };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('whatsapp-get-state', async () => {
    try {
      const manager = getWhatsAppManager();
      if (!manager) {
        return {
          status: 'disconnected',
          reason: null,
          isReady: false,
          isInitializing: false,
          qrCode: null,
          reconnectAttempts: 0,
        };
      }
      return manager.getState();
    } catch (_error) {
      return {
        status: 'disconnected',
        reason: 'state-read-failed',
        isReady: false,
        isInitializing: false,
        qrCode: null,
        reconnectAttempts: 0,
      };
    }
  });

  ipcMain.handle('get-whatsapp-settings', async () => {
    try {
      const p = paths.getWhatsAppSettingsPath();
      if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
      return { autoConnect: false };
    } catch (_error) {
      return { autoConnect: false };
    }
  });

  ipcMain.handle('save-whatsapp-settings', async (_event, settings) => {
    try {
      const settingsPath = paths.getWhatsAppSettingsPath();
      const currentSettings = fs.existsSync(settingsPath)
        ? JSON.parse(fs.readFileSync(settingsPath, 'utf8'))
        : {};
      const mergedSettings = { ...currentSettings, ...(settings || {}) };
      fs.writeFileSync(settingsPath, JSON.stringify(mergedSettings, null, 2));
      return true;
    } catch (_error) {
      return false;
    }
  });

  ipcMain.handle('whatsapp-logout', async () => {
    try {
      const manager = getWhatsAppManager();
      if (manager) {
        await manager.logout();
      }
      return { success: true, state: manager ? manager.getState() : null };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('whatsapp-send-reply', async (_event, { chatId, message }) => {
    try {
      const manager = getWhatsAppManager();
      if (manager) {
        const sent = await manager.sendReply(chatId, message);
        if (sent) return { success: true };
        return { success: false, error: 'WhatsApp client is not ready or message failed to send.' };
      }
      return { success: false, error: 'WhatsApp Manager not initialized' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('remote-access-status', async () => ({ isRunning: false }));

  ipcMain.handle('send-whatsapp-keyboard', async (_event, args) => {
    try {
      const name = String(args?.name || '');
      const message = String(args?.message || '');

      if (!name || !message) {
        console.error('[WhatsApp Robot] Missing name or message:', { name, message });
        return { success: false, error: 'Contact name and message are required' };
      }

      let robot;
      try {
        robot = loadRobotModule();
      } catch (error) {
        console.error('[WhatsApp Robot] RobotJS not available:', error.message);
        return {
          success: false,
          error: 'RobotJS module not installed. Run: npm install robotjs',
        };
      }

      const sleep = (ms) => {
        const start = Date.now();
        while (Date.now() - start < ms) {}
      };

      exec('start whatsapp:', (error) => {
        if (error) console.warn('[WhatsApp Robot] Could not open via protocol, trying direct exe...');
      });

      sleep(4000);
      robot.keyTap('n', 'control');
      sleep(1500);
      robot.typeString(name);
      sleep(1500);
      robot.keyTap('enter');
      sleep(1000);
      robot.typeString(message);
      sleep(800);
      robot.keyTap('enter');

      return {
        success: true,
        output: 'Message sent successfully using RobotJS',
        method: 'robotjs_native',
      };
    } catch (error) {
      console.error(error);
      return {
        success: false,
        error: error.message,
      };
    }
  });

  ipcMain.handle('keyboard-press', async (_event, { key }) => {
    const startTime = Date.now();
    try {
      let robot;
      try {
        robot = loadRobotModule();
      } catch (_error) {
        return {
          success: false,
          toolName: 'keyboard_press',
          error: 'RobotJS module not available. Keyboard control requires @jitsi/robotjs.',
          errorCode: 'MODULE_NOT_AVAILABLE',
          errorCategory: 'config',
          retryable: false,
          debugInfo: { executionTimeMs: Date.now() - startTime },
        };
      }

      const lowerKey = key.toLowerCase().trim();
      if (lowerKey.includes('+')) {
        const parts = lowerKey.split('+');
        const mainKey = parts.pop();
        const modifiers = parts;
        const modMap = { ctrl: 'control', alt: 'alt', shift: 'shift', cmd: 'command', win: 'command' };
        const robotModifiers = modifiers.map((modifier) => modMap[modifier] || modifier);

        robot.keyTap(mainKey, robotModifiers);
        console.log(`[Keyboard] Pressed: ${robotModifiers.join('+')}+${mainKey}`);
        return {
          success: true,
          toolName: 'keyboard_press',
          result: `Pressed ${key}`,
          debugInfo: { executionTimeMs: Date.now() - startTime },
        };
      }

      const keyMap = {
        enter: 'enter',
        return: 'enter',
        tab: 'tab',
        escape: 'escape',
        esc: 'escape',
        backspace: 'backspace',
        delete: 'delete',
        space: 'space',
        up: 'up',
        down: 'down',
        left: 'left',
        right: 'right',
        home: 'home',
        end: 'end',
        pageup: 'pageup',
        pagedown: 'pagedown',
        f1: 'f1',
        f2: 'f2',
        f3: 'f3',
        f4: 'f4',
        f5: 'f5',
        f6: 'f6',
        f7: 'f7',
        f8: 'f8',
        f9: 'f9',
        f10: 'f10',
        f11: 'f11',
        f12: 'f12',
        printscreen: 'printscreen',
        insert: 'insert',
        capslock: 'capslock',
        numlock: 'numlock',
        scrolllock: 'scrolllock',
      };

      const robotKey = keyMap[lowerKey] || lowerKey;
      robot.keyTap(robotKey);
      console.log(`[Keyboard] Pressed: ${robotKey}`);

      return {
        success: true,
        toolName: 'keyboard_press',
        result: `Pressed ${key}`,
        debugInfo: { executionTimeMs: Date.now() - startTime },
      };
    } catch (error) {
      console.error('[Keyboard] Press failed:', error.message);
      return {
        success: false,
        toolName: 'keyboard_press',
        error: `Key press failed: ${error.message}`,
        errorCode: 'UNKNOWN_ERROR',
        errorCategory: 'transient',
        retryable: true,
        retrySuggestion: 'Make sure the target window is focused and try again.',
        debugInfo: { executionTimeMs: Date.now() - startTime, key },
      };
    }
  });

  ipcMain.handle('keyboard-type', async (_event, { text, pressEnter }) => {
    const startTime = Date.now();
    try {
      let robot;
      try {
        robot = loadRobotModule();
      } catch (_error) {
        return {
          success: false,
          toolName: 'simulate_keyboard_press',
          error: 'RobotJS module not available. Keyboard control requires @jitsi/robotjs.',
          errorCode: 'MODULE_NOT_AVAILABLE',
          errorCategory: 'config',
          retryable: false,
          debugInfo: { executionTimeMs: Date.now() - startTime },
        };
      }

      if (text && text.length > 0) {
        robot.typeString(text);
        console.log(`[Keyboard] Typed: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}" (${text.length} chars)`);
      }

      if (pressEnter) {
        await new Promise((resolve) => setTimeout(resolve, 300));
        robot.keyTap('enter');
        console.log('[Keyboard] Pressed Enter after typing');
      }

      return {
        success: true,
        toolName: 'simulate_keyboard_press',
        result: `Typed "${text}"${pressEnter ? ' and pressed Enter' : ''}`,
        data: { charCount: text?.length || 0, enterPressed: !!pressEnter },
        debugInfo: { executionTimeMs: Date.now() - startTime },
      };
    } catch (error) {
      console.error('[Keyboard] Type failed:', error.message);
      return {
        success: false,
        toolName: 'simulate_keyboard_press',
        error: `Typing failed: ${error.message}`,
        errorCode: 'UNKNOWN_ERROR',
        errorCategory: 'transient',
        retryable: true,
        retrySuggestion: 'Make sure the target input is focused. Try clicking on it first, then type.',
        debugInfo: { executionTimeMs: Date.now() - startTime, textLength: text?.length },
      };
    }
  });
}

module.exports = { registerWhatsAppHandlers };
