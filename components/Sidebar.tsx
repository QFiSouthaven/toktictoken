
import React, { useState } from 'react';
import { Agent, Message } from '../types';
import { Plus, Trash2, Cpu, Settings, Command, Network, MessageSquare, Database, BarChart3, Coins, Terminal, Copy, Check, FileText, RefreshCw, ExternalLink, Code } from 'lucide-react';
import { useSwarmMetrics, formatCost } from '../hooks/useSwarmMetrics';

interface SidebarProps {
  agents: Agent[];
  activeAgentId: string | null;
  onSelectAgent: (id: string | null) => void;
  onAddAgent: () => void;
  onRemoveAgent: (id: string) => void;
  useLocalLLM: boolean;
  onToggleLocalLLM: () => void;
  isLmStudioConnected: boolean;
  localBaseUrl: string;
  setLocalBaseUrl: (url: string) => void;
  connectionError?: string | null;
  autoConnect: boolean;
  onToggleAutoConnect: () => void;
  isBridgeConnected?: boolean;
  onRetryConnection?: () => void;
  isTerminalOpen?: boolean;
  onToggleTerminal?: () => void;
  isDbConnected?: boolean;
  onClearDatabase?: () => void;
  onOpenSettings?: () => void;
  messages?: Message[];
}

const Sidebar: React.FC<SidebarProps> = ({ 
  agents, 
  activeAgentId, 
  onSelectAgent, 
  onAddAgent, 
  onRemoveAgent,
  useLocalLLM,
  onToggleLocalLLM,
  isLmStudioConnected,
  localBaseUrl,
  setLocalBaseUrl,
  connectionError,
  autoConnect,
  onToggleAutoConnect,
  isBridgeConnected = false,
  isTerminalOpen = false,
  onToggleTerminal,
  isDbConnected = false,
  onClearDatabase,
  onOpenSettings,
  messages = []
}) => {
  const [showNetworkSettings, setShowNetworkSettings] = useState(false);
  const [showAgentsTab, setShowAgentsTab] = useState(true);
  const [showCommSettings, setShowCommSettings] = useState(false);
  const [showStats, setShowStats] = useState(true);
  
  // Local UI State
  const [copiedProxyCommand, setCopiedProxyCommand] = useState(false);
  const [copiedClaudeCommand, setCopiedClaudeCommand] = useState(false);
  const [copiedCursorCommand, setCopiedCursorCommand] = useState(false);

  // Hook: Encapsulated Logic
  const metrics = useSwarmMetrics(messages);

  const handleCopyProxyCommand = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText('node proxy.js');
    setCopiedProxyCommand(true);
    setTimeout(() => setCopiedProxyCommand(false), 2000);
  };

  const handleCopyClaudeCommand = (e: React.MouseEvent) => {
    e.stopPropagation();
    // The Magic Command: Tells Claude to read the shared brain and act as the implementer.
    const cmd = `claude "Read SWARM_CONTEXT.md. This file contains the architecture plan from the Swarm. Act as the Lead Engineer and implement the next step."`;
    navigator.clipboard.writeText(cmd);
    setCopiedClaudeCommand(true);
    setTimeout(() => setCopiedClaudeCommand(false), 2000);
  };

  const handleCopyCursorCommand = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText('cursor .');
    setCopiedCursorCommand(true);
    setTimeout(() => setCopiedCursorCommand(false), 2000);
  };

  // Helper to ensure robust avatar display
  const getAvatar = (agent: Agent) => {
      // If the avatar is one of the old picsum ones, force migration to new bottts style
      if (agent.avatar && agent.avatar.includes('picsum')) {
          const seed = agent.name.replace(/\s+/g, '');
          return `https://api.dicebear.com/9.x/bottts-neutral/svg?seed=${seed}`;
      }
      return agent.avatar;
  };

  return (
    <div className="w-64 bg-gray-950 border-r border-gray-800 flex flex-col h-full z-10 select-none">
      {/* Header */}
      <div className="p-4 border-b border-gray-800 flex items-center gap-2">
        <Cpu className="w-5 h-5 text-blue-400" />
        <h2 className="text-lg font-bold text-gray-200">Swarm Node</h2>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col">
        {/* SECTION: IDE & Tool Integration */}
        <div className="p-3 border-b border-gray-800/50">
          <div className="mb-3">
             <h3 className="text-sm font-bold text-gray-100 flex items-center gap-2">
                <Code className="w-4 h-4 text-purple-400" />
                Dev Environment
             </h3>
             <p className="text-[10px] text-gray-500 pl-6 leading-tight mt-1">
               Local toolchain sync status.
             </p>
          </div>

          <div className="space-y-2">
             {/* 1. Claude Code */}
             <div className="bg-gray-900 rounded-lg p-2 border border-purple-900/20">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                        <Command className="w-3 h-3 text-purple-400" />
                        <span className="text-[10px] font-bold text-gray-300">Claude CLI</span>
                    </div>
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.5)]"></div>
                </div>
                
                <button 
                   onClick={handleCopyClaudeCommand}
                   className="w-full flex items-center justify-between px-2 py-1.5 bg-black/40 hover:bg-purple-900/20 rounded border border-gray-700 hover:border-purple-500/50 transition-all group focus:outline-none focus:ring-1 focus:ring-purple-500"
                   aria-label="Copy Claude CLI command"
                >
                   <div className="flex flex-col items-start">
                       <span className="text-[9px] text-gray-500 font-bold uppercase">Run Command</span>
                       <span className="text-[10px] text-gray-300 font-mono group-hover:text-purple-300">claude "Read..."</span>
                   </div>
                   {copiedClaudeCommand ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5 text-gray-600 group-hover:text-purple-400" />}
                </button>
             </div>

             {/* 2. Cursor IDE */}
             <div className="bg-gray-900 rounded-lg p-2 border border-blue-900/20">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                        <FileText className="w-3 h-3 text-blue-400" />
                        <span className="text-[10px] font-bold text-gray-300">Cursor IDE</span>
                    </div>
                    <a href="https://cursor.com" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 rounded" title="Get Cursor">
                        <ExternalLink className="w-3 h-3" />
                    </a>
                </div>
                
                <button 
                   onClick={handleCopyCursorCommand}
                   className="w-full flex items-center justify-between px-2 py-1.5 bg-black/40 hover:bg-blue-900/20 rounded border border-gray-700 hover:border-blue-500/50 transition-all group focus:outline-none focus:ring-1 focus:ring-blue-500"
                   aria-label="Copy Cursor IDE command"
                >
                   <div className="flex flex-col items-start">
                       <span className="text-[9px] text-gray-500 font-bold uppercase">Launch</span>
                       <span className="text-[10px] text-gray-300 font-mono group-hover:text-blue-300">cursor .</span>
                   </div>
                   {copiedCursorCommand ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5 text-gray-600 group-hover:text-blue-400" />}
                </button>
             </div>
          </div>
        </div>

        {/* SECTION: Active Agents */}
        <div className="p-3">
          <div className="space-y-1" role="list" aria-label="Active Agents">
             <div className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wider flex justify-between items-center mb-2">
                <span>Active Agents</span>
                <span className="bg-gray-800 text-gray-400 text-[10px] px-1.5 rounded">{agents.length}</span>
             </div>

             {/* Broadcast Button */}
             <button
                type="button"
                onClick={() => onSelectAgent(null)}
                aria-pressed={activeAgentId === null}
                className={`w-full text-left p-2 rounded-lg flex items-center gap-3 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:z-10 ${
                  activeAgentId === null 
                    ? 'bg-blue-900/20 text-blue-400 border border-blue-800/50' 
                    : 'text-gray-400 hover:bg-gray-900 hover:text-gray-200'
                }`}
              >
                <div className="w-6 h-6 rounded bg-gray-800 flex items-center justify-center text-[10px] font-bold">ALL</div>
                <span className="text-sm font-medium">Broadcast</span>
              </button>

             {/* Agent List */}
             {showAgentsTab && agents.map((agent) => (
                <div key={agent.id} className="relative group" role="listitem">
                  <button
                    type="button"
                    onClick={() => onSelectAgent(agent.id)}
                    aria-selected={activeAgentId === agent.id}
                    className={`w-full text-left p-2 rounded-lg flex items-center gap-3 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:z-10 ${
                      activeAgentId === agent.id
                        ? 'bg-gray-800 text-white border border-gray-700'
                        : 'text-gray-400 hover:bg-gray-900 hover:text-gray-200'
                    }`}
                  >
                    <img 
                        src={getAvatar(agent)} 
                        alt={agent.name} 
                        className="w-6 h-6 rounded bg-gray-800 object-cover" 
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                         <div className="font-medium text-sm truncate">{agent.name}</div>
                         {/* Model Indicator (Cost Awareness) */}
                         <div className={`w-1.5 h-1.5 rounded-full ${
                             useLocalLLM ? 'bg-emerald-500' : 
                             agent.model.includes('flash') ? 'bg-green-400' : 'bg-orange-400' 
                         }`} title={useLocalLLM ? "Local (Free)" : agent.model}></div>
                      </div>
                      <div className="text-[10px] truncate opacity-60" style={{ color: agent.color }}>{agent.role}</div>
                    </div>
                  </button>
                  <button 
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onRemoveAgent(agent.id); }}
                    aria-label={`Remove agent ${agent.name}`}
                    className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 text-gray-500 hover:text-red-400 focus:text-red-400 focus:outline-none focus:ring-1 focus:ring-red-500 rounded"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
             ))}

             <button
                type="button"
                onClick={onAddAgent}
                aria-label="Add new agent"
                className="w-full flex items-center justify-center gap-2 p-2 rounded-lg border border-dashed border-gray-800 text-gray-500 hover:border-gray-600 hover:text-gray-300 text-xs font-medium transition-colors mt-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <Plus className="w-3 h-3" /> Add Agent
              </button>
          </div>
        </div>

        {/* SECTION: System Terminal Toggle */}
        {onToggleTerminal && (
            <div className="px-3 mt-2">
              <button
                type="button"
                onClick={onToggleTerminal}
                aria-pressed={isTerminalOpen}
                className={`w-full flex items-center justify-between p-2 rounded text-sm font-medium border transition-all focus:outline-none focus:ring-2 focus:ring-green-500 ${
                  isTerminalOpen 
                    ? 'bg-green-900/10 text-green-400 border-green-900/50' 
                    : 'bg-gray-900 text-gray-400 border-gray-800 hover:text-gray-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4" />
                  <span className="text-xs">PowerShell Terminal</span>
                </div>
                {isTerminalOpen && <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.8)]"></div>}
              </button>
            </div>
        )}
      </div>

      {/* FOOTER SETTINGS DECK */}
      <div className="border-t border-gray-800 bg-gray-900/50">
         
         {/* 1. SESSION STATS */}
         <div className="border-b border-gray-800">
            <button 
              type="button"
              onClick={() => setShowStats(!showStats)}
              aria-expanded={showStats}
              className={`w-full p-3 flex items-center justify-between hover:bg-gray-800 transition-colors focus:outline-none focus:bg-gray-800 ${showStats ? 'bg-gray-800 text-emerald-400' : 'text-gray-400'}`}
            >
               <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide">
                  <BarChart3 className="w-4 h-4" /> Session Metrics
               </div>
               <div className="text-[10px] font-mono text-gray-500">
                  {metrics.totalTokens > 0 ? `${(metrics.totalTokens/1000).toFixed(1)}k T` : ''}
               </div>
            </button>
            
            {showStats && (
               <div className="p-3 bg-black/20 space-y-2 animate-in slide-in-from-top-2 duration-200">
                  <div className="flex justify-between items-center text-xs">
                     <span className="text-gray-400">Total Tokens</span>
                     <span className="font-mono text-gray-200">{metrics.totalTokens.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                     <span className="text-gray-500 pl-2">Prompt / Resp</span>
                     <span className="font-mono text-gray-500">{(metrics.promptTokens/1000).toFixed(1)}k / {(metrics.completionTokens/1000).toFixed(1)}k</span>
                  </div>
                  <div className="h-px bg-white/5 my-1"></div>
                  <div className="flex justify-between items-center text-xs">
                     <div className="flex items-center gap-1.5 text-gray-400">
                        <Coins className="w-3 h-3" />
                        <span>Est. Cost</span>
                     </div>
                     <span className={`font-mono font-bold ${metrics.totalCost > 0 ? 'text-yellow-400' : 'text-emerald-400'}`}>
                        {formatCost(metrics.totalCost)}
                     </span>
                  </div>
                  {useLocalLLM && (
                      <div className="text-[9px] text-emerald-500/80 text-center italic mt-1">
                          Payment Knockoff Mode Active (Local)
                      </div>
                  )}
               </div>
            )}
         </div>

         {/* 2. Network settings */}
         <div className="border-b border-gray-800">
            <button 
              type="button"
              onClick={() => setShowNetworkSettings(!showNetworkSettings)}
              aria-expanded={showNetworkSettings}
              className={`w-full p-3 flex items-center justify-between hover:bg-gray-800 transition-colors focus:outline-none focus:bg-gray-800 ${showNetworkSettings ? 'bg-gray-800 text-blue-400' : 'text-gray-400'}`}
            >
               <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide">
                  <Network className="w-4 h-4" /> Network Settings
               </div>
               {useLocalLLM && (
                 <div className={`w-1.5 h-1.5 rounded-full ${isLmStudioConnected ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
               )}
            </button>
            
            {showNetworkSettings && (
               <div className="p-3 bg-black/20 space-y-3 animate-in slide-in-from-top-2 duration-200">
                  <div className="flex items-center justify-between">
                     <span className="text-xs text-gray-400">Enable Local LLM</span>
                     <div className="flex items-center gap-2">
                         {onOpenSettings && (
                             <button 
                                type="button"
                                onClick={onOpenSettings}
                                className="p-1 text-gray-500 hover:text-white hover:bg-gray-700 rounded transition-colors focus:outline-none focus:ring-1 focus:ring-gray-500"
                                title="Open Settings Dashboard"
                             >
                                <Settings className="w-3.5 h-3.5" />
                             </button>
                         )}
                         <button
                            type="button"
                            onClick={onToggleLocalLLM}
                            aria-pressed={useLocalLLM}
                            className={`w-8 h-4 rounded-full flex items-center px-0.5 transition-colors focus:outline-none focus:ring-1 focus:ring-blue-500 ${useLocalLLM ? 'bg-blue-600' : 'bg-gray-700'}`}
                         >
                            <div className={`w-3 h-3 rounded-full bg-white transition-transform ${useLocalLLM ? 'translate-x-4' : 'translate-x-0'}`}></div>
                         </button>
                     </div>
                  </div>
                  
                  {/* Database Status Block */}
                  <div className="pt-2 border-t border-white/5 mt-2">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                           <Database className="w-3 h-3 text-gray-500" />
                           <span className="text-xs text-gray-400">MongoDB</span>
                        </div>
                        <span className={`text-[10px] font-mono px-1.5 rounded ${isDbConnected ? 'bg-green-900/30 text-green-400' : 'bg-gray-800 text-gray-500'}`}>
                           {isDbConnected ? 'ONLINE' : 'OFFLINE'}
                        </span>
                    </div>
                    {isDbConnected && onClearDatabase && (
                       <button 
                         type="button"
                         onClick={onClearDatabase}
                         className="w-full mt-2 text-[10px] text-red-400 bg-red-900/20 hover:bg-red-900/40 border border-red-900/30 rounded py-1 transition-colors focus:outline-none focus:ring-1 focus:ring-red-500"
                       >
                         Clear Chat History
                       </button>
                    )}
                  </div>

                  {useLocalLLM && (
                     <>
                        <div className="pt-2">
                           <label htmlFor="lm-studio-url" className="text-[10px] text-gray-500 mb-1 block">LM Studio URL</label>
                           <input
                              id="lm-studio-url"
                              type="text"
                              value={localBaseUrl}
                              onChange={(e) => setLocalBaseUrl(e.target.value)}
                              className="w-full bg-gray-900 text-xs text-gray-300 border border-gray-700 rounded px-2 py-1 focus:border-blue-500 outline-none focus:ring-1 focus:ring-blue-500"
                           />
                        </div>
                        <div className="flex items-center justify-between">
                           <span className="text-[10px] text-gray-500">Auto-Connect</span>
                           <button onClick={onToggleAutoConnect} type="button" aria-pressed={autoConnect} className={`text-[10px] font-bold focus:outline-none focus:underline ${autoConnect ? 'text-green-400' : 'text-gray-600'}`}>
                              {autoConnect ? 'ON' : 'OFF'}
                           </button>
                        </div>
                        {connectionError && (
                           <div className="text-[10px] text-red-400 bg-red-900/10 p-1 rounded border border-red-900/30 truncate" title={connectionError}>
                              {connectionError}
                           </div>
                        )}
                     </>
                  )}
               </div>
            )}
         </div>

         {/* 3. Communication settings */}
         <div>
            <button 
               type="button"
               onClick={() => setShowCommSettings(!showCommSettings)}
               aria-expanded={showCommSettings}
               className={`w-full p-3 flex items-center justify-between hover:bg-gray-800 transition-colors focus:outline-none focus:bg-gray-800 ${showCommSettings ? 'bg-gray-800 text-purple-400' : 'text-gray-400'}`}
            >
               <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide">
                  <MessageSquare className="w-4 h-4" /> Communication Settings
               </div>
               {isBridgeConnected && <div className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse"></div>}
            </button>

            {showCommSettings && (
               <div className="p-3 bg-black/20 space-y-2 animate-in slide-in-from-top-2 duration-200">
                  <div className="flex items-center justify-between text-xs">
                     <span className="text-gray-400">CLI Bridge Status</span>
                     <span className={`font-mono px-2 py-0.5 rounded ${isBridgeConnected ? 'bg-purple-900/30 text-purple-400' : 'bg-gray-800 text-gray-500'}`}>
                        {isBridgeConnected ? 'ONLINE' : 'OFFLINE'}
                     </span>
                  </div>
                  {!isBridgeConnected && (
                    <div className="mt-2 p-2 bg-gray-900/50 rounded border border-gray-800">
                        <div className="text-[10px] text-gray-400 mb-2 flex items-center justify-between">
                            <span>Bridge Disconnected</span>
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                        </div>
                        <button 
                            type="button"
                            onClick={handleCopyProxyCommand}
                            className="w-full flex items-center justify-between px-2 py-1.5 bg-black rounded border border-gray-700 hover:border-purple-500/50 hover:bg-gray-900 transition-all group focus:outline-none focus:ring-1 focus:ring-purple-500"
                            title="Copy start command"
                            aria-label="Copy proxy command"
                        >
                            <div className="flex items-center gap-2">
                                <span className="text-purple-500 font-mono text-[10px]">$</span>
                                <code className="text-[10px] text-gray-300 font-mono group-hover:text-purple-300">node proxy.js</code>
                            </div>
                            {copiedProxyCommand ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3 text-gray-600 group-hover:text-gray-400" />}
                        </button>
                        <div className="text-[9px] text-gray-600 mt-1.5 text-center italic">
                            Click to copy, then run in terminal
                        </div>
                    </div>
                  )}
               </div>
            )}
         </div>

      </div>
    </div>
  );
};

export default Sidebar;
