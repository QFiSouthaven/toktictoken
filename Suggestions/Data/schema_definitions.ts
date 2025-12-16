
/**
 * SCHEMA REGISTRY
 * 
 * Formal definitions for the data structures used across the Local Swarm ecosystem.
 * These definitions serve as the "Contract" between the React App, the Proxy, and external tools.
 */

// 1. The Core Atom: A Message
export interface SwarmMessageSchema {
  id: string;              // UUID
  agentId?: string;        // UUID of the sender (undefined = User)
  content: string;         // Markdown content
  timestamp: number;       // Unix Epoch
  metadata?: {
    isThinking?: boolean;  // True if this is an internal monologue (Chain of Thought)
    tokensUsed?: number;   // Cost tracking
    latencyMs?: number;    // Performance tracking
  };
  attachments?: {
    type: 'image' | 'file' | 'code_snippet';
    url: string;
    mimeType: string;
  }[];
  sources?: {
    title: string;
    uri: string;
    snippet?: string;
  }[];
}

// 2. The Agent Manifest (Portable Persona)
export interface AgentManifestSchema {
  id: string;
  name: string;
  role: string;
  systemInstruction: string; // The "Prompt"
  parameters: {
    temperature: number;
    topK: number;
    topP: number;
    model: 'gemini-2.5-flash' | 'gemini-3-pro-preview' | string;
  };
  capabilities: {
    canUseTools: boolean;
    canBrowseWeb: boolean;
    canExecuteCode: boolean;
  };
  visuals: {
    avatarUrl: string;
    primaryColor: string; // Hex
  };
}

// 3. The Bridge Protocol (Inter-Process Communication)
export interface BridgePacketSchema {
  version: 'v1';
  type: 'COMMAND' | 'RESPONSE' | 'EVENT';
  source: 'CLI' | 'WEB_UI' | 'VSCODE_EXTENSION';
  payload: SwarmMessageSchema | { command: string; args: string[] };
  signature?: string; // HMAC for security (Future)
}
