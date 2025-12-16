
import React, { useState, useRef, useEffect } from 'react';
import { Activity, Power, Code2, PenTool, Search, MessageSquare, ArrowRight, Loader2, FolderDown } from 'lucide-react';
import { Message, Agent } from '../types';
import { generateExport } from '../utils/fileUtils';

interface WheelDashboardProps {
  onStart: (goal: string) => void;
  status: string;
  isProcessing: boolean;
  messages: Message[];
  agents: Agent[];
}

interface Droid {
  id: number;
  x: number;
  y: number;
  scale: number;
  opacity: number;
  rotation: number;
  transitionDuration: number;
  transitionTimingFunction: string;
  blur: number; 
  isActive: boolean; 
  color: string;
}

const WheelDashboard: React.FC<WheelDashboardProps> = ({ onStart, status, isProcessing, messages, agents }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedMode, setSelectedMode] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [hasStarted, setHasStarted] = useState(false);
  const [droids, setDroids] = useState<Droid[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const MODES = [
    { id: 'architect', label: 'Architect', icon: PenTool, color: '#fbbf24', prompt: 'Act as Chief Architect. I need a comprehensive technical plan for: ' },
    { id: 'coder', label: 'Build', icon: Code2, color: '#8b5cf6', prompt: 'Act as Lead Developer. I want to build: ' },
    { id: 'research', label: 'Research', icon: Search, color: '#0ea5e9', prompt: 'Act as Lead Researcher. Investigate the following topic: ' },
    { id: 'chat', label: 'Chat', icon: MessageSquare, color: '#10b981', prompt: '' },
  ];

  const activeMode = MODES.find(m => m.id === selectedMode);
  const themeColor = activeMode ? activeMode.color : '#10b981'; // Default Emerald

  // Initialize Phantom Sensor (Stationary, Cinematic)
  useEffect(() => {
    setDroids([{
      id: 1,
      x: 50, // Dead Center
      y: 30, // Higher up to make room for the wheel
      scale: 1.0, 
      opacity: 1,
      rotation: 0,
      transitionDuration: 1000,
      transitionTimingFunction: 'ease-out',
      blur: 0,
      isActive: false,
      color: '#10b981'
    }]);
  }, []);

  /**
   * Attention Shift: Subtle pulse instead of movement.
   */
  const performAttentionShift = (newColor?: string) => {
    setDroids(prev => {
        const droid = prev[0];
        if (!droid) return prev;

        return [{
            ...droid,
            scale: 1.05, // Very subtle breathing
            color: newColor || droid.color,
            transitionDuration: 600,
            isActive: true 
        }];
    });

    // Relax after a moment
    setTimeout(() => {
        setDroids(prev => {
            const droid = prev[0];
            if (!droid) return prev;
            return [{
                ...droid,
                scale: 1.0,
                transitionDuration: 2000,
                isActive: false
            }];
        });
    }, 800);
  };

  // Auto-scroll the HUD
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // When swarm starts processing, ensure we show the HUD
  useEffect(() => {
    if (isProcessing) setHasStarted(true);
  }, [isProcessing]);

  const handleModeSelect = (mode: typeof MODES[0]) => {
    setSelectedMode(mode.id);
    setIsOpen(false);
    performAttentionShift(mode.color);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    
    let finalPrompt = input;
    if (selectedMode) {
        const mode = MODES.find(m => m.id === selectedMode);
        if (mode && mode.prompt) {
            finalPrompt = `${mode.prompt} ${input}`;
        }
    }
    
    onStart(finalPrompt);
    setInput('');
    setHasStarted(true);
    setSelectedMode(null);
    performAttentionShift('#10b981'); // Reset to green
  };

  const handleDownload = () => {
    if (messages.length === 0) return;
    generateExport(messages, agents, 'md');
  };

  // Animation CSS injection
  const animationStyles = `
    @keyframes wheel-entry-clockwise {
      0% { opacity: 0; transform: rotate(-120deg) scale(0.5); }
      100% { opacity: 1; transform: rotate(0deg) scale(1); }
    }
    .animate-wheel-entry {
      animation: wheel-entry-clockwise 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
    }
    @keyframes pulse-slow {
      0%, 100% { opacity: 0.4; transform: scale(1); }
      50% { opacity: 0.6; transform: scale(1.05); }
    }
  `;

  // --- PHANTOM EYE (ANGULAR/SMOKEY/DYNAMIC COLOR) ---
  const CyberEye = ({ isActive, color }: { isActive: boolean, color: string }) => (
    <div className="relative w-48 h-28 flex items-center justify-center transition-all duration-700" style={{ color }}>
        
        {/* 1. Volumetric Smoke/Haze Layer (Behind) */}
        <div 
            className={`absolute inset-0 blur-[50px] rounded-full mix-blend-screen transition-all duration-1000 ${isActive ? 'opacity-80' : 'opacity-40'}`}
            style={{ backgroundColor: color }}
        ></div>

        {/* 2. Main Eye Housing (Angular Clip) */}
        <div className="relative w-full h-full bg-black/80 border backdrop-blur-md shadow-[0_0_15px_currentColor] transition-all duration-500"
            style={{
                borderColor: `${color}40`, // 40 hex = ~25% opacity
                clipPath: 'polygon(5% 0%, 95% 0%, 100% 25%, 100% 75%, 95% 100%, 5% 100%, 0% 75%, 0% 25%)',
                color: color
            }}
        >
             {/* Internal Scanlines */}
             <div className="absolute inset-0 bg-[linear-gradient(transparent_2px,rgba(0,0,0,0.8)_2px)] bg-[size:100%_4px] pointer-events-none opacity-50"></div>

             {/* The "Pupil" Assembly */}
             <div className="absolute inset-0 flex items-center justify-center">
                 {/* Faint Concentric Rings */}
                 <div className="absolute w-32 h-32 border rounded-full opacity-10" style={{ borderColor: color }}></div>
                 <div className="absolute w-20 h-20 border rounded-full opacity-20" style={{ borderColor: color }}></div>
                 
                 {/* The Core Light */}
                 <div 
                    className={`relative z-10 w-2 h-2 bg-white rounded-full transition-all duration-300 ${isActive ? 'scale-150' : 'scale-100'}`}
                    style={{ 
                        boxShadow: `0 0 20px ${color}, 0 0 60px ${color}`
                    }}
                 >
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-0.5 bg-white/50 blur-[2px]"></div>
                 </div>
             </div>
        </div>
        
        {/* 3. "Brow" / Lid Accents */}
        <div className="absolute -top-1 left-4 right-4 h-[2px] blur-[1px] opacity-60" style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }}></div>
        <div className="absolute -bottom-1 left-8 right-8 h-[2px] blur-[1px] opacity-60" style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }}></div>
    </div>
  );

  return (
    <div className="relative h-screen w-full bg-black text-white font-sans overflow-hidden selection:bg-emerald-500/30">
      <style>{animationStyles}</style>

      {/* 1. Cinematic Background (Dynamic) */}
      <div className="absolute inset-0 bg-black transition-colors duration-1000"
        style={{
            background: `radial-gradient(circle at center, ${themeColor}10 0%, transparent 70%)`
        }}
      >
          <div className="absolute bottom-0 left-0 right-0 h-[80vh] bg-gradient-to-t from-black via-transparent to-transparent"></div>
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-5 pointer-events-none"></div>
      </div>

      {/* 2. Phantom Sensors (Stationary) */}
      {droids.map((d) => (
        <div
          key={d.id}
          className="absolute z-10 pointer-events-none transition-all duration-1000 ease-out"
          style={{
            top: `${d.y}%`,
            left: `${d.x}%`,
            transform: `translate(-50%, -50%) scale(${d.scale})`,
            opacity: d.opacity,
          }}
        >
          <div className="flex gap-24 items-center justify-center">
             <CyberEye isActive={d.isActive} color={d.color} />
             <CyberEye isActive={d.isActive} color={d.color} />
          </div>
        </div>
      ))}

      {/* 3. Download Artifacts */}
      <button
        onClick={handleDownload}
        disabled={messages.length === 0}
        className={`absolute top-8 left-8 z-40 flex items-center gap-3 group transition-all duration-500 ${messages.length === 0 ? 'opacity-20 hover:opacity-40' : 'opacity-60 hover:opacity-100'}`}
      >
         <FolderDown className="w-5 h-5 text-gray-500 group-hover:text-emerald-400 transition-colors" />
         <span className="text-[10px] font-mono tracking-widest text-gray-600 group-hover:text-emerald-500/80 uppercase">Files</span>
      </button>

      {/* 4. CENTRAL WHEEL CONTROLLER */}
      <div 
        className={`absolute inset-0 flex items-center justify-center z-20 transition-all duration-1000 ease-in-out pointer-events-none 
        ${hasStarted ? '-translate-y-[20vh] scale-75' : ''}`} 
      >
        <div className="relative flex items-center justify-center pointer-events-auto">
            {/* Expanded Menu */}
            {isOpen && (
                <div className="absolute top-1/2 left-1/2 w-0 h-0 flex items-center justify-center animate-wheel-entry">
                     {MODES.map((mode, index) => {
                         const angle = (index / MODES.length) * 2 * Math.PI - (Math.PI / 2);
                         const radius = 140; 
                         const x = Math.cos(angle) * radius;
                         const y = Math.sin(angle) * radius;
                         
                         return (
                             <button
                                key={mode.id}
                                onClick={() => handleModeSelect(mode)}
                                className="absolute w-16 h-16 -ml-8 -mt-8 rounded-full bg-black/90 border border-gray-800 backdrop-blur-md flex flex-col items-center justify-center shadow-[0_0_30px_rgba(0,0,0,0.8)] hover:scale-110 transition-transform duration-300 group hover:border-white/50"
                                style={{ 
                                    transform: `translate(${x}px, ${y}px)`,
                                    borderColor: mode.color
                                }}
                             >
                                <mode.icon className="w-6 h-6 mb-1 transition-colors" style={{ color: mode.color }} />
                                <span className="text-[9px] font-bold uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity absolute -bottom-5 w-24 text-center bg-black/80 px-1 rounded border border-gray-800 pointer-events-none">
                                    {mode.label}
                                </span>
                             </button>
                         );
                     })}
                </div>
            )}

            {/* Core Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`relative w-24 h-24 rounded-full flex items-center justify-center transition-all duration-700 z-30
                    ${isOpen ? 'bg-black border border-emerald-500 shadow-[0_0_50px_rgba(16,185,129,0.2)]' : 
                      activeMode ? 'bg-black border border-gray-700 shadow-[0_0_30px_rgba(255,255,255,0.1)]' :
                      'bg-white/5 border border-white/10 hover:bg-white/10 text-white backdrop-blur-sm shadow-[0_0_30px_rgba(255,255,255,0.05)]'
                    }
                `}
                style={{ 
                    borderColor: activeMode ? activeMode.color : undefined,
                    boxShadow: activeMode ? `0 0 40px ${activeMode.color}40` : undefined
                }}
            >
                 {activeMode ? (
                     <activeMode.icon className="w-10 h-10" style={{ color: activeMode.color }} />
                 ) : (
                     <Power className={`w-10 h-10 ${isOpen ? 'text-emerald-500' : 'text-white/80'}`} />
                 )}
            </button>
            
             <div className="absolute top-full left-1/2 -translate-x-1/2 mt-8 text-center w-full min-w-[300px]">
                <div className="flex items-center justify-center gap-2 text-xs font-mono tracking-[0.2em] uppercase transition-colors duration-500" style={{ color: themeColor }}>
                    <Activity className={`w-3 h-3 ${isProcessing ? 'animate-pulse' : ''}`} />
                    <span>{isProcessing ? status || 'PROCESSING' : activeMode ? activeMode.label : 'OVERWATCH ONLINE'}</span>
                </div>
            </div>
        </div>
      </div>

      {/* 5. Input Overlay */}
      <div className={`absolute left-0 right-0 z-20 flex flex-col items-center justify-center transition-all duration-1000 ease-out 
        ${(hasStarted || activeMode) ? 'top-[65%] opacity-100' : 'top-[75%] opacity-0 pointer-events-none'}`}>
          
          <form 
            onSubmit={handleSubmit}
            className="w-full max-w-xl flex items-center gap-4 px-6"
          >
            <div className="relative flex-1 group">
                <div className="absolute -inset-px rounded-lg opacity-30 group-focus-within:opacity-80 transition duration-1000 blur-sm"
                     style={{ background: `linear-gradient(to right, ${themeColor}, transparent)` }}
                ></div>
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={activeMode ? `${activeMode.label}: Enter directive...` : "Select a mode..."}
                    className="relative w-full bg-black border border-gray-800 text-lg py-4 px-6 rounded-lg focus:outline-none text-white placeholder-gray-600 shadow-2xl font-mono tracking-tight transition-all"
                    style={{ borderColor: `${themeColor}60` }}
                    autoFocus={!!activeMode}
                />
            </div>
            
            <button 
                type="submit" 
                disabled={!input.trim()}
                className="p-4 rounded-lg border border-gray-800 hover:bg-white/5 transition-colors"
                style={{ color: themeColor, borderColor: `${themeColor}40` }}
            >
                {isProcessing ? <Loader2 className="w-6 h-6 animate-spin" /> : <ArrowRight className="w-6 h-6" />}
            </button>
          </form>
      </div>

      {/* 6. Minimalist HUD (Bottom Log) */}
      {hasStarted && (
          <div className="absolute bottom-0 w-full left-1/2 -translate-x-1/2 max-w-3xl h-[25vh] bg-gradient-to-t from-black via-black/95 to-transparent p-6 overflow-hidden flex flex-col z-10 mask-image-gradient">
              <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pb-4 pr-2">
                  {messages.map((msg) => {
                      const isUser = !msg.agentId;
                      const agent = agents.find(a => a.id === msg.agentId);
                      return (
                          <div key={msg.id} className={`flex gap-3 ${isUser ? 'opacity-40' : 'opacity-90'} animate-in slide-in-from-bottom-2`}>
                              <div className="flex-shrink-0 mt-1.5">
                                  <div className="w-1 h-1 rounded-full" style={{ backgroundColor: isUser ? '#6b7280' : agent?.color || themeColor }}></div>
                              </div>
                              <div className="flex-1">
                                  {!isUser && (
                                      <div className="text-[9px] font-bold uppercase tracking-wider mb-0.5 opacity-70" style={{ color: agent?.color }}>
                                          {agent?.name}
                                      </div>
                                  )}
                                  <div className="text-xs text-gray-400 font-mono whitespace-pre-wrap leading-relaxed">
                                      {msg.content}
                                  </div>
                              </div>
                          </div>
                      );
                  })}
                  <div ref={messagesEndRef} />
              </div>
          </div>
      )}
    </div>
  );
};

export default WheelDashboard;
