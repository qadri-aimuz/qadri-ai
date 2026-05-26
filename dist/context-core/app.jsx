const { useState, useEffect } = React;
const { motion } = window.Motion;

const App = () => {
  return (
    <div className="w-full h-screen p-4 flex flex-col gap-4 text-sm relative items-center justify-center">
      <div className="absolute inset-0 pointer-events-none opacity-20 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/30 via-background to-background"></div>
      
      <div className="flex flex-col items-center gap-6 z-10 glass-panel px-8 py-10" style={{ boxShadow: '0 0 20px rgba(0, 229, 255, 0.1)' }}>
        
        <div className="relative flex items-center justify-center text-primary mb-4">
          <div className="absolute w-16 h-16 rounded-full border border-secondary animate-spin" style={{ animationDuration: '3s' }}></div>
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>
        </div>
        
        <h1 className="text-secondary font-bold uppercase tracking-widest text-xl text-center" style={{ textShadow: '0 0 8px rgba(0,229,255,0.5)' }}>
          Qadri Sentinel Center
        </h1>
        
        <p className="text-gray-400 text-center max-w-xs mb-4">
          Access the Fullscreen AI Ethical Operations Terminal to execute powerful diagnostics and hybrid intelligence commands.
        </p>

        <button 
          onClick={() => {
            if (window.parent && window.parent.openSentinelConsole) {
              window.parent.openSentinelConsole();
            } else {
              alert("Sentinel Console module is not loaded correctly in parent window.");
            }
          }}
          className="flex items-center gap-3 px-6 py-3 rounded-md bg-[#07090c] border border-[#00e5ff33] text-[#00e5ff] font-mono tracking-widest hover:bg-[#00e5ff11] transition-all cursor-pointer overflow-hidden relative group"
        >
          <div className="absolute top-0 left-[-100%] w-full h-[2px] bg-gradient-to-r from-transparent via-[#00e5ff] to-transparent group-hover:left-[100%] transition-all duration-1000 ease-in-out"></div>
          <div className="w-2 h-2 rounded-full bg-secondary animate-ping"></div>
          [ OPEN SENTINEL CONSOLE ]
        </button>
      </div>
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
