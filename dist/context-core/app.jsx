const { useState, useEffect, useRef } = React;
const { motion, AnimatePresence } = window.Motion;

// --- Mock Data Generators ---
const INTENTS = [
  "Designing futuristic AI dashboard",
  "Researching AI systems",
  "Building automation workflow",
  "Fixing Electron errors",
  "Enhancing UI animations",
  "Optimizing memory core"
];

const TOOLS = [
  { id: 'browser', name: 'Browser Agent', icon: 'Globe' },
  { id: 'vision', name: 'Vision AI', icon: 'Eye' },
  { id: 'memory', name: 'Memory Core', icon: 'Database' },
  { id: 'automation', name: 'Automation Engine', icon: 'Cpu' },
  { id: 'voice', name: 'Voice Engine', icon: 'Mic' }
];

const ICONS = {
  Globe: () => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>,
  Eye: () => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>,
  Database: () => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path></svg>,
  Cpu: () => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect><rect x="9" y="9" width="6" height="6"></rect><line x1="9" y1="1" x2="9" y2="4"></line><line x1="15" y1="1" x2="15" y2="4"></line><line x1="9" y1="20" x2="9" y2="23"></line><line x1="15" y1="20" x2="15" y2="23"></line><line x1="20" y1="9" x2="23" y2="9"></line><line x1="20" y1="14" x2="23" y2="14"></line><line x1="1" y1="9" x2="4" y2="9"></line><line x1="1" y1="14" x2="4" y2="14"></line></svg>,
  Mic: () => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>,
  BrainCircuit: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4.5a2.5 2.5 0 0 0-4.96-.46 2.5 2.5 0 0 0-1.98 3 2.5 2.5 0 0 0-1.32 4.24 3 3 0 0 0 .34 5.58 2.5 2.5 0 0 0 2.96 3.08 2.5 2.5 0 0 0 4.91.05L12 20V4.5Z"/><path d="M16 8V5c0-1.1.9-2 2-2"/><path d="M12 13h4"/><path d="M12 17h6"/><path d="M19 13v8"/><path d="M22 17h-3"/><path d="M19 5v4"/></svg>,
  Zap: () => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>,
  Activity: () => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
};

