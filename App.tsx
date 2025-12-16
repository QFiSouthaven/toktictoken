
import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import ChatInterface from './components/ChatInterface';
import NewAgentModal from './components/NewAgentModal';
import TerminalPanel from './components/TerminalPanel';
import WorkspacePanel from './components/WorkspacePanel';
import WheelDashboard from './components/WheelDashboard';
import { useLmStudio } from './hooks/useLmStudio';
import { useSwarmState } from './hooks/useSwarmState';
import { useOrchestrator } from './hooks/useOrchestrator';
import { useBridge } from './hooks/useBridge';
import { dbService } from './services/dbService';
import { Agent } from './types';

export default function App() {
  // 1. State Hooks (Domain Data)
  const { 
    agents, 
    setAgents,
    messages, 
    addMessage, 
    streamMessage, 
    updateMessage, 
    addAgent, 
    removeAgent, 
    activeAgentId, 
    setActiveAgentId,
    isDbConnected,
    clearHistory
  } = useSwarmState();

  // 2. UI State (Layout)
  const [viewMode, setViewMode] = useState<'dashboard' | 'admin'>('dashboard');
  const [useLocalLLM, setUseLocalLLM] = useState(false);
  const [autoConnect, setAutoConnect] = useState(true);
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(false);
  const [workspaceTab, setWorkspaceTab] = useState<'files' | 'search' | 'context' | 'settings'>('files');

  // Terminal Persistence
  const [terminalHeight, setTerminalHeight] = useState(() => {
    if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('swarm_terminal_height');
        return saved ? parseInt(saved, 10) : 300;
    }
    return 300;
  });

  // --- LOCAL STORAGE PERSISTENCE FOR AGENTS ---
  
  // Load Agents from LocalStorage on mount
  useEffect(() => {
    const savedAgents = localStorage.getItem('swarm_agents');
    if (savedAgents) {
      try {
        const parsed = JSON.parse(savedAgents);
        if (Array.isArray(parsed) && parsed.length > 0) {
           setAgents(parsed);
        }
      } catch (err) {
        console.error("Failed to parse agents from localStorage", err);
      }
    }
  }, []);

  // Save Agents to LocalStorage whenever they change
  useEffect(() => {
    if (agents.length > 0) {
      localStorage.setItem('swarm_agents', JSON.stringify(agents));
    }
  }, [agents]);


  // 3. Logic Hooks (Side Effects & Orchestration)
  const { 
    isConnected: isLmStudioConnected, 
    modelId: localModelId, 
    baseUrl: localBaseUrl, 
    setBaseUrl: setLocalBaseUrl,
    error: lmStudioError,
    retryConnection: retryLmStudio
  } = useLmStudio(useLocalLLM, autoConnect);

  const {
    isProcessing,
    isSwarmActive,
    swarmStatus,
    handleDirectMessage,
    startSwarmCycle,
    stopSwarm,
    handleToolApproval 
  } = useOrchestrator({
    messages,
    agents,
    addMessage,
    streamMessage, 
    updateMessage, 
    useLocalLLM,
    localModelId,
    localBaseUrl
  });

  // Bridge Hook
  const { isBridgeConnected } = useBridge(autoConnect, (content) => {
    startSwarmCycle(content);
  });

  // 4. Interaction Handlers
  const onSendMessage = async (content: string) => {
    if (content.startsWith('/ping')) {
       const pingId = content.split(' ')[1] || '';
       const systemMsg = {
           id: Date.now().toString(),
           agentId: 'system-loopback',
           content: `PONG: System Loopback Active. ID: ${pingId}`,
           timestamp: Date.now()
       };
       const userMsg = { id: Date.now().toString(), content, timestamp: Date.now() };
       await addMessage(userMsg);
       await addMessage(systemMsg);
       return;
    }

    if (activeAgentId) {
      await handleDirectMessage(content, activeAgentId);
    } else {
      await startSwarmCycle(content);
    }
  };

  // Controller-level Agent Creation Handler
  // Coordinates ID generation, DB persistence, and State Update
  const handleAgentSave = async (agentData: Omit<Agent, 'id'>) => {
    const newAgent: Agent = {
        ...agentData,
        id: Date.now().toString()
    };

    // 1. Explicitly Persist to DB
    if (isDbConnected) {
        await dbService.saveAgent(newAgent);
    }

    // 2. Update Local State
    addAgent(newAgent);
  };

  // Global Key Listener for Terminal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle Terminal on backtick `
      if (e.key === '`') {
         // Prevent default only if we aren't focused on a text input (allows typing ` in code)
         // Or just prevent default always if we want Quake style strictly. 
         // Strategy: If active element is body or button, toggle.
         const tag = document.activeElement?.tagName.toLowerCase();
         if (tag !== 'input' && tag !== 'textarea') {
             e.preventDefault();
             setIsTerminalOpen(prev => !prev);
         }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleInternalCommand = (cmd: string) => {
      if (cmd.toLowerCase().startsWith('/show me the term')) {
          setViewMode('admin');
          setIsTerminalOpen(false);
      } else if (cmd === '/dashboard') {
          setViewMode('dashboard');
          setIsTerminalOpen(false);
      }
  };

  const handleTerminalResize = (h: number) => {
    setTerminalHeight(h);
    localStorage.setItem('swarm_terminal_height', h.toString());
  };

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100 font-sans overflow-hidden relative">
      
      {/* GLOBAL TERMINAL OVERLAY */}
      {isTerminalOpen && (
          <div className="absolute inset-x-0 top-0 z-50 animate-in slide-in-from-top duration-300 shadow-2xl">
              <TerminalPanel 
                isOpen={isTerminalOpen} 
                onClose={() => setIsTerminalOpen(false)}
                baseUrl={localBaseUrl} 
                height={terminalHeight}
                onResize={handleTerminalResize}
                useLocalLLM={useLocalLLM}
                localModelId={localModelId}
                onInternalCommand={handleInternalCommand}
              />
          </div>
      )}

      {/* VIEW SWITCHER */}
      {viewMode === 'dashboard' ? (
          <div className="w-full h-full animate-in fade-in duration-500">
             <WheelDashboard 
                onStart={onSendMessage}
                status={swarmStatus}
                isProcessing={isProcessing}
                messages={messages}
                agents={agents}
             />
          </div>
      ) : (
          /* ADMIN PANEL (Original Layout) */
          <div className="w-full h-full flex animate-in fade-in duration-500">
              <Sidebar 
                agents={agents}
                activeAgentId={activeAgentId}
                onSelectAgent={setActiveAgentId}
                onAddAgent={() => setIsModalOpen(true)}
                onRemoveAgent={removeAgent}
                useLocalLLM={useLocalLLM}
                onToggleLocalLLM={() => setUseLocalLLM(!useLocalLLM)}
                isLmStudioConnected={isLmStudioConnected}
                localBaseUrl={localBaseUrl}
                setLocalBaseUrl={setLocalBaseUrl}
                connectionError={lmStudioError}
                autoConnect={autoConnect}
                onToggleAutoConnect={() => setAutoConnect(!autoConnect)}
                isBridgeConnected={isBridgeConnected}
                onRetryConnection={retryLmStudio}
                isTerminalOpen={isTerminalOpen}
                onToggleTerminal={() => setIsTerminalOpen(!isTerminalOpen)}
                isDbConnected={isDbConnected}
                onClearDatabase={clearHistory}
                onOpenSettings={() => { setIsWorkspaceOpen(true); setWorkspaceTab('settings'); }}
                messages={messages}
              />
              
              <main className="flex-1 flex flex-col min-w-0 h-full relative border-r border-gray-800">
                <div className="flex-1 overflow-hidden">
                  <ChatInterface 
                    activeAgentId={activeAgentId}
                    agents={agents}
                    messages={messages}
                    onSendMessage={onSendMessage}
                    isProcessing={isProcessing}
                    isSwarmActive={isSwarmActive}
                    onStopSwarm={stopSwarm}
                    isLocalLLM={useLocalLLM}
                    isLmStudioConnected={isLmStudioConnected}
                    statusText={swarmStatus}
                    onToolAction={handleToolApproval}
                  />
                </div>
              </main>

              <WorkspacePanel 
                isOpen={isWorkspaceOpen} 
                onToggle={() => setIsWorkspaceOpen(!isWorkspaceOpen)}
                activeTab={workspaceTab}
                setActiveTab={setWorkspaceTab}
                lmStudioConnected={isLmStudioConnected}
                lmStudioError={lmStudioError}
                retryLmStudio={retryLmStudio}
                localModelId={localModelId}
                localBaseUrl={localBaseUrl}
                setLocalBaseUrl={setLocalBaseUrl}
                bridgeConnected={isBridgeConnected}
                dbConnected={isDbConnected}
              />

              <NewAgentModal 
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleAgentSave}
              />
          </div>
      )}
    </div>
  );
}
