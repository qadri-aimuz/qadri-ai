const { exec, spawn } = require('child_process');
const si = require('systeminformation');
const fs = require('fs-extra');
const path = require('path');

class SystemControlService {
  constructor() {
    this.history = [];
  }

  // 1. Smart App Control
  async openApp(appName) {
    return new Promise((resolve, reject) => {
      // Very basic windows open app
      exec(`start "" "${appName}"`, (error, stdout, stderr) => {
        if (error) {
          // fallback to search
          exec(`explorer.exe shell:AppsFolder\\${appName}`, (err) => {
            if (err) return reject(error);
            resolve(`Opened ${appName}`);
          });
        } else {
          resolve(`Opened ${appName}`);
        }
      });
    });
  }

  async closeApp(processName) {
    return new Promise((resolve, reject) => {
      exec(`taskkill /IM "${processName}" /F`, (error, stdout, stderr) => {
        if (error) return reject(error);
        resolve(`Closed ${processName}`);
      });
    });
  }

  async getActiveWindow() {
    console.log('getActiveWindow is disabled due to active-win native module requirement.');
    return null;
  }

  async getRunningApps() {
    try {
      const processes = await si.processes();
      // Filter for actual apps, simplified
      return processes.list.filter(p => p.name.endsWith('.exe'));
    } catch (error) {
      console.error('Failed to get running apps:', error);
      return [];
    }
  }

  // 7. PC Health Intelligence
  async getSystemHealth() {
    try {
      const [cpu, mem, battery, temp, currentLoad] = await Promise.all([
        si.cpu(),
        si.mem(),
        si.battery(),
        si.cpuTemperature(),
        si.currentLoad()
      ]);
      
      return {
        cpu: {
          manufacturer: cpu.manufacturer,
          brand: cpu.brand,
          load: currentLoad.currentLoad.toFixed(2) + '%'
        },
        memory: {
          total: (mem.total / 1024 / 1024 / 1024).toFixed(2) + ' GB',
          used: (mem.active / 1024 / 1024 / 1024).toFixed(2) + ' GB',
          free: (mem.available / 1024 / 1024 / 1024).toFixed(2) + ' GB'
        },
        battery: {
          hasBattery: battery.hasBattery,
          percent: battery.percent + '%',
          isCharging: battery.isCharging
        },
        temperature: {
          main: temp.main + ' °C'
        }
      };
    } catch (error) {
      console.error('Failed to get system health:', error);
      return null;
    }
  }
}

module.exports = new SystemControlService();
