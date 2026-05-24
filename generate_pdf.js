const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Qadri AI - The Ultimate Guide Book</title>
    <style>
        body { font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #333; line-height: 1.6; margin: 0; padding: 0; background-color: #f9f9f9; }
        .page { background-color: white; padding: 40px 60px; }
        h1 { color: #2c3e50; font-size: 36px; border-bottom: 2px solid #3498db; padding-bottom: 10px; }
        h2 { color: #2980b9; font-size: 24px; margin-top: 30px; }
        h3 { color: #34495e; font-size: 20px; }
        p { margin-bottom: 15px; font-size: 16px; }
        ul { margin-bottom: 20px; padding-left: 20px; }
        li { margin-bottom: 8px; font-size: 16px; }
        .cover { text-align: center; padding-top: 150px; height: 800px; }
        .cover h1 { font-size: 56px; border: none; margin-bottom: 10px; color: #2c3e50; }
        .cover h2 { font-size: 28px; font-weight: normal; color: #7f8c8d; margin-top: 0; }
        .cover p { font-size: 18px; color: #95a5a6; margin-top: 50px; }
        .feature-box { background-color: #f0f7fb; border-left: 4px solid #3498db; padding: 15px; margin-bottom: 20px; }
        .feature-box h3 { margin-top: 0; color: #2980b9; }
        .footer { text-align: center; margin-top: 50px; font-size: 12px; color: #bdc3c7; border-top: 1px solid #eee; padding-top: 20px; }
    </style>
</head>
<body>
    <div class="page cover">
        <h1>Qadri AI</h1>
        <h2>The Ultimate Intelligent Assistant</h2>
        <p>Comprehensive Guide Book & Feature Reference<br>Version 1.0.38</p>
        <div style="margin-top: 100px;">
            <p><strong>Developed by:</strong> Qadri AI Team</p>
            <p><strong>Head / CEO / Founder:</strong> Muzamil</p>
        </div>
    </div>

    <div class="page">
        <h1>Welcome to Qadri AI</h1>
        <p>Welcome to the future of desktop intelligence. Qadri AI is an advanced, privacy-focused, multimodal AI assistant designed by the Qadri AI Team to streamline your workflow, automate your tasks, and act as your ultimate digital companion.</p>
        
        <h2>Core Features & Capabilities</h2>
        
        <div class="feature-box">
            <h3>1. Natural Real-time Voice Chat (Jarvis Mode)</h3>
            <p>Experience seamless, low-latency voice conversations. Qadri AI features a female persona voice (now enhanced with the premium Kore model) that listens continuously and responds with natural human-like emotion.</p>
        </div>

        <div class="feature-box">
            <h3>2. Advanced Desktop Automation</h3>
            <p>Qadri AI has deep integration with your operating system. It can open applications, close processes, manage files, and automate keyboard/mouse inputs directly on your machine.</p>
            <ul>
                <li><strong>WhatsApp Smart Send:</strong> Tell Qadri AI to message someone, and it will automatically open WhatsApp, search for the contact, type your message, and send it.</li>
                <li><strong>Movie Player:</strong> Ask Qadri AI to play a movie, and it will fetch the stream and launch a custom, transparent, ad-free video player overlay right on your screen.</li>
                <li><strong>System Monitoring:</strong> Check your CPU, RAM, battery, and network status instantly.</li>
            </ul>
        </div>

        <div class="feature-box">
            <h3>3. Contextual Screen Telepathy</h3>
            <p>Qadri AI sees what you see. Using local screen capture, the AI can analyze your current window, read error logs, explain code, or summarize whatever is visible on your screen.</p>
        </div>

        <div class="feature-box">
            <h3>4. Persistent "Digital Memory" (Vault)</h3>
            <p>Qadri AI remembers you. Everything important you discuss is saved locally in the <strong>Qadri Data</strong> folder in your Documents. It remembers your preferences, project details, and past conversations seamlessly across sessions.</p>
        </div>
        
        <div class="feature-box">
            <h3>5. Floating Hologram Overlay</h3>
            <p>Press <strong>Ctrl+Shift+J</strong> to summon the Jarvis Overlay anytime, over any full-screen game or application.</p>
        </div>

        <h2>How to Use</h2>
        <p>Once installed, you can access Qadri AI from the system tray or desktop shortcut.</p>
        <ul>
            <li><strong>Wake Word:</strong> Just say the wake word to start speaking.</li>
            <li><strong>Text Chat:</strong> Use the modern UI to type queries, attach files, or drag-and-drop documents.</li>
            <li><strong>Settings:</strong> Click the gear icon to configure API keys, update settings, or customize your persona.</li>
        </ul>

        <div class="footer">
            &copy; 2026 Qadri AI Team. All Rights Reserved. Built with pride by a team of 10 under the leadership of Muzamil.
        </div>
    </div>
</body>
</html>
`;

async function generatePDF() {
    try {
        console.log('Generating PDF Guide Book...');
        
        // Ensure public directory exists
        const publicDir = path.join(__dirname, 'public');
        if (!fs.existsSync(publicDir)) {
            fs.mkdirSync(publicDir, { recursive: true });
        }
        
        const pdfPath = path.join(publicDir, 'Qadri_AI_Guide_Book.pdf');
        
        const browser = await chromium.launch();
        const page = await browser.newPage();
        
        await page.setContent(htmlContent, { waitUntil: 'networkidle' });
        
        await page.pdf({
            path: pdfPath,
            format: 'A4',
            printBackground: true,
            margin: { top: '0', right: '0', bottom: '0', left: '0' }
        });
        
        await browser.close();
        console.log('PDF generated successfully at:', pdfPath);
    } catch (err) {
        console.error('Error generating PDF:', err);
    }
}

generatePDF();
