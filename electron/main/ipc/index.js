const { registerSkillsHandlers }         = require('./skills-handlers');
const { registerSystemHandlers }          = require('./system-handlers');
const { registerHardwareHandlers }        = require('./hardware-handlers');
const { registerBrowserHandlers }         = require('../../services/browser-manager');
const { registerDesktopHandlers }         = require('../../services/desktop-manager');
const { registerCodingEngineerHandlers }  = require('./coding-engineer-handlers');
const { registerJarvisHandlers }          = require('./jarvis-handlers');

function registerDomainHandlers() {
  registerSystemHandlers();
  registerSkillsHandlers();
  registerHardwareHandlers();
  registerBrowserHandlers();
  registerDesktopHandlers();
  registerCodingEngineerHandlers();
  registerJarvisHandlers();
}

module.exports = { registerDomainHandlers };
