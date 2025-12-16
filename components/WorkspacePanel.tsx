
import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Folder, FileCode, Database, Search, Settings, ChevronDown, Eye, RotateCw, X, Code2, Copy, Check } from 'lucide-react';

interface WorkspacePanelProps {
  isOpen: boolean;
  onToggle: () => void;
  activeTab: 'files' | 'search' | 'context' | 'settings';
  setActiveTab: (tab: 'files' | 'search' | 'context' | 'settings') => void;
  lmStudioConnected: boolean;
  lmStudioError: string | null;
  retryLmStudio: () => void;
  localModelId: string;
  localBaseUrl: string;
  setLocalBaseUrl: (url: string) => void;
  bridgeConnected: boolean;
  dbConnected: boolean;
}

// Data Definition for the File Tree
type FileNode = {
  name: string;
  type: 'file' | 'folder';
  ext?: string;
  children?: FileNode[];
};

const PROJECT_STRUCTURE: FileNode[] = [
  { name: 'SWARM_CONTEXT.md', type: 'file', ext: 'md' },
  { name: 'App.tsx', type: 'file', ext: 'tsx' },
  { name: 'index.tsx', type: 'file', ext: 'tsx' },
  { name: 'types.ts', type: 'file', ext: 'ts' },
  { name: 'proxy.js', type: 'file', ext: 'js' },
  { name: 'package.json', type: 'file', ext: 'json' },
  {
    name: 'components',
    type: 'folder',
    children: [
      { name: 'Sidebar.tsx', type: 'file', ext: 'tsx' },
      { name: 'ChatInterface.tsx', type: 'file', ext: 'tsx' },
      { name: 'WheelDashboard.tsx', type: 'file', ext: 'tsx' },
      { name: 'TerminalPanel.tsx', type: 'file', ext: 'tsx' },
      { name: 'WorkspacePanel.tsx', type: 'file', ext: 'tsx' },
      { name: 'SwarmTimeline.tsx', type: 'file', ext: 'tsx' },
      { name: 'NewAgentModal.tsx', type: 'file', ext: 'tsx' },
    ]
  },
  {
    name: 'services',
    type: 'folder',
    children: [
      { name: 'geminiService.ts', type: 'file', ext: 'ts' },
      { name: 'bridgeService.ts', type: 'file', ext: 'ts' },
      { name: 'dbService.ts', type: 'file', ext: 'ts' },
    ]
  },
  {
    name: 'hooks',
    type: 'folder',
    children: [
      { name: 'useSwarmState.ts', type: 'file', ext: 'ts' },
      { name: 'useOrchestrator.ts', type: 'file', ext: 'ts' },
      { name: 'useLmStudio.ts', type: 'file', ext: 'ts' },
      { name: 'useBridge.ts', type: 'file', ext: 'ts' },
      { name: 'useSwarmMetrics.ts', type: 'file', ext: 'ts' },
    ]
  },
  {
      name: 'utils',
      type: 'folder',
      children: [
          { name: 'telemetry.ts', type: 'file', ext: 'ts' },
          { name: 'fileUtils.ts', type: 'file', ext: 'ts' },
      ]
  }
];

