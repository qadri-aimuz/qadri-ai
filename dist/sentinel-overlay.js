// Sentinel Overlay Frontend Logic

(function() {
    // 1. Removed Floating Button (Button is now in Context Core)

    // 2. Inject Overlay DOM
    const overlay = document.createElement('div');
    overlay.id = 'sentinel-overlay';
    overlay.innerHTML = `
        <div class="sentinel-hologram"></div>
        <div class="sentinel-scanline"></div>
        <div class="sentinel-header">
            <div class="sentinel-title">
                <button class="sentinel-back-btn" title="Go Back">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                    BACK
                </button>
                <div style="width: 1px; height: 16px; background: rgba(0,229,255,0.3); margin: 0 5px;"></div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                Qadri Sentinel Console
            </div>
            <div class="sentinel-controls">
                <div class="sentinel-status">
                    <div class="sentinel-status-dot"></div>
                    HYBRID AI LINK ACTIVE
                </div>
                <button class="sentinel-close-btn">ESC TO CLOSE</button>
            </div>
        </div>
        
        <!-- Live AI Monitor Panel -->
        <div id="sentinel-telemetry-panel" style="position: absolute; top: 60px; right: 20px; background: rgba(0, 10, 20, 0.85); border: 1px solid rgba(0,229,255,0.3); border-radius: 8px; padding: 10px; width: 250px; font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #00E5FF; display: flex; flex-direction: column; gap: 5px; z-index: 20; box-shadow: 0 0 15px rgba(0,229,255,0.1); backdrop-filter: blur(5px);">
            <div style="font-weight: bold; border-bottom: 1px solid rgba(0,229,255,0.3); padding-bottom: 5px; margin-bottom: 5px; display: flex; justify-content: space-between;">
                <span>OS TELEMETRY</span>
                <span id="telemetry-ping" style="color: #00ff66;">12ms</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
                <span>Active Agents:</span>
                <span id="telemetry-agents" style="color: #fff;">0</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
                <span>Memory Used:</span>
                <span id="telemetry-memory" style="color: #fff;">0 KB</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
                <span>Active Workflows:</span>
                <span id="telemetry-workflows" style="color: #fcee0a;">0</span>
            </div>
        </div>

        <div id="sentinel-terminal-container" style="position: relative;">
            <div id="ghost-suggestion" style="position: absolute; color: rgba(255,255,255,0.3); pointer-events: none; font-family: 'JetBrains Mono', monospace; font-size: 14px; display: none; z-index: 10;"></div>
        </div>
    `;
    document.body.appendChild(overlay);

    let aiModeActive = true;
    let commandCache = {};
    const localWorkflows = {
        "check internet": ["ipconfig /all", "netstat -ano", "ping google.com"],
        "system health": ["tasklist", "Get-Service", "systeminfo"],
        "check startup apps": ["wmic startup get caption,command"]
    };

    let term = null;
    let fitAddon = null;
    let isTermInitialized = false;
    let commandBuf = '';
    let isProcessing = false;
    
    // Commands List for Auto-completion
    const COMMANDS = ['help', 'clear', 'cls', 'sysinfo', 'nmap', 'decrypt', 'sqlmap', 'msfconsole', 'matrix', 'ask', 'netstat'];

    // Advanced Features: History
    let commandHistory = [];
    let historyIndex = -1;

    function playBeep(type) {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            if (type === 'type') {
                osc.type = 'sine';
                osc.frequency.setValueAtTime(800, ctx.currentTime);
                gain.gain.setValueAtTime(0.01, ctx.currentTime);
                osc.start();
                osc.stop(ctx.currentTime + 0.02);
            } else if (type === 'success') {
                osc.type = 'square';
                osc.frequency.setValueAtTime(1200, ctx.currentTime);
                gain.gain.setValueAtTime(0.05, ctx.currentTime);
                osc.start();
                osc.stop(ctx.currentTime + 0.1);
            } else if (type === 'error') {
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(200, ctx.currentTime);
                gain.gain.setValueAtTime(0.05, ctx.currentTime);
                osc.start();
                osc.stop(ctx.currentTime + 0.3);
            }
        } catch(e) {}
    }

    async function playBootSequence() {
        isProcessing = true;
        term.clear();
        const logo = [
            "  ____   _    ____  ____  ___    _    ___ ",
            " / ___| / \\  |  _ \\|  _ \\|_ _|  / \\  |_ _|",
            "| |  _ / _ \\ | | | | |_) || |  / _ \\  | | ",
            "| |_| / ___ \\| |_| |  _ < | | / ___ \\ | | ",
            " \\____/_/   \\_\\____/|_| \\_\\___/_/   \\_\\___|"
        ];
        for(let line of logo) {
            term.writeln('\x1b[36m' + line + '\x1b[0m');
            playBeep('type');
            await new Promise(r => setTimeout(r, 70));
        }
        
        term.writeln('');
        const steps = [
            "Loading Kernel modules...",
            "Mounting virtual file systems...",
            "Initializing Neural Cores...",
            "Establishing secure uplink...",
            "Bypassing firewall protocols...",
            "Access Granted. Welcome to Qadri Sentinel."
        ];
        for (let step of steps) {
            term.writeln(`\x1b[32m[OK]\x1b[0m ${step}`);
            playBeep('type');
            await new Promise(r => setTimeout(r, 200));
        }
        playBeep('success');
        term.write('\r\n\x1b[36mSENTINEL>\x1b[0m ');
        isProcessing = false;
    }

    // Load xterm scripts
    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = src;
            s.onload = resolve;
            s.onerror = reject;
            document.head.appendChild(s);
        });
    }

    async function initTerminal() {
        if (isTermInitialized) return;
        
        try {
            await loadScript('https://cdn.jsdelivr.net/npm/xterm@5.3.0/lib/xterm.js');
            await loadScript('https://cdn.jsdelivr.net/npm/xterm-addon-fit@0.8.0/lib/xterm-addon-fit.js');
        } catch (e) {
            console.error('Failed to load xterm.js', e);
            return;
        }

        term = new Terminal({
            cursorBlink: true,
            cursorStyle: 'block',
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: 14,
            theme: {
                background: 'transparent',
                foreground: '#00E5FF',
                cursor: '#FF3CAC',
                selectionBackground: 'rgba(255, 60, 172, 0.3)',
                black: '#000000',
                red: '#ff003c',
                green: '#00ff66',
                yellow: '#fcee0a',
                blue: '#00E5FF',
                magenta: '#FF3CAC',
                cyan: '#00E5FF',
                white: '#ffffff',
            },
            allowTransparency: true
        });

        fitAddon = new FitAddon.FitAddon();
        term.loadAddon(fitAddon);

        const container = document.getElementById('sentinel-terminal-container');
        term.open(container);
        fitAddon.fit();

        isTermInitialized = true;

        // Attach CRT Flicker to terminal
        container.classList.add('crt-flicker');

        // Play Boot Sequence
        playBootSequence();

        if (window.electronAPI) {
            window.electronAPI.startSentinelTerminal();

            window.electronAPI.onSentinelTerminalData((data) => {
                if (!isProcessing) {
                    term.write(data);
                } else {
                    term.write(data);
                }
            });

            // Handle Right-Click: Copy if selected, Paste if not
            container.addEventListener('contextmenu', async (e) => {
                e.preventDefault();
                if (term.hasSelection()) {
                    await window.electronAPI.writeClipboard(term.getSelection());
                    term.clearSelection();
                } else {
                    try {
                        const text = await window.electronAPI.readClipboard();
                        if (!isProcessing && text) {
                            const cleanText = text.replace(/\r?\n/g, ' ');
                            commandBuf += cleanText;
                            term.write(cleanText);
                        }
                    } catch(err) {}
                }
            });

            // Handle Ctrl+C for Copy
            term.attachCustomKeyEventHandler(async (e) => {
                if (e.ctrlKey && e.code === 'KeyC' && e.type === 'keydown') {
                    if (term.hasSelection()) {
                        await window.electronAPI.writeClipboard(term.getSelection());
                        term.clearSelection();
                        return false;
                    }
                }
                return true;
            });

            term.onData((data) => {
                if (isProcessing) return; // block input while AI translates

                // Handle multi-character paste or typing
                if (data.length > 1 && !data.includes('\x1b')) {
                    const cleanText = data.replace(/\r?\n/g, ' ');
                    commandBuf += cleanText;
                    term.write(cleanText);
                    return;
                }

                const char = data;
                if (char === '\r') { // Enter
                    term.write('\r\n');
                    const cmd = commandBuf.trim();
                    commandBuf = '';
                    if (cmd) {
                        commandHistory.push(cmd);
                        historyIndex = commandHistory.length;
                        processInput(cmd);
                    } else {
                        term.write('\x1b[36mSENTINEL>\x1b[0m ');
                    }
                } else if (char === '\u007F') { // Backspace
                    if (commandBuf.length > 0) {
                        commandBuf = commandBuf.slice(0, -1);
                        term.write('\b \b');
                    }
                } else if (char === '\t') { // Tab Completion
                    if (commandBuf.length > 0) {
                        const matches = COMMANDS.filter(c => c.startsWith(commandBuf.toLowerCase()));
                        if (matches.length === 1) {
                            while(commandBuf.length > 0) {
                                term.write('\b \b');
                                commandBuf = commandBuf.slice(0, -1);
                            }
                            commandBuf = matches[0];
                            term.write(commandBuf);
                            playBeep('success');
                        } else if (matches.length > 1) {
                            term.write('\r\n');
                            term.writeln(matches.join('  '));
                            term.write('\x1b[36mSENTINEL>\x1b[0m ' + commandBuf);
                        }
                    }
                } else if (char === '\x1b[A') { // Up Arrow
                    if (commandHistory.length > 0 && historyIndex > 0) {
                        historyIndex--;
                        // Clear current line buffer on screen
                        while(commandBuf.length > 0) {
                            term.write('\b \b');
                            commandBuf = commandBuf.slice(0, -1);
                        }
                        commandBuf = commandHistory[historyIndex];
                        term.write(commandBuf);
                    }
                } else if (char === '\x1b[B') { // Down Arrow
                    if (historyIndex < commandHistory.length - 1) {
                        historyIndex++;
                        while(commandBuf.length > 0) {
                            term.write('\b \b');
                            commandBuf = commandBuf.slice(0, -1);
                        }
                        commandBuf = commandHistory[historyIndex];
                        term.write(commandBuf);
                    } else {
                        historyIndex = commandHistory.length;
                        while(commandBuf.length > 0) {
                            term.write('\b \b');
                            commandBuf = commandBuf.slice(0, -1);
                        }
                    }
                } else if (char >= String.fromCharCode(0x20) && char <= String.fromCharCode(0x7E)) {
                    // Printable chars
                    commandBuf += char;
                    term.write(char);
                    playBeep('type');
                    
                    // Ghost Suggestion Logic
                    const ghost = document.getElementById('ghost-suggestion');
                    if (ghost) {
                        const lwr = commandBuf.toLowerCase();
                        if (lwr === 'check') {
                            term.writeln('');
                            term.writeln('\x1b[90m  - check internet connections\x1b[0m');
                            term.writeln('\x1b[90m  - check system health\x1b[0m');
                            term.writeln('\x1b[90m  - check startup applications\x1b[0m');
                            term.writeln('\x1b[90m  - check firewall status\x1b[0m');
                            term.write('\x1b[4A'); // Move cursor up 4 lines
                            term.write(`\x1b[${9 + commandBuf.length}C`); // Move cursor right to end of prompt
                        }
                    }
                }
            });
        }
    }

    // Command Parser / AI Router
    async function processInput(input) {
        const firstWord = input.split(' ')[0].toLowerCase();

        // Native Web Terminal Commands
        if (firstWord === 'clear' || firstWord === 'cls') {
            term.clear();
            term.write('\x1b[36mSENTINEL>\x1b[0m ');
            return;
        }

        if (firstWord === 'help') {
            term.writeln('\x1b[35m=== QADRI SENTINEL SYSTEM HELP ===\x1b[0m');
            term.writeln(' \x1b[36mhelp\x1b[0m       - Show this menu');
            term.writeln(' \x1b[36mclear\x1b[0m      - Clear the terminal screen');
            term.writeln(' \x1b[36msysinfo\x1b[0m    - Real-time Cyberpunk System Telemetry');
            term.writeln(' \x1b[36mask\x1b[0m        - Directly ask Gemini AI a question (e.g. ask how to hack WEP)');
            term.writeln(' \x1b[36mnmap\x1b[0m       - (Simulated) Run deep network infiltration scan');
            term.writeln(' \x1b[36mdecrypt\x1b[0m    - (Simulated) Crack encrypted hashes and payloads');
            term.writeln(' \x1b[36msqlmap\x1b[0m     - (Simulated) Automated SQL injection and database takeover tool');
            term.writeln(' \x1b[36mmsfconsole\x1b[0m - (Simulated) Launch Metasploit Framework');
            term.writeln(' \x1b[36mnetstat\x1b[0m    - (Simulated) View Active Network Connections');
            term.writeln(' \x1b[36mmatrix\x1b[0m     - Toggle Matrix Hacker visual mode');
            term.writeln(' \x1b[32m<Any NL>\x1b[0m   - Natural Language AI Execution (e.g. "Check my IP")');
            term.writeln(' \x1b[33m<Native>\x1b[0m   - Direct PowerShell execution (e.g. "dir")');
            term.write('\r\n\x1b[36mSENTINEL>\x1b[0m ');
            return;
        }

        if (firstWord === 'nmap') {
            isProcessing = true;
            term.writeln('\x1b[35m[AI]\x1b[0m Initiating NMAP Stealth Scan (SYN Stealth)...');
            let msgs = [
                "Scanning 1000 ports on target...",
                "Discovered open port 22/tcp on 192.168.1.101",
                "Discovered open port 80/tcp on 192.168.1.101",
                "Discovered open port 443/tcp on 192.168.1.101",
                "Bypassing IDS/IPS signatures...",
                "Scan complete: 3 open ports, 997 filtered."
            ];
            let i = 0;
            let interval = setInterval(() => {
                if (i < msgs.length) {
                    term.writeln(`\x1b[32m[+] ${msgs[i]}\x1b[0m`);
                    i++;
                } else {
                    clearInterval(interval);
                    isProcessing = false;
                    term.write('\r\n\x1b[36mSENTINEL>\x1b[0m ');
                }
            }, 600);
            return;
        }

        if (firstWord === 'decrypt') {
            isProcessing = true;
            term.writeln('\x1b[35m[AI]\x1b[0m Launching brute-force decryption matrix...');
            let counter = 0;
            let interval = setInterval(() => {
                const garbage = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
                term.write(`\r\x1b[31m[CRACKING] ${garbage}\x1b[0m`);
                counter++;
                if (counter > 15) {
                    clearInterval(interval);
                    term.write('\r\x1b[2K'); // clear line
                    term.writeln('\x1b[32m[SUCCESS] Hash decrypted: QadriAI_Admin_123\x1b[0m');
                    isProcessing = false;
                    term.write('\r\n\x1b[36mSENTINEL>\x1b[0m ');
                }
            }, 150);
            return;
        }

        if (firstWord === 'sqlmap') {
            isProcessing = true;
            term.writeln('\x1b[35m[AI]\x1b[0m Starting automated SQL injection...');
            let msgs = [
                "Testing connection to target database...",
                "Payload: 1' OR '1'='1 --",
                "Testing blind SQL injection (time-based)...",
                "[+] Vulnerability confirmed in 'id' parameter",
                "Fetching database names...",
                "Database found: 'qadri_secure_db'",
                "Dumping admin credentials...",
                "[SUCCESS] Admin hash retrieved! Run 'decrypt' to crack it."
            ];
            let i = 0;
            let interval = setInterval(() => {
                if (i < msgs.length) {
                    term.writeln(`\x1b[33m[*] ${msgs[i]}\x1b[0m`);
                    i++;
                } else {
                    clearInterval(interval);
                    isProcessing = false;
                    term.write('\r\n\x1b[36mSENTINEL>\x1b[0m ');
                }
            }, 700);
            return;
        }

        if (firstWord === 'msfconsole') {
            isProcessing = true;
            term.writeln('\x1b[31m');
            term.writeln('      .:okOOOkdc\'           \'cdkOOOko:.    ');
            term.writeln('    .xOOOOOOOOOOOOc       cOOOOOOOOOOOOx.  ');
            term.writeln('   :OOOOOOOOOOOOOOOk,   ,kOOOOOOOOOOOOOOO: ');
            term.writeln('  \'OOOOOOOOOkkkkOOOOO: :OOOOOkkkkOOOOOOOOO\'');
            term.writeln('  oOOOOOOOO.    .oOOOOoOOOOl.    .OOOOOOOOo');
            term.writeln('  dOOOOOOOO.      .cOOOOOc.      .OOOOOOOOd');
            term.writeln('  lOOOOOOOO.         ;d;         .OOOOOOOOl');
            term.writeln('  .OOOOOOOO.   .;           ;.   .OOOOOOOO.');
            term.writeln('   cOOOOOOO.   .OOc.     \'oOO.   .OOOOOOOc ');
            term.writeln('    oOOOOOO.   .OOOO.   :OOOO.   .OOOOOOo  ');
            term.writeln('     cOOOOO.   .OOOO.   :OOOO.   .OOOOOc   ');
            term.writeln('\x1b[0m');
            term.writeln('\x1b[31m=[ metasploit v6.4.1-dev-                         ]\x1b[0m');
            term.writeln('\x1b[31m+ -- --=[ 2380 exploits - 1232 auxiliary - 424 post       ]\x1b[0m');
            term.writeln('\x1b[31m+ -- --=[ 1388 payloads - 46 encoders - 11 nops           ]\x1b[0m');
            setTimeout(() => {
                term.writeln('\x1b[34mmsf6 > \x1b[0m Exploit framework loaded. Ready to deploy payload.');
                isProcessing = false;
                term.write('\r\n\x1b[36mSENTINEL>\x1b[0m ');
            }, 1000);
            return;
        }

        if (firstWord === 'matrix') {
            const currentTheme = term.options.theme || {};
            if (currentTheme.foreground === '#00ff00') {
                // Restore default theme
                term.options.theme = {
                    background: 'rgba(10, 13, 20, 0.9)',
                    foreground: '#e2e8f0',
                    cursor: '#00e5ff',
                    selectionBackground: 'rgba(0, 229, 255, 0.3)'
                };
                term.writeln('\x1b[35m[AI]\x1b[0m Matrix Mode \x1b[31mDISABLED\x1b[0m.');
            } else {
                // Apply Matrix theme
                term.options.theme = {
                    background: '#000000',
                    foreground: '#00ff00',
                    cursor: '#00ff00',
                    selectionBackground: 'rgba(0, 255, 0, 0.3)'
                };
                term.writeln('\x1b[35m[AI]\x1b[0m Matrix Mode \x1b[32mACTIVATED\x1b[0m. Welcome to the real world.');
            }
            term.write('\r\n\x1b[36mSENTINEL>\x1b[0m ');
            return;
        }

        if (firstWord === 'ask') {
            const query = input.slice(4).trim();
            if (!query) {
                term.writeln('\x1b[31m[ERROR]\x1b[0m Usage: ask [your question]');
                term.write('\r\n\x1b[36mSENTINEL>\x1b[0m ');
                return;
            }
            isProcessing = true;
            term.writeln('\x1b[35m[AI]\x1b[0m Querying Neural Matrix...');
            try {
                const res = await window.electronAPI.askAI(query);
                if (res.error) {
                    term.writeln(`\x1b[31m[ERROR]\x1b[0m ${res.error}`);
                    playBeep('error');
                } else {
                    playBeep('success');
                    const lines = res.answer.split('\n');
                    for (let l of lines) {
                        term.writeln(`\x1b[32m${l}\x1b[0m`);
                    }
                }
            } catch (err) {
                term.writeln(`\x1b[31m[ERROR]\x1b[0m ${err.message}`);
                playBeep('error');
            }
            isProcessing = false;
            term.write('\r\n\x1b[36mSENTINEL>\x1b[0m ');
            return;
        }

        if (firstWord === 'netstat') {
            isProcessing = true;
            term.writeln('\x1b[36mActive Connections\x1b[0m');
            term.writeln('  Proto  Local Address          Foreign Address        State');
            term.writeln('  TCP    192.168.1.101:443      104.21.44.11:51234     ESTABLISHED');
            term.writeln('  TCP    192.168.1.101:22       198.51.100.4:56789     ESTABLISHED');
            term.writeln('  UDP    0.0.0.0:53             *:*                               ');
            setTimeout(() => {
                isProcessing = false;
                term.write('\r\n\x1b[36mSENTINEL>\x1b[0m ');
            }, 500);
            return;
        }

        if (firstWord === 'sysinfo') {
            isProcessing = true;
            term.writeln('\x1b[36m> FETCHING REAL-TIME SYSTEM TELEMETRY...\x1b[0m');
            try {
                const info = await window.electronAPI.getSysInfo();
                const memGb = (info.totalMem / 1024 / 1024 / 1024).toFixed(2);
                const freeGb = (info.freeMem / 1024 / 1024 / 1024).toFixed(2);
                term.writeln(`\x1b[32m[SYS] Hostname: ${info.hostname}\x1b[0m`);
                term.writeln(`\x1b[32m[SYS] OS: ${info.platform} ${info.release} (${info.arch})\x1b[0m`);
                term.writeln(`\x1b[32m[SYS] CPU: ${info.cpus} Cores - ${info.cpuModel}\x1b[0m`);
                term.writeln(`\x1b[32m[SYS] RAM: ${freeGb} GB Free / ${memGb} GB Total\x1b[0m`);
                term.writeln(`\x1b[35m[AI] Hybrid Translation Pipeline: Active\x1b[0m`);
                playBeep('success');
            } catch (err) {
                term.writeln('\x1b[31m[ERROR] Failed to fetch telemetry.\x1b[0m');
                playBeep('error');
            }
            isProcessing = false;
            term.write('\r\n\x1b[36mSENTINEL>\x1b[0m ');
            return;
        }

        // Loop Prevention
        if (/^\[(AI|SYSTEM|OK|ERROR|WARNING|BLOCKED|REASON)\]/i.test(input)) return;

        // Confidence Score & Detection Engine
        function isDirectCommand(cmd) {
            const directCommands = ['dir', 'cd', 'cls', 'tree', 'mkdir', 'rmdir', 'copy', 'move', 'del', 'type', 'findstr', 'where', 'ping', 'ipconfig', 'tasklist', 'taskkill', 'get-service', 'get-process', 'systeminfo', 'wmic', 'netstat', 'nslookup', 'tracert', 'whoami', 'hostname', 'shutdown', 'get-eventlog', 'get-psdrive', 'netsh', 'winget', 'curl', 'python', 'node', 'npm', 'git', 'code', 'powershell', 'sfc', 'dism', 'chkdsk', 'echo'];
            const first = cmd.split(' ')[0].toLowerCase();
            
            if (directCommands.includes(first)) return true;
            if (cmd.includes('|') || cmd.includes('>') || cmd.includes('>>') || cmd.includes('&&')) return true;
            if (cmd.includes('.exe') || cmd.includes('.ps1')) return true;
            if (/^[a-zA-Z]:\\/.test(cmd) || cmd.startsWith('./') || cmd.startsWith('.\\')) return true;
            if (cmd.includes(' /') || cmd.includes(' -')) return true;
            
            return false;
        }

        function commandConfidence(cmd) {
            if (isDirectCommand(cmd)) return { confidence: 99, type: 'local' };
            return { confidence: 95, type: 'ai' };
        }

        const analysis = commandConfidence(input);

        // Clear ghost suggestions if any
        term.write('\x1b[0J'); 

        if (analysis.type === 'local') {
            window.electronAPI.writeSentinelTerminal(input + '\r\n');
            setTimeout(() => { term.write('\r\n\x1b[36mSENTINEL>\x1b[0m '); }, 500);
        } else {
            // Local Workflow Library Check (always checked first)
            for (const [key, commands] of Object.entries(localWorkflows)) {
                if (input.toLowerCase().includes(key)) {
                    term.writeln(`\x1b[35m[LOCAL AI]\x1b[0m Executing built-in workflow for '${key}'...`);
                    for (const cmd of commands) {
                        window.electronAPI.writeSentinelTerminal(cmd + '\r\n');
                    }
                    setTimeout(() => { term.write('\r\n\x1b[36mSENTINEL>\x1b[0m '); }, 1000);
                    return;
                }
            }

            // Command Cache Check (always checked next)
            const lowerInput = input.toLowerCase();
            if (commandCache[lowerInput]) {
                term.writeln(`\x1b[35m[AI CACHE]\x1b[0m Using cached workflow...`);
                window.electronAPI.writeSentinelTerminal(commandCache[lowerInput] + '\r\n');
                setTimeout(() => { term.write('\r\n\x1b[36mSENTINEL>\x1b[0m '); }, 1000);
                return;
            }

            // API Fallback / Offline Mode
            if (!aiModeActive) {
                term.writeln(`\x1b[33m[AI OFFLINE]\x1b[0m This complex request requires cloud reasoning. Please wait for API recovery.`);
                setTimeout(() => { term.write('\r\n\x1b[36mSENTINEL>\x1b[0m '); }, 500);
                return;
            }

            isProcessing = true;
            term.writeln(`\x1b[35m[AI]\x1b[0m Analyzing request: "${input}" (Confidence: ${analysis.confidence}% AI intent)...`);
            
            try {
                const translated = await window.electronAPI.invoke('translate-sentinel-command', input);
                
                if (translated.error) {
                    if (translated.error.includes("429") || translated.error.includes("EXHAUSTED") || translated.error.includes("503") || translated.error.includes("UNAVAILABLE")) {
                        term.writeln(`\x1b[31m[AI]\x1b[0m Gemini quota limit reached or servers overloaded.`);
                        term.writeln(`\x1b[33m[AI]\x1b[0m Switching to Local Operations Mode...`);
                        aiModeActive = false;
                        document.querySelector('.sentinel-status').innerHTML = '<div class="sentinel-status-dot" style="background: #ffcc00; box-shadow: 0 0 10px #ffcc00;"></div> LOCAL OPERATIONS MODE';
                    } else {
                        term.writeln(`\x1b[31m[ERROR]\x1b[0m ${translated.error}`);
                    }
                    playBeep('error');
                } else if (translated.blocked) {
                    term.writeln(`\x1b[31m[BLOCKED]\x1b[0m Command violates safety policy.`);
                    term.writeln(`\x1b[33m[REASON]\x1b[0m ${translated.reason}`);
                    playBeep('error');
                } else if (translated.type === 'chat') {
                    playBeep('success');
                    const lines = (translated.answer || '').split('\n');
                    for (let l of lines) {
                        term.writeln(`\x1b[32m${l}\x1b[0m`);
                    }
                } else {
                    term.writeln(`\x1b[32m[AI]\x1b[0m Executing workflow: \x1b[36m${translated.command}\x1b[0m`);
                    if (translated.explanation) {
                        term.writeln(`\x1b[35m[AI]\x1b[0m ${translated.explanation}`);
                    }
                    term.writeln('');
                    
                    // Cache the successful translation
                    commandCache[lowerInput] = translated.command;

                    window.electronAPI.writeSentinelTerminal(translated.command + '\r\n');
                }
            } catch (err) {
                term.writeln(`\x1b[31m[ERROR]\x1b[0m Translation engine offline or failed: ${err.message}`);
            }

            isProcessing = false;
            setTimeout(() => { term.write('\r\n\x1b[36mSENTINEL>\x1b[0m '); }, 1000);
        }
    }

    // Toggle logic
    function openOverlay() {
        overlay.classList.add('active');
        initTerminal();
        // Trigger resize event so fitAddon adjusts
        setTimeout(() => { if (fitAddon) fitAddon.fit(); }, 100);
    }

    function closeOverlay() {
        overlay.classList.remove('active');
    }
    window.openSentinelConsole = openOverlay;
    document.querySelector('.sentinel-close-btn').addEventListener('click', closeOverlay);
    document.querySelector('.sentinel-back-btn').addEventListener('click', closeOverlay);

    // Escape to close
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && overlay.classList.contains('active')) {
            closeOverlay();
        }
    });

    // Resize observer
    window.addEventListener('resize', () => {
        if (overlay.classList.contains('active') && fitAddon) {
            fitAddon.fit();
        }
    });

    // AI Health Monitor
    function startAIHealthMonitor() {
        setInterval(async () => {
            if (!aiModeActive && window.electronAPI && window.electronAPI.checkAIHealth) {
                try {
                    const health = await window.electronAPI.checkAIHealth();
                    if (health.status === 'ok') {
                        aiModeActive = true;
                        document.querySelector('.sentinel-status').innerHTML = '<div class="sentinel-status-dot"></div> HYBRID AI LINK ACTIVE';
                        if (term && overlay.classList.contains('active')) {
                            // Ensure it doesn't interrupt input on same line
                            term.write('\r\x1b[2K'); 
                            term.writeln(`\x1b[32m[AI]\x1b[0m Gemini connection restored.`);
                            term.writeln(`\x1b[32m[AI]\x1b[0m Hybrid AI Mode reactivated.`);
                            if (!isProcessing) {
                                term.write('\x1b[36mSENTINEL>\x1b[0m ' + commandBuf);
                            }
                        }
                    }
                } catch(e) {}
            }
        }, 60000); // Check every 60 seconds
    }
    
    // Start health monitor
    startAIHealthMonitor();

    // OS Telemetry Updater
    setInterval(async () => {
        if (overlay.classList.contains('active') && window.electronAPI && window.electronAPI.getAgentStatus) {
            try {
                const status = await window.electronAPI.getAgentStatus();
                document.getElementById('telemetry-agents').innerText = status.agents ? status.agents.length : 0;
                document.getElementById('telemetry-workflows').innerText = status.workflows ? Object.keys(status.workflows).length : 0;
                
                // Randomize ping slightly for visual effect
                const ping = Math.floor(Math.random() * 15) + 5;
                document.getElementById('telemetry-ping').innerText = `${ping}ms`;
                
                // Update memory mock
                const mem = await window.electronAPI.getMemory('history');
                const memSize = mem ? Math.round(JSON.stringify(mem).length / 1024) : 0;
                document.getElementById('telemetry-memory').innerText = `${memSize} KB`;
            } catch(e) {}
        }
    }, 5000);

    // Proactive Suggestions Engine
    setInterval(() => {
        if (overlay.classList.contains('active') && term && !isProcessing && commandBuf === '') {
            // Check if we should show a suggestion based on memory/habits
            // For now, randomly pop a suggestion 10% of the time during idle
            if (Math.random() < 0.1) {
                term.writeln('');
                term.writeln(`\x1b[35m[AI SUGGESTION]\x1b[0m You usually run SEO workflows at this time.`);
                term.writeln(`\x1b[35m[AI SUGGESTION]\x1b[0m Type \x1b[36m'start seo'\x1b[0m to initiate.`);
                term.write('\x1b[36mSENTINEL>\x1b[0m ');
            }
        }
    }, 45000); // Check every 45s

    // Periodically show AI presence
    setInterval(() => {
        if (overlay.classList.contains('active') && term && !isProcessing && commandBuf === '') {
            const msgs = [
                "Monitoring active agents...",
                "Context memory synchronized.",
                "Sentinel systems operational.",
                "Awaiting next instruction."
            ];
            const msg = msgs[Math.floor(Math.random() * msgs.length)];
            // Erase current prompt
            term.write('\x1b[2K\x1b[G'); 
            term.writeln(`\x1b[90m[AI] ${msg}\x1b[0m`);
            term.write('\x1b[36mSENTINEL>\x1b[0m ');
        }
    }, 15000);

})();
