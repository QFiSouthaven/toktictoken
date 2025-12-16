
import React, { useState } from 'react';
import { Activity, Zap, Terminal } from 'lucide-react';

interface SimpleDashboardProps {
  onStart: (goal: string) => void;
  status: string;
  isProcessing: boolean;
}

const SimpleDashboard: React.FC<SimpleDashboardProps> = ({ onStart, status, isProcessing }) => {
  const [goal, setGoal] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (goal.trim()) onStart(goal);
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-black text-gray-100 relative overflow-hidden font-sans selection:bg-blue-500/30">
      {/* Background Ambience */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-900/10 via-black to-black animate-pulse-slow"></div>
      
      {/* Grid Overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(20,20,20,0.5)_1px,transparent_1px),linear-gradient(90deg,rgba(20,20,20,0.5)_1px,transparent_1px)] bg-[size:40px_40px] opacity-20 pointer-events-none"></div>

      <div className="z-10 w-full max-w-2xl px-6 flex flex-col items-center gap-12 animate-in fade-in zoom-in duration-700">
        
        {/* Header / Status */}
        <div className="text-center space-y-2">
            <h1 className="text-5xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-600">
                LOCAL SWARM
            </h1>
            <div className="flex items-center justify-center gap-3 text-sm font-mono tracking-widest text-blue-400 opacity-80 uppercase bg-blue-900/10 py-1 px-4 rounded-full border border-blue-900/30">
                <Activity className={`w-3 h-3 ${isProcessing ? 'animate-pulse' : ''}`} />
                <span>Status: {status || 'SYSTEM READY'}</span>
            </div>
        </div>

        {/* Big Input Control */}
        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-8">
           <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl opacity-20 group-focus-within:opacity-50 transition duration-500 blur"></div>
                <input 
                    type="text" 
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                    placeholder="ENTER PRIME DIRECTIVE..."
                    className="relative w-full bg-gray-950/80 backdrop-blur-xl border border-gray-800 text-3xl font-light text-center py-6 px-4 rounded-xl focus:outline-none focus:border-blue-500/50 focus:bg-gray-900 transition-all placeholder-gray-700 text-white shadow-2xl"
                    autoFocus
                />
           </div>
           
           <button 
             type="submit"
             disabled={!goal || isProcessing}
             className="group relative w-full py-6 bg-white hover:bg-gray-100 text-black transition-all rounded-xl overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_40px_rgba(255,255,255,0.1)] hover:shadow-[0_0_60px_rgba(255,255,255,0.2)]"
           >
              <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-blue-500/0 via-blue-500/10 to-blue-500/0 skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
              <span className="relative text-xl font-bold tracking-[0.3em] flex items-center justify-center gap-3">
                 <Zap className={`w-5 h-5 ${isProcessing ? 'animate-spin' : ''}`} fill="currentColor" /> 
                 {isProcessing ? 'EXECUTING...' : 'INITIALIZE SEQUENCE'}
              </span>
           </button>
        </form>

        <div className="absolute bottom-10 flex flex-col items-center gap-2 text-[10px] text-gray-600 font-mono opacity-60">
            <div className="flex items-center gap-2">
                <span>SECURE TERMINAL ACCESS</span>
                <span className="text-gray-400 bg-gray-900 border border-gray-800 px-1.5 py-0.5 rounded font-bold">`</span>
            </div>
            <span>v1.0.0 (STABLE)</span>
        </div>
      </div>
    </div>
  );
};

export default SimpleDashboard;
