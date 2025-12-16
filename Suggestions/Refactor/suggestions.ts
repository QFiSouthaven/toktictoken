
export interface RefactorSuggestion {
  id: string;
  component: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  proposedChange: string;
  status: 'pending' | 'in-progress' | 'completed';
}

/**
 * Registry of active architectural improvements tracked by the Swarm.
 * These items serve as input for the 'Chief Orchestrator' during self-maintenance cycles.
 */
export const PENDING_REFACTORS: RefactorSuggestion[] = [
  {
    id: 'ref-001',
    component: 'App.tsx',
    severity: 'high',
    description: 'Decouple Swarm Logic',
    proposedChange: 'Extract runSwarmCycle and associated state into a custom useSwarmCycle hook to reduce cyclomatic complexity in the root component.',
    status: 'pending'
  },
  {
    id: 'ref-002',
    component: 'ChatInterface.tsx',
    severity: 'medium',
    description: 'Virtualize Message List',
    proposedChange: 'Implement react-window for the message list to maintain 60fps scrolling performance when chat history exceeds 100 items.',
    status: 'pending'
  },
  {
    id: 'ref-003',
    component: 'WorkspacePanel.tsx',
    severity: 'low',
    description: 'Dynamic File Tree',
    proposedChange: 'Replace hardcoded FileItem components with a recursive TreeView component that parses a virtual file system structure.',
    status: 'pending'
  },
  {
    id: 'ref-004',
    component: 'proxy.js',
    severity: 'critical',
    description: 'Monolithic Backend Deconstruction',
    proposedChange: 'Refactor the single proxy.js file into a modular Express architecture (routes/controllers/services) to separate MongoDB logic, FileSystem operations, and Terminal execution into distinct modules.',
    status: 'pending'
  }
];
