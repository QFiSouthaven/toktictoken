
import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { Terminal as TerminalIcon, X, Trash2, Loader2, Sparkles, Lightbulb } from 'lucide-react';
import { getTerminalCompletions } from '../services/geminiService';
// Use namespace import and fallback to default to handle CJS/ESM interop issues in browser environments
import * as ReactWindowModule from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';

// Robustly resolve VariableSizeList regardless of how the module is bundled/exported
const List = (ReactWindowModule as any).VariableSizeList || (ReactWindowModule as any).default?.VariableSizeList;

interface TerminalPanelProps {
  isOpen: boolean;
  onClose: () => void;
  baseUrl: string; // The URL of the proxy server
  height: number;
  onResize: (height: number) => void;
  useLocalLLM: boolean;
  localModelId: string;
  onInternalCommand?: (cmd: string) => void;
}

interface TerminalLine {
  id: string;
  type: 'input' | 'output' | 'error' | 'system';
  content: string;
}

type ExecutionStatus = 'idle' | 'running' | 'success' | 'error';

// --- HEURISTIC ERROR ANALYSIS ---
const getErrorSuggestion = (text: string): string | null => {
  const t = text.toLowerCase();
  
  if (t.includes('command not found') || t.includes('is not recognized') || t.includes('not recognized as an internal')) {
    return "Tool missing or not in PATH. Try installing it globally (e.g., 'npm install -g <package>').";
  }
  if (t.includes('permission denied') || t.includes('eacces')) {
    return "Access denied. Check file permissions or try running the proxy with elevated privileges.";
  }
  if (t.includes('enoent') || t.includes('no such file')) {
    return "File or directory not found. Check your current working directory with 'ls' or 'dir'.";
  }
  if (t.includes('eaddrinuse')) {
    return "Port is already in use. Kill the process occupying the port or choose a different one.";
  }
  if (t.includes('npm err')) {
    return "NPM package error. Try 'npm cache clean --force' or deleting node_modules and running 'npm install'.";
  }
  if (t.includes('fatal: not a git repository')) {
    return "Not a git repo. Run 'git init' to initialize version control here.";
  }
  if (t.includes('fatal: remote origin already exists')) {
    return "Remote exists. Use 'git remote set-url origin <url>' to update it.";
  }
  if (t.includes('syntaxerror') || t.includes('unexpected token')) {
    return "Code syntax error. Please check the file content for typos or missing brackets.";
  }
  if (t.includes('connection refused') || t.includes('econnrefused')) {
    return "Network connection failed. Ensure the target server or service is running.";
  }
  if (t.includes('module not found') || t.includes('importerror')) {
    return "Dependency missing. Run 'npm install' (Node) or 'pip install' (Python) to install required packages.";
  }
  
  return null;
};

