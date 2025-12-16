
import React, { useRef, useEffect, useState } from 'react';
import { Agent, Message, ToolCall } from '../types';
import { Send, Bot, User, Loader2, StopCircle, ExternalLink, CheckCircle, Share2, Copy, FileText, FileJson, Sparkles, XCircle, AlertTriangle, HardDrive, Download, Check } from 'lucide-react';
import SwarmTimeline from './SwarmTimeline';
import { generateExport } from '../utils/fileUtils';

interface ChatInterfaceProps {
  activeAgentId: string | null;
  agents: Agent[];
  messages: Message[];
  onSendMessage: (content: string) => void;
  isProcessing: boolean;
  isSwarmActive?: boolean;
  onStopSwarm?: () => void;
  isLocalLLM?: boolean;
  isLmStudioConnected?: boolean;
  statusText?: string;
  onToolAction?: (msgId: string, toolId: string, approve: boolean) => void;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({
  activeAgentId,
  agents,
  messages,
  onSendMessage,
  isProcessing,
  isSwarmActive = false,
  onStopSwarm,
  isLocalLLM = false,
  isLmStudioConnected = false,
  statusText = '',
  onToolAction
}) => {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const [isShareMenuOpen, setIsShareMenuOpen] = useState(false);
  const [showCopyFeedback, setShowCopyFeedback] = useState(false);

  const activeAgent = activeAgentId ? agents.find(a => a.id === activeAgentId) : null;

  useEffect(() => {
    if (!isProcessing) {
       bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isProcessing]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isProcessing) return;
    onSendMessage(input);
    setInput('');
  };

  const scrollToMessage = (id: string) => {
    const element = messageRefs.current[id];
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element.classList.add('bg-gray-700/50');
      setTimeout(() => element.classList.remove('bg-gray-700/50'), 1500);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setShowCopyFeedback(true);
    setTimeout(() => setShowCopyFeedback(false), 2000);
    setIsShareMenuOpen(false);
  };

  const handleExport = (format: 'json' | 'md') => {
      generateExport(messages, agents, format);
      setIsShareMenuOpen(false);
  };

  const isPlanSynced = statusText.toLowerCase().includes('synced') || statusText.toLowerCase().includes('ready');

  // Helper to ensure robust avatar display
  const getAvatar = (agent: Agent) => {
      if (agent.avatar && agent.avatar.includes('picsum')) {
          const seed = agent.name.replace(/\s+/g, '');
          return `https://api.dicebear.com/9.x/bottts-neutral/svg?seed=${seed}`;
      }
      return agent.avatar;
  };

  return (
    <div className="flex flex-col h-full bg-gray-950">
      {/* Header */}
      <div className="h-16 border-b border-gray-800 flex items-center justify-between px-6 bg-gray-900/50 backdrop-blur-sm z-20 relative">
        {activeAgent ? (
          <div className="flex items-center gap-3">
            <img 
              src={getAvatar(activeAgent)} 
              alt={activeAgent.name} 
              className="w-10 h-10 rounded-lg bg-gray-800 object-cover" 
            />
            <div>
              <h1 className="text-lg font-bold text-white leading-tight">{activeAgent.name}</h1>
              <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-gray-800 text-gray-400">
                {activeAgent.model}
              </span>
            </div>
          </div>
        ) : (
          <div>
            <h1 className="text-lg font-bold text-white leading-tight">Swarm Broadcast</h1>
            <p className="text-xs text-blue-400">
              {isSwarmActive ? "Autonomous Discussion Active" : "Messaging all active agents"}
            </p>
          </div>
        )}
        
        <div className="flex items-center gap-3">
            {isSwarmActive && onStopSwarm && (
            <button 
                onClick={onStopSwarm}
                className="flex items-center gap-2 px-3 py-1.5 bg-red-900/30 text-red-400 border border-red-800/50 rounded-lg hover:bg-red-900/50 transition-colors text-sm font-medium animate-pulse"
            >
                <StopCircle className="w-4 h-4" />
                <span className="hidden sm:inline">Stop</span>
            </button>
            )}

            <div className="relative">
                <button
                    onClick={() => setIsShareMenuOpen(!isShareMenuOpen)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors text-sm font-medium shadow-lg shadow-blue-900/20"
                >
                    {showCopyFeedback ? <CheckCircle className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
                    <span>{showCopyFeedback ? 'Copied!' : 'Share'}</span>
                </button>

                {isShareMenuOpen && (
                    <>
                        <div className="fixed inset-0 z-10" onClick={() => setIsShareMenuOpen(false)}></div>
                        <div className="absolute right-0 top-full mt-2 w-56 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-20 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                            <div className="p-2 space-y-1">
                                <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center justify-between">
                                    <span>Link</span>
                                </div>
                                <button 
                                    onClick={handleCopyLink}
                                    className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white rounded-lg transition-colors text-left"
                                >
                                    <Copy className="w-4 h-4 text-blue-400" />
                                    Copy Web Link
                                </button>
                                <div className="h-px bg-gray-800 my-1"></div>
                                <div className="px-3 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wider">Export Chat</div>
                                <button 
                                    onClick={() => handleExport('md')}
                                    className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white rounded-lg transition-colors text-left"
                                >
                                    <FileText className="w-4 h-4 text-purple-400" />
                                    Markdown (.md)
                                </button>
                                <button 
                                    onClick={() => handleExport('json')}
                                    className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white rounded-lg transition-colors text-left"
                                >
                                    <FileJson className="w-4 h-4 text-yellow-400" />
                                    JSON (.json)
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 opacity-50 select-none">
            <Bot className="w-16 h-16 mb-4" />
            <p className="text-lg">Swarm Ready. Awaiting Input.</p>
          </div>
        )}
        
        {messages.map((msg) => {
          const isUser = !msg.agentId;
          const agent = msg.agentId ? agents.find(a => a.id === msg.agentId) : null;
          const isSystem = msg.agentId && msg.agentId.startsWith('system');

          return (
            <div 
              key={msg.id} 
              ref={(el) => { messageRefs.current[msg.id] = el; }}
              className={`flex gap-4 ${isUser ? 'justify-end' : 'justify-start'} transition-colors duration-500 rounded-xl p-2`}
            >
              {!isUser && !isSystem && (
                <div className="flex-shrink-0 mt-1">
                   {agent ? (
                     <img src={getAvatar(agent)} className="w-8 h-8 rounded bg-gray-800" alt={agent.name} />
                   ) : (
                     <div className="w-8 h-8 rounded bg-gray-800 flex items-center justify-center">
                       <Bot className="w-5 h-5 text-gray-400" />
                     </div>
                   )}
                </div>
              )}

              <div className={`max-w-[70%] flex flex-col gap-2 ${isUser ? 'items-end' : 'items-start'}`}>
                
                {/* Main Content Bubble */}
                <div className={`rounded-2xl px-5 py-3 shadow-sm ${
                  isUser ? 'bg-blue-600 text-white rounded-br-none' : 
                  isSystem ? 'bg-gray-900 border border-gray-700 w-full text-gray-300' :
                  'bg-gray-800 text-gray-200 rounded-bl-none border border-gray-700'
                }`}>
                  {!isUser && !isSystem && agent && (
                    <div className="text-xs font-bold mb-1 opacity-70" style={{ color: agent.color }}>
                      {agent.name}
                    </div>
                  )}
                  <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                </div>

                {/* Tool Approval Card */}
                {msg.toolCalls && msg.toolCalls.map((tool) => (
                    <div key={tool.id} className="w-full bg-gray-900 border border-yellow-700/50 rounded-lg p-4 shadow-lg animate-in slide-in-from-top-2">
                        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-800">
                            <AlertTriangle className="w-5 h-5 text-yellow-500" />
                            <span className="font-bold text-yellow-500 text-sm">Action Verification Required</span>
                        </div>
                        <div className="text-sm text-gray-300 mb-4 font-mono bg-black/30 p-2 rounded">
                            <div className="text-gray-500 text-xs uppercase mb-1">Command</div>
                            <div className="text-emerald-400">{tool.functionName}(<span className="text-yellow-200">{JSON.stringify(tool.args.filename)}</span>)</div>
                        </div>
                        
                        {tool.status === 'pending' ? (
                            <div className="flex gap-3">
                                <button 
                                    onClick={() => onToolAction && onToolAction(msg.id, tool.id, true)}
                                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-2"
                                >
                                    <Check className="w-4 h-4" /> Authorize Write
                                </button>
                                <button 
                                    onClick={() => onToolAction && onToolAction(msg.id, tool.id, false)}
                                    className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 py-2 rounded-lg text-xs font-bold transition-colors"
                                >
                                    Deny
                                </button>
                            </div>
                        ) : (
                            <div className={`text-xs font-bold flex items-center gap-2 ${tool.status === 'approved' || tool.status === 'executed' ? 'text-emerald-400' : 'text-red-400'}`}>
                                {tool.status === 'approved' || tool.status === 'executed' ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                                <span>Action {tool.status.toUpperCase()}</span>
                            </div>
                        )}
                    </div>
                ))}

                {/* File Artifact Download Card */}
                {isSystem && msg.content.includes("File Created") && (
                    <div className="flex items-center gap-3 bg-gray-800 border border-gray-700 rounded-lg p-2 pr-4 hover:bg-gray-750 transition-colors group">
                        <div className="w-10 h-10 bg-gray-700 rounded flex items-center justify-center text-blue-400">
                            <HardDrive className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-200 truncate">
                                {msg.content.match(/`([^`]+)`/)?.[1] || "file"}
                            </div>
                            <div className="text-[10px] text-gray-500">Workspace Artifact</div>
                        </div>
                        <a 
                           href={`http://localhost:1234/files/download?filename=${msg.content.match(/`([^`]+)`/)?.[1]}`}
                           className="p-2 bg-blue-600 hover:bg-blue-500 text-white rounded-md transition-colors"
                           title="Download File"
                        >
                            <Download className="w-4 h-4" />
                        </a>
                    </div>
                )}

                {/* Sources Display */}
                {msg.sources && msg.sources.length > 0 && (
                  <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-2 max-w-full text-xs">
                    <div className="font-semibold text-gray-500 mb-1 px-1">Sources</div>
                    <div className="flex flex-wrap gap-2">
                      {msg.sources.map((source, idx) => (
                        <a 
                          key={idx}
                          href={source.uri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-2 py-1 bg-gray-800 hover:bg-gray-700 text-blue-400 rounded transition-colors truncate max-w-[200px]"
                        >
                          <ExternalLink className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{source.title}</span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {isUser && (
                <div className="flex-shrink-0 mt-1">
                  <div className="w-8 h-8 rounded-full bg-blue-900 flex items-center justify-center">
                    <User className="w-5 h-5 text-blue-200" />
                  </div>
                </div>
              )}
            </div>
          );
        })}
        
        {/* Processing Indicator */}
        {isProcessing ? (
          <div className="flex gap-4">
             <div className="w-8 h-8 rounded bg-gray-800 flex items-center justify-center animate-pulse">
               <Bot className="w-5 h-5 text-gray-400" />
             </div>
             <div className="bg-gray-800 rounded-2xl rounded-bl-none px-5 py-3 border border-gray-700 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                <span className="text-sm text-gray-400 italic">
                  {statusText || (isSwarmActive ? "Swarm deliberating..." : "Processing response...")}
                </span>
             </div>
          </div>
        ) : isPlanSynced && (
          <div className="flex justify-center w-full py-2 animate-in fade-in slide-in-from-bottom-2">
             <div className="bg-green-900/20 border border-green-900/50 rounded-full px-6 py-2 flex items-center gap-3 shadow-lg shadow-green-900/10">
                <div className="bg-green-500 rounded-full p-1">
                   <CheckCircle className="w-4 h-4 text-black" />
                </div>
                <div className="flex flex-col">
                   <span className="text-sm font-bold text-green-400">Swarm Protocol Complete</span>
                   <span className="text-[10px] text-green-300/70 uppercase tracking-wide">Ready for Claude Code CLI</span>
                </div>
                <div className="w-px h-8 bg-green-900/50 mx-2"></div>
                <Sparkles className="w-4 h-4 text-yellow-400 animate-pulse" />
             </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <SwarmTimeline 
        messages={messages} 
        agents={agents} 
        onMessageClick={scrollToMessage}
        isSwarmActive={isSwarmActive}
        isProcessing={isProcessing}
      />

      {/* Input */}
      <div className="p-4 bg-gray-900 border-t border-gray-800">
        <form onSubmit={handleSubmit} className="relative max-w-4xl mx-auto">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={activeAgent ? `Message ${activeAgent.name}...` : "Broadcast message to all agents..."}
            className="w-full bg-gray-800 text-white placeholder-gray-500 rounded-xl pl-5 pr-12 py-4 focus:outline-none focus:ring-2 focus:ring-blue-600/50 border border-gray-700 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isProcessing}
          />
          <button
            type="submit"
            disabled={!input.trim() || isProcessing}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
        <div className="text-center mt-2 text-xs flex items-center justify-center gap-2 text-gray-600">
          <span>Swarm powered by</span>
          {isLocalLLM ? (
            <span className={`flex items-center gap-1.5 ${isLmStudioConnected ? 'text-emerald-400' : 'text-red-400'}`}>
              LM Studio (Local)
              {isLmStudioConnected ? (
                <CheckCircle className="w-3 h-3" />
              ) : (
                <XCircle className="w-3 h-3" />
              )}
            </span>
          ) : (
            <span className="text-gray-400">Gemini 2.5 Flash</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;
