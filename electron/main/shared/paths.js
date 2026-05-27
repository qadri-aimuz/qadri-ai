const path = require('path');

function createPaths(app) {
  return {
    getMemoryPath: () => path.join(app.getPath('userData'), 'memories.json'),
    getUserProfilePath: () => path.join(app.getPath('userData'), 'user_profile.json'),
    getDashboardSettingsPath: () => path.join(app.getPath('userData'), 'dashboard_settings.json'),
    getFolderConfigPath: () => path.join(app.getPath('userData'), 'imported_folders.json'),
    getVaultPath: () => path.join(app.getPath('documents'), 'Qadri_Vault'),
    getHistoryPath: () => path.join(app.getPath('userData'), 'history.json'),
    getHistorySettingsPath: () => path.join(app.getPath('userData'), 'history_settings.json'),
    getContactsPath: () => path.join(app.getPath('userData'), 'contacts.json'),
    getNotesPath: () => path.join(app.getPath('userData'), 'notes.json'),
    getTasksPath: () => path.join(app.getPath('userData'), 'tasks.json'),
    getSecretKeyPath: () => path.join(app.getPath('userData'), 'secret_key.json'),
    getGroqKeyPath: () => path.join(app.getPath('userData'), 'groq_key.json'),
    getOpenAIKeyPath: () => path.join(app.getPath('userData'), 'openai_key.json'),
    getOpenRouterKeyPath: () => path.join(app.getPath('userData'), 'openrouter_key.json'),
    getKimiKeyPath: () => path.join(app.getPath('userData'), 'kimi_key.json'),
    getThinkingSettingsPath: () => path.join(app.getPath('userData'), 'thinking_settings.json'),
    getGeminiPreferencePath: () => path.join(app.getPath('userData'), 'gemini_preference.json'),
    getVoiceAssistantModePath: () => path.join(app.getPath('userData'), 'voice_assistant_mode.json'),
    getVoiceProviderPath: () => path.join(app.getPath('userData'), 'voice_provider_preference.json'),
    getChatsPath: () => path.join(app.getPath('userData'), 'chats.json'),
    getCustomModelsPath: () => path.join(app.getPath('userData'), 'custom_models.json'),
    getWhatsAppSettingsPath: () => path.join(app.getPath('userData'), 'whatsapp_settings.json'),
    getGoogleAuthPath: () => path.join(app.getPath('userData'), 'google_oauth.json'),
  };
}

module.exports = { createPaths };
