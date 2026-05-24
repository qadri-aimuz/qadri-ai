# Changelog

All notable changes to the Qadri AI project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.54] - 2026-05-24

### Added
- **Ghost Developer (VS Code Autonomy)**: Empowered Qadri AI to autonomously scaffold application files, launch VS Code (`code .`), and execute the newly created code live on the user's desktop when asked to build apps or websites.

### Enhanced
- **Male Voice Persona**: Massively enhanced the system instructions to maintain a deep, serious, intelligent, and highly professional masculine tone, ensuring a more authoritative and respectful voice interaction.
- **Soul Characters**: Deeply enhanced the underlying system prompts for all AI "Soul" characters (Loyal Butler, Sarcastic Friend, Military Ops Commander, Mysterious Oracle) to produce richer, highly accurate, and deeply immersive responses.


## [1.0.51] - 2026-05-24

### Added
- Integrated `electron-updater` for automatic background downloading and installation of new updates.
- Added GitHub Actions CI/CD pipeline (`release.yml`) for automated `.exe` building and GitHub Releases deployment.
- Configured GitHub publish provider in `package.json` to push to `qadri-aimuz/qadri-ai`.

### Changed
- Refactored `electron/main.js` to automatically invoke `autoUpdater.checkForUpdatesAndNotify()` upon initialization.
- Ignored build artifacts and `node_modules/` via `.gitignore` to prevent path-length limitations in Git.

### Fixed
- Fixed initial git deployment error regarding `src refspec main does not match any`.