const TerminalPanel: React.FC<TerminalPanelProps> = ({ 
  isOpen, 
  onClose, 
  baseUrl, 
  height, 
  onResize,
  useLocalLLM,
  localModelId,
  onInternalCommand
}) => {
  // Lazy initialization for persistence
  const [history, setHistory] = useState<TerminalLine[]>(() => {
    if (typeof window !== 'undefined') {
        try {
            const saved = localStorage.getItem('swarm_terminal_history');
            if (saved) {
                return JSON.parse(saved);
            }
        } catch (e) {
            console.error("Failed to load terminal history:", e);
        }
    }
    return [
        { id: 'init', type: 'system', content: 'Local Swarm PowerShell v1.0.0' },
        { id: 'init-2', type: 'system', content: 'Connected to Local Environment.' }
    ];
  });

  const [input, setInput] = useState('');
  const [status, setStatus] = useState<ExecutionStatus>('idle');
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Auto-complete State
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [activeSuggestion, setActiveSuggestion] = useState<number>(0);

  // Command History State
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [tempInput, setTempInput] = useState(''); 

  // Virtualization Refs
  const listRef = useRef<any>(null); // Use any to avoid strict typing issues with the patched import
  const sizeMap = useRef<{[index: number]: number}>({});
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);

  // Persistence Effect
  useEffect(() => {
    try {
        const historyToSave = history.length > 1000 ? history.slice(history.length - 1000) : history;
        localStorage.setItem('swarm_terminal_history', JSON.stringify(historyToSave));
    } catch (e) {
        console.error("Failed to save terminal history:", e);
    }
  }, [history]);

  // Debounce logic for suggestions
  useEffect(() => {
    const fetchSuggestions = async () => {
        if (!input.trim() || input.length < 2 || input.startsWith('/')) {
            setSuggestions([]);
            return;
        }
        
        try {
            const historyContext = history.slice(-3).map(h => `${h.type}: ${h.content}`);
            const results = await getTerminalCompletions(
                input,
                historyContext,
                useLocalLLM,
                localModelId,
                baseUrl
            );
            setSuggestions(results);
            setActiveSuggestion(0);
        } catch (e) {
            // Silent fail
        }
    };

    const debounceId = setTimeout(fetchSuggestions, 500);
    return () => clearTimeout(debounceId);
  }, [input, useLocalLLM, localModelId, baseUrl, history]);

  // Smart Scroll Logic
  useEffect(() => {
    if (shouldAutoScroll && listRef.current) {
        listRef.current.scrollToItem(history.length - 1, 'end');
    }
  }, [history.length, shouldAutoScroll]);

  // Resizing Logic
  const isResizingRef = useRef(false);
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingRef.current) return;
      const newHeight = window.innerHeight - e.clientY;
      const clampedHeight = Math.max(150, Math.min(newHeight, window.innerHeight - 50));
      onResize(clampedHeight);
    };

    const handleMouseUp = () => {
      isResizingRef.current = false;
      document.body.style.cursor = 'default';
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    const handleMouseDown = (e: React.MouseEvent) => {
      isResizingRef.current = true;
      document.body.style.cursor = 'row-resize';
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    };

    const handle = document.getElementById('terminal-resize-handle');
    if (handle) handle.addEventListener('mousedown', handleMouseDown as any);

    return () => {
      if (handle) handle.removeEventListener('mousedown', handleMouseDown as any);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [onResize]);

  // Focus input on open
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const addToHistory = (type: TerminalLine['type'], content: string) => {
    setHistory(prev => [...prev, { id: Date.now().toString() + Math.random(), type, content }]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
      // 1. Handle Navigation of Suggestions
      if (suggestions.length > 0) {
          if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActiveSuggestion(prev => Math.max(0, prev - 1));
              return;
          }
          if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActiveSuggestion(prev => Math.min(suggestions.length - 1, prev + 1));
              return;
          }
          if (e.key === 'Tab') {
              e.preventDefault();
              setInput(suggestions[activeSuggestion]);
              setSuggestions([]);
              return;
          }
          if (e.key === 'Escape') {
              setSuggestions([]);
              return;
          }
      } 
      // 2. Handle Command History
      else {
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          if (commandHistory.length === 0) return;
          
          const newIndex = historyIndex + 1;
          if (newIndex < commandHistory.length) {
            if (historyIndex === -1) setTempInput(input);
            setHistoryIndex(newIndex);
            setInput(commandHistory[commandHistory.length - 1 - newIndex]);
          }
        }
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          if (historyIndex > 0) {
            const newIndex = historyIndex - 1;
            setHistoryIndex(newIndex);
            setInput(commandHistory[commandHistory.length - 1 - newIndex]);
          } else if (historyIndex === 0) {
            setHistoryIndex(-1);
            setInput(tempInput);
          }
        }
      }
  };

  const handleExecute = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || status === 'running') return;

    setSuggestions([]);
    const command = input.trim();
    setInput('');
    setCommandHistory(prev => [...prev, command]);
    setHistoryIndex(-1);
    setTempInput('');
    
    addToHistory('input', command);
    setShouldAutoScroll(true);

    if (command.startsWith('/') && onInternalCommand) {
        try {
            onInternalCommand(command);
            addToHistory('system', `Command executed: ${command}`);
        } catch (err: any) {
            addToHistory('error', `Command failed: ${err.message}`);
        }
        return;
    }

    setStatus('running');
    const proxyUrl = 'http://127.0.0.1:1234/terminal/exec';

    try {
      const response = await fetch(proxyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command })
      });

      if (!response.body) throw new Error('ReadableStream not supported');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let hasError = false;
      let suggestionMade = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        if (chunk) {
             const lower = chunk.toLowerCase();
             let type: TerminalLine['type'] = 'output';
             // Primitive error detection in stdout/stderr stream
             if (lower.includes('error') || lower.includes('fatal') || lower.includes('failed')) {
                 type = 'error';
                 hasError = true;
             }
             addToHistory(type, chunk);

             // Intelligent Suggestion Engine
             if ((type === 'error' || hasError) && !suggestionMade) {
                const suggestion = getErrorSuggestion(chunk);
                if (suggestion) {
                    addToHistory('system', `💡 Suggestion: ${suggestion}`);
                    suggestionMade = true;
                }
             }
        }
      }
      addToHistory('system', hasError ? '✖ Command Failed' : '✓ Done');
      setStatus(hasError ? 'error' : 'success');
      setTimeout(() => setStatus('idle'), 2000);
    } catch (err: any) {
      addToHistory('error', `Execution failed: ${err.message}`);
      setStatus('error');
      setTimeout(() => setStatus('idle'), 2000);
    } finally {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const clearTerminal = () => {
    const resetHistory: TerminalLine[] = [{ id: Date.now().toString(), type: 'system', content: 'Console cleared.' }];
    setHistory(resetHistory);
    sizeMap.current = {};
    listRef.current?.resetAfterIndex(0);
  };

  // Row Renderer for React Window
  const getSize = (index: number) => sizeMap.current[index] || 24;
  const setSize = (index: number, size: number) => {
      if (sizeMap.current[index] !== size) {
          sizeMap.current[index] = size;
          listRef.current?.resetAfterIndex(index);
      }
  };

  const Row = ({ index, style, data }: any) => {
    const line = data[index];
    const rowRef = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        if (rowRef.current) {
            setSize(index, rowRef.current.getBoundingClientRect().height);
        }
    }, [line]);

    return (
        <div style={style} className="px-4">
            <div ref={rowRef} className="whitespace-pre-wrap break-all leading-relaxed py-0.5">
                {line.type === 'input' && (
                    <span className="flex items-center gap-2 text-white font-bold mt-2 mb-1">
                        <span className="text-emerald-500">➜</span>
                        <span>{line.content}</span>
                    </span>
                )}
                {line.type === 'output' && (
                    <span className="text-gray-300 opacity-90 pl-4 border-l-2 border-gray-800 block ml-1">{line.content}</span>
                )}
                {line.type === 'error' && (
                    <span className="text-red-400 font-medium pl-4 border-l-2 border-red-900/50 block ml-1">{line.content}</span>
                )}
                {line.type === 'system' && (
                    <span className={`italic text-xs flex items-center gap-1.5 pl-4 mt-1 mb-1 ${
                        line.content.includes('Done') ? 'text-emerald-500 font-bold' : 
                        line.content.includes('💡') ? 'text-amber-400/90' : 
                        line.content.includes('✖') ? 'text-red-500 font-bold' :
                        'text-blue-500'
                    }`}>
                        {line.content.includes('💡') && <Lightbulb className="w-3 h-3 text-amber-400" />}
                        {line.content.includes('💡') && <span className="font-bold text-amber-400">Helper:</span>}
                        {line.content.replace('💡 Suggestion:', '').replace('Helper:', '')}
                    </span>
                )}
            </div>
        </div>
    );
  };

  return (
    <div 
      className="flex flex-col bg-black border-t-2 border-gray-800 shadow-2xl pointer-events-auto"
      style={{ height: height }}
    >
      <div id="terminal-resize-handle" className="w-full h-3 bg-gray-900 hover:bg-gray-800 cursor-row-resize flex items-center justify-center transition-all group border-b border-gray-800">
        <div className="w-16 h-1 rounded-full bg-gray-700 group-hover:bg-gray-500 transition-colors"></div>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-1.5 bg-[#1e1e1e] border-b border-gray-700 select-none">
        <div className="flex items-center gap-2 text-gray-300 font-mono text-xs">
          <TerminalIcon className={`w-3.5 h-3.5 ${status === 'running' ? 'text-yellow-400 animate-pulse' : 'text-blue-400'}`} />
          <span className="font-bold tracking-wide">PowerShell</span>
          <span className="text-gray-600">|</span>
          <span className={`transition-colors duration-300 font-medium ${
            status === 'running' ? 'text-yellow-400' : 
            status === 'success' ? 'text-green-400' :
            status === 'error' ? 'text-red-400' : 'text-gray-500'
          }`}>
            {status === 'running' ? 'EXECUTING...' : status.toUpperCase()}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={clearTerminal} className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Virtualized List */}
      <div className="flex-1 bg-[#0c0c0c] font-mono text-sm">
         <AutoSizer>
            {({ height, width }: any) => {
              // Safety check: ensure List is defined before rendering
              if (!List) return <div className="p-4 text-red-500">Error: Virtual List Component failed to load.</div>;
              
              return (
                <List
                    ref={listRef}
                    height={height}
                    width={width}
                    itemCount={history.length}
                    itemSize={getSize}
                    itemData={history}
                    className="scrollbar-thin scrollbar-thumb-gray-800"
                    onScroll={({ scrollDirection, scrollOffset, scrollUpdateWasRequested }: any) => {
                         // Only disable auto-scroll if the user manually scrolled up
                         if (!scrollUpdateWasRequested && scrollDirection === 'backward') {
                             setShouldAutoScroll(false);
                         } else if (scrollDirection === 'forward' && !shouldAutoScroll) {
                             // Re-enable logic can go here
                         }
                    }}
                >
                    {Row}
                </List>
              );
            }}
         </AutoSizer>
      </div>

      {/* Active Input Line (Fixed Footer) */}
      <div className="p-2 bg-[#0c0c0c] border-t border-gray-800">
        <div className={`
          flex items-center gap-2 min-h-[40px] relative rounded-lg px-3 py-2 border transition-all duration-300
          ${status === 'running' ? 'bg-yellow-900/10 border-yellow-500/50 shadow-[0_0_10px_rgba(234,179,8,0.1)]' : 
            status === 'success' ? 'bg-green-900/10 border-green-500/50 shadow-[0_0_10px_rgba(34,197,94,0.1)]' : 
            status === 'error' ? 'bg-red-900/10 border-red-500/50 shadow-[0_0_10px_rgba(239,68,68,0.1)]' : 
            'bg-gray-900/50 border-gray-700 focus-within:border-blue-500/50'}
        `}>
          {status === 'running' ? (
             <div className="flex items-center justify-center w-5 h-5">
                <Loader2 className="w-4 h-4 text-yellow-500 animate-spin" />
             </div>
          ) : (
             <span className="text-emerald-500 font-bold text-lg select-none">➜</span>
          )}
          
          <form onSubmit={handleExecute} className="flex-1 relative">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={status === 'running'}
              className={`w-full bg-transparent text-white focus:outline-none font-mono text-sm placeholder-gray-600 ${status === 'running' ? 'cursor-not-allowed opacity-50' : ''}`}
              autoComplete="off"
              autoFocus
              placeholder={status === 'running' ? "Executing command..." : "Enter command..."}
            />
          </form>
        </div>
      </div>
    </div>
  );
};

export default TerminalPanel;