const WorkspacePanel: React.FC<WorkspacePanelProps> = ({ 
    isOpen, 
    onToggle,
    activeTab,
    setActiveTab,
    bridgeConnected,
    dbConnected
}) => {
  const [viewFile, setViewFile] = useState<{name: string, content: string} | null>(null);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [copiedPath, setCopiedPath] = useState(false);

  const handleFileClick = async (fileName: string) => {
      // Security: Only allow specific files for the demo context
      if (fileName !== 'SWARM_CONTEXT.md') return;

      setIsLoadingFile(true);
      try {
          const res = await fetch(`http://127.0.0.1:1234/files/read?path=${fileName}`);
          if (res.ok) {
              const data = await res.json();
              setViewFile({ name: fileName, content: data.content });
          } else {
              alert("Failed to read file. Ensure proxy.js is running.");
          }
      } catch (e) {
          console.error(e);
      } finally {
          setIsLoadingFile(false);
      }
  };

  const handleCopyPath = () => {
    // This assumes the user is in the root of the project
    navigator.clipboard.writeText(process.cwd?.() || 'Unable to resolve path');
    setCopiedPath(true);
    setTimeout(() => setCopiedPath(false), 2000);
  };

  return (
    <div 
      className={`bg-gray-950 border-l border-gray-800 flex flex-col transition-all duration-300 ease-in-out relative ${
        isOpen ? 'w-80' : 'w-10'
      }`}
    >
      {/* FILE PREVIEW MODAL */}
      {viewFile && (
          <div className="absolute right-full top-0 h-full w-[600px] bg-gray-900 border-l border-gray-700 shadow-2xl z-50 flex flex-col animate-in slide-in-from-right-10">
              <div className="flex items-center justify-between p-3 border-b border-gray-700 bg-gray-950">
                  <div className="flex items-center gap-2 text-sm font-bold text-gray-200">
                      <FileCode className="w-4 h-4 text-yellow-500" />
                      {viewFile.name}
                  </div>
                  <button onClick={() => setViewFile(null)} className="text-gray-400 hover:text-white">
                      <X className="w-4 h-4" />
                  </button>
              </div>
              <div className="flex-1 overflow-auto p-4 custom-scrollbar bg-[#0d1117]">
                  <pre className="text-xs font-mono text-gray-300 whitespace-pre-wrap font-ligature">{viewFile.content}</pre>
              </div>
          </div>
      )}

      {/* Toggle Handle / Header */}
      <div 
        className="h-10 flex items-center justify-center hover:bg-gray-800 cursor-pointer text-gray-500 hover:text-white transition-colors border-b border-gray-900" 
        onClick={onToggle}
        title={isOpen ? "Collapse Workspace" : "Expand Workspace"}
      >
        {isOpen ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </div>

      {/* Collapsed State: Vertical Icons */}
      {!isOpen && (
        <div className="flex-1 flex flex-col items-center gap-4 py-4">
          <button className="p-2 text-gray-500 hover:text-blue-400 hover:bg-gray-800 rounded">
            <Folder className="w-4 h-4" />
          </button>
          <button className="p-2 text-gray-500 hover:text-blue-400 hover:bg-gray-800 rounded">
            <Search className="w-4 h-4" />
          </button>
           <button className="p-2 text-gray-500 hover:text-blue-400 hover:bg-gray-800 rounded">
            <Settings className="w-4 h-4" />
          </button>
          <div className="flex-1" />
          <div className="py-8 flex items-center justify-center">
             <span className="transform -rotate-90 whitespace-nowrap text-gray-600 font-mono text-[10px] tracking-widest uppercase opacity-50 select-none">
               Workspace
             </span>
          </div>
        </div>
      )}

      {/* Expanded State: Full Panel */}
      {isOpen && (
        <div className="flex-1 flex flex-col min-h-0">
          {/* Tabs */}
          <div className="flex items-center border-b border-gray-800 bg-gray-900/50">
            <button 
                onClick={() => setActiveTab('files')}
                className={`flex-1 py-2 text-xs font-medium flex items-center justify-center gap-2 border-b-2 transition-colors ${
                  activeTab === 'files' ? 'border-blue-500 text-white' : 'border-transparent text-gray-500 hover:text-gray-300'
                }`}
                title="Files"
            >
                <Folder className="w-3 h-3" />
            </button>
            <button 
                onClick={() => setActiveTab('search')}
                className={`flex-1 py-2 text-xs font-medium flex items-center justify-center gap-2 border-b-2 transition-colors ${
                  activeTab === 'search' ? 'border-blue-500 text-white' : 'border-transparent text-gray-500 hover:text-gray-300'
                }`}
                title="Search"
            >
                <Search className="w-3 h-3" />
            </button>
             <button 
                onClick={() => setActiveTab('context')}
                className={`flex-1 py-2 text-xs font-medium flex items-center justify-center gap-2 border-b-2 transition-colors ${
                  activeTab === 'context' ? 'border-blue-500 text-white' : 'border-transparent text-gray-500 hover:text-gray-300'
                }`}
                title="Memory"
            >
                <Database className="w-3 h-3" />
            </button>
            <button 
                onClick={() => setActiveTab('settings')}
                className={`flex-1 py-2 text-xs font-medium flex items-center justify-center gap-2 border-b-2 transition-colors ${
                  activeTab === 'settings' ? 'border-purple-500 text-purple-400' : 'border-transparent text-gray-500 hover:text-gray-300'
                }`}
                title="Settings & Errors"
            >
                <Settings className="w-3 h-3" />
            </button>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
            
            {/* FILES TAB */}
            {activeTab === 'files' && (
                <div className="space-y-4">
                    {/* IDE Inspiration Header */}
                    <div className="flex items-center justify-between">
                         <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Project Root</div>
                         <div className="flex items-center gap-2">
                             <button 
                                className="text-gray-500 hover:text-white transition-colors"
                                title="Copy Path"
                                onClick={handleCopyPath}
                             >
                                 {copiedPath ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                             </button>
                             <button 
                                className="text-gray-500 hover:text-blue-400 transition-colors"
                                title="Open in Editor (Cursor Recommended)"
                             >
                                 <Code2 className="w-3.5 h-3.5" />
                             </button>
                         </div>
                    </div>

                    <FileTree 
                        nodes={PROJECT_STRUCTURE} 
                        onFileClick={handleFileClick} 
                        loadingFile={isLoadingFile}
                    />

                    {/* Cursor Hint */}
                    <div className="mt-6 p-3 bg-blue-900/10 border border-blue-900/30 rounded-lg flex items-start gap-3">
                        <div className="mt-0.5">
                            <FileCode className="w-4 h-4 text-blue-400" />
                        </div>
                        <div>
                            <div className="text-xs font-bold text-gray-300 mb-1">Cursor Integration</div>
                            <p className="text-[10px] text-gray-500 leading-relaxed">
                                Open this workspace in <a href="https://cursor.com" target="_blank" className="text-blue-400 hover:underline">Cursor</a> to leverage AI-native features alongside the Swarm.
                            </p>
                        </div>
                    </div>
                </div>
            )}
            
            {activeTab === 'search' && (
                <div className="flex flex-col gap-3">
                    <input type="text" placeholder="Search..." className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-xs text-white" />
                    <div className="text-center text-gray-600 text-xs py-4 italic">No results found.</div>
                </div>
            )}
             {activeTab === 'context' && (
                 <div className="space-y-3">
                    <div className="bg-blue-900/10 border border-blue-900/30 p-3 rounded text-xs">
                        <div className="font-bold text-blue-400 mb-1">Active Context</div>
                        <p className="text-gray-400 leading-relaxed">Swarm session active. Shared memory region initialized.</p>
                    </div>
                 </div>
            )}
            {activeTab === 'settings' && (
                 <div className="space-y-4">
                    <div className="bg-gray-900 rounded-lg p-3 border border-gray-800">
                        <div className="flex items-center justify-between mb-2">
                             <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-gray-300">Proxy Bridge</span>
                             </div>
                             <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${bridgeConnected ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
                                {bridgeConnected ? 'ONLINE' : 'OFFLINE'}
                             </span>
                        </div>
                    </div>
                </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
};

// Recursive File Tree Component
interface FileTreeNodeProps {
  node: FileNode;
  onFileClick: (name: string) => void;
  loadingFile: boolean;
}

const FileTree = ({ nodes, onFileClick, loadingFile }: { nodes: FileNode[], onFileClick: (name: string) => void, loadingFile: boolean }) => {
    return (
        <div className="pl-1">
            {nodes.map((node) => (
                <FileTreeNode key={node.name} node={node} onFileClick={onFileClick} loadingFile={loadingFile} />
            ))}
        </div>
    );
};

const FileTreeNode: React.FC<FileTreeNodeProps> = ({ node, onFileClick, loadingFile }) => {
    const [expanded, setExpanded] = useState(true);

    const getColor = (ext?: string) => {
        if (ext === 'tsx' || ext === 'ts') return 'text-blue-400';
        if (ext === 'js') return 'text-yellow-400';
        if (ext === 'json') return 'text-green-400';
        if (ext === 'md') return 'text-yellow-500';
        return 'text-gray-400';
    };

    if (node.type === 'folder') {
        return (
            <div>
                <div 
                    onClick={() => setExpanded(!expanded)}
                    className="flex items-center gap-1.5 py-1 text-gray-400 hover:text-gray-200 cursor-pointer text-xs"
                >
                    <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? '' : '-rotate-90'}`} />
                    <Folder className="w-3.5 h-3.5" />
                    <span className="font-medium">{node.name}</span>
                </div>
                {expanded && node.children && (
                    <div className="pl-3 border-l border-gray-800 ml-1.5">
                        <FileTree nodes={node.children} onFileClick={onFileClick} loadingFile={loadingFile} />
                    </div>
                )}
            </div>
        );
    }

    // File Node
    const isInteractive = node.name === 'SWARM_CONTEXT.md';
    
    return (
        <div 
            onClick={() => onFileClick(node.name)}
            className={`flex items-center justify-between gap-2 px-2 py-1.5 rounded cursor-pointer group transition-colors
                ${isInteractive ? 'bg-yellow-900/10 border border-yellow-900/20 hover:bg-yellow-900/20' : 'hover:bg-gray-800 border border-transparent'}
            `}
        >
            <div className="flex items-center gap-2 overflow-hidden">
                <FileCode className={`w-3.5 h-3.5 flex-shrink-0 ${getColor(node.ext)}`} />
                <span className={`text-xs transition-colors truncate ${isInteractive ? 'text-yellow-100 font-medium' : 'text-gray-400 group-hover:text-gray-200'}`} title={node.name}>
                    {node.name}
                </span>
            </div>
            {isInteractive && (
                <div className="flex items-center">
                     {loadingFile ? <RotateCw className="w-3 h-3 text-yellow-500 animate-spin" /> : <Eye className="w-3 h-3 text-yellow-500 opacity-0 group-hover:opacity-100" />}
                </div>
            )}
        </div>
    );
};

export default WorkspacePanel;
