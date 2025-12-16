
export interface Agent {
  id: string;
  name: string;
  role: string;
  systemInstruction: string;
  avatar: string;
  color: string;
  model: string;
}

export interface ToolCall {
  id: string;
  functionName: string;
  args: Record<string, any>;
  status: 'pending' | 'approved' | 'rejected' | 'executed' | 'error';
  result?: string;
}

export interface Message {
  id: string;
  agentId?: string; // If undefined, it's a user message
  content: string;
  timestamp: number;
  isThinking?: boolean;
  sources?: { title: string; uri: string }[];
  toolCalls?: ToolCall[]; // New: Structured tool invocations
  // Telemetry for Token Efficiency & Cost Tracking
  usage?: {
    promptTokens: number;
    responseTokens: number;
    totalTokens: number;
  };
  cost?: number; // Estimated USD cost
}

export interface ChatSession {
  id: string;
  messages: Message[];
}

// --- VERSION CONTROL / LEARNING MEMORY ---
export interface VersionControlEntry {
  id?: string;
  tags: string[];           // Keywords to match context (e.g. ["react", "file-write", "auth"])
  action: string;           // What was attempted (e.g. "write_file: App.tsx")
  outcome: 'success' | 'failure';
  errorDetails?: string;    // If failed, why? (e.g. "SyntaxError", "Import not found")
  timestamp: number;
}