const App = () => {
  const [understanding, setUnderstanding] = useState(89);
  const [intent, setIntent] = useState(INTENTS[0]);
  const [activeTools, setActiveTools] = useState(['memory', 'automation']);
  const [memories, setMemories] = useState([
    { id: 1, text: "Loaded Context Core module", time: "Just now" },
    { id: 2, text: "Recognized user: M. Muzammil Qadri", time: "1m ago" },
    { id: 3, text: "Stored UI preference: Dark Mode", time: "2m ago" }
  ]);

  // --- Real-time Simulation ---
  useEffect(() => {
    const interval = setInterval(() => {
      // Fluctuate understanding meter slightly
      setUnderstanding(prev => {
        const delta = Math.floor(Math.random() * 5) - 2;
        return Math.min(100, Math.max(70, prev + delta));
      });

      // Randomly change intent
      if (Math.random() > 0.8) {
        setIntent(INTENTS[Math.floor(Math.random() * INTENTS.length)]);
      }

      // Randomly toggle tools
      if (Math.random() > 0.7) {
        const toolToToggle = TOOLS[Math.floor(Math.random() * TOOLS.length)].id;
        setActiveTools(prev => 
          prev.includes(toolToToggle) 
            ? prev.filter(t => t !== toolToToggle)
            : [...prev, toolToToggle]
        );
      }

      // Add a new memory occasionally
      if (Math.random() > 0.85) {
        const newMemories = [
          "Learned new user workflow",
          "Cached Electron IPC handlers",
          "Analyzed Jarvis Overlay state",
          "Synced with Vision AI",
          "Updated neural weights",
          "Saved project context snapshot"
        ];
        const newMem = newMemories[Math.floor(Math.random() * newMemories.length)];
        
        setMemories(prev => {
          const updated = [{ id: Date.now(), text: newMem, time: "Just now" }, ...prev];
          return updated.slice(0, 5); // Keep last 5
        });
      }

    }, 2500);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full h-full min-h-[400px] p-4 flex flex-col gap-4 text-sm">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center">
            <div className="absolute w-8 h-8 rounded-full border border-secondary animate-spin" style={{ animationDuration: '3s' }}></div>
            <div className="absolute w-6 h-6 rounded-full border border-primary animate-spin" style={{ animationDuration: '2s', animationDirection: 'reverse' }}></div>
            {ICONS.BrainCircuit()}
          </div>
          <h1 className="text-secondary font-mono tracking-widest font-bold uppercase text-lg" style={{ textShadow: '0 0 10px rgba(0,229,255,0.5)' }}>
            Context Core
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-secondary animate-ping"></div>
          <span className="text-secondary/80 font-mono text-xs">LIVE</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 flex-grow">
        
        {/* Left Column */}
        <div className="flex flex-col gap-4">
          
          {/* Current Session */}
          <div className="glass-panel neon-border rounded-xl p-4 flex flex-col gap-3 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-primary/20 rounded-full blur-xl -mr-8 -mt-8"></div>
            <h2 className="text-xs font-mono text-primary uppercase font-bold tracking-wider border-b border-primary/20 pb-2 mb-1">
              Current Session
            </h2>
            <div className="flex flex-col gap-2 font-mono text-[11px] text-gray-300">
              <div className="flex justify-between items-center">
                <span className="text-gray-500">USER</span>
                <span className="text-secondary truncate ml-2">Muhammad Muzammil Qadri</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">PROJECT</span>
                <span className="text-white truncate ml-2">Qadri AI OS v1.0.25</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">FOCUS</span>
                <span className="text-white truncate ml-2">Context Dashboard</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">MODE</span>
                <span className="text-accent truncate ml-2 drop-shadow-[0_0_5px_rgba(255,60,172,0.5)]">System Control</span>
              </div>
            </div>
          </div>

          {/* Context Understanding Meter */}
          <div className="glass-panel rounded-xl p-4 flex flex-col gap-3">
            <h2 className="text-xs font-mono text-primary uppercase font-bold tracking-wider flex items-center gap-2">
              {ICONS.Activity()} Understanding
            </h2>
            <div className="flex items-center gap-4">
              <div className="relative w-16 h-16 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="text-gray-800"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                  />
                  <motion.path
                    className="text-secondary drop-shadow-[0_0_3px_rgba(0,229,255,0.8)]"
                    strokeDasharray={`${understanding}, 100`}
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    initial={{ strokeDasharray: "0, 100" }}
                    animate={{ strokeDasharray: `${understanding}, 100` }}
                    transition={{ duration: 0.5 }}
                  />
                </svg>
                <div className="absolute font-mono text-sm font-bold text-white">{understanding}%</div>
              </div>
              <div className="flex-1 flex flex-col gap-1">
                <span className="text-[10px] text-gray-400 font-mono">NEURAL SYNC</span>
                <div className="h-1 w-full bg-gray-800 rounded-full overflow-hidden">
                  <motion.div className="h-full bg-primary" animate={{ width: `${understanding}%` }} transition={{duration: 0.5}} />
                </div>
                <span className="text-[10px] text-gray-400 font-mono mt-1">INTENT MATCH</span>
                <div className="h-1 w-full bg-gray-800 rounded-full overflow-hidden">
                  <motion.div className="h-full bg-accent" animate={{ width: `${Math.min(100, understanding + 5)}%` }} transition={{duration: 0.5}} />
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Right Column */}
        <div className="flex flex-col gap-4">
          
          {/* Active Tools */}
          <div className="glass-panel rounded-xl p-4 flex flex-col gap-3">
            <h2 className="text-xs font-mono text-primary uppercase font-bold tracking-wider">
              Active Engines
            </h2>
            <div className="flex flex-wrap gap-2">
              {TOOLS.map(tool => {
                const isActive = activeTools.includes(tool.id);
                return (
                  <motion.div 
                    key={tool.id}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded-md border text-[10px] font-mono transition-colors duration-300
                      ${isActive ? 'bg-secondary/10 border-secondary/50 text-secondary' : 'bg-gray-900/50 border-gray-800 text-gray-500'}`}
                    animate={{ scale: isActive ? 1.05 : 1 }}
                  >
                    {isActive ? (
                      <div className="relative">
                        <div className="absolute inset-0 bg-secondary blur-sm rounded-full opacity-50"></div>
                        <div className="relative">{ICONS[tool.icon]()}</div>
                      </div>
                    ) : ICONS[tool.icon]()}
                    {tool.name}
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Current Intent Analysis */}
          <div className="glass-panel rounded-xl p-3 flex flex-col gap-2 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent"></div>
            <span className="text-[10px] font-mono text-gray-500">CURRENT INTENT DETECTED:</span>
            <AnimatePresence mode="wait">
              <motion.div 
                key={intent}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="font-mono text-xs text-white flex items-center gap-2"
              >
                {ICONS.Zap()}
                {intent}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Memory Stream */}
          <div className="glass-panel rounded-xl p-4 flex flex-col gap-3 flex-grow relative overflow-hidden">
            <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-secondary/5 to-transparent pointer-events-none"></div>
            <h2 className="text-xs font-mono text-primary uppercase font-bold tracking-wider flex items-center gap-2 border-b border-primary/20 pb-2">
              {ICONS.Database()} Live Memory Stream
            </h2>
            <div className="flex flex-col gap-2 overflow-hidden h-full relative">
              <AnimatePresence>
                {memories.map((mem, i) => (
                  <motion.div 
                    key={mem.id}
                    initial={{ opacity: 0, x: -20, height: 0 }}
                    animate={{ opacity: 1, x: 0, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className={`flex flex-col gap-1 py-1 ${i !== memories.length - 1 ? 'border-b border-gray-800/50' : ''}`}
                  >
                    <span className="font-mono text-[11px] text-gray-300 flex items-center gap-2">
                      <span className="w-1 h-1 rounded-full bg-secondary"></span>
                      {mem.text}
                    </span>
                    <span className="font-mono text-[9px] text-gray-600 pl-3">{mem.time}</span>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>

        </div>
      </div>
      
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
