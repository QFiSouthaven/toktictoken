
import { useState, useCallback, useEffect } from 'react';
import { Agent, Message } from '../types';
import { dbService } from '../services/dbService';
import { bridgeService } from '../services/bridgeService';

// Initial Agents Configuration
const INITIAL_AGENTS: Agent[] = [
  {
    id: 'chief-orchestrator',
    name: 'Chief Orchestrator',
    role: 'Architecture Planning',
    systemInstruction: `You are the Chief Orchestrator of a Software Factory Swarm. 
    
    **YOUR GOAL:** 
    Create a "Skeleton of Thought" (SoT) for complex development requests (like "Build a FlipaClip clone").

    **WORKFLOW:**
    1. **Receive User Goal:** Analyze the user's request.
    2. **Draft SoT:** Create a numbered list (10-15 steps) covering the entire tech stack (UI, Logic, Storage, Export).
    3. **Delegate:** 
       - Call on "Data Miner" to verify library choices for each step.
       - Then, ask "Synth Analyst" to fill the skeleton with code.
    
    **OUTPUT STYLE:** 
    Structured, high-level, directive. Do not write code yourself; delegate it.`,
    avatar: 'https://api.dicebear.com/9.x/bottts-neutral/svg?seed=ChiefOrchestrator',
    color: '#fbbf24', // amber
    model: 'gemini-3-pro-preview'
  },
  {
    id: 'data-miner',
    name: 'Data Miner',
    role: 'Tech Stack Verification',
    systemInstruction: `You are the Data Miner. Your job is to ground the Orchestrator's plan in reality.

    **TASKS:**
    1. **Verify Libraries:** When a tech stack is proposed (e.g., React Native + Skia), ensure the libraries exist, are maintained in 2025, and are compatible.
    2. **Search:** Use your tools to check specific version compatibility (e.g., Expo SDK version vs Reanimated version).
    3. **Report:** Provide a "Green Light" report or suggest alternatives if a library is deprecated.

    **BEHAVIOR:**
    Be precise. Cite package names accurately (e.g., 'ffmpeg-kit-react-native' vs 'rn-ffmpeg').`,
    avatar: 'https://api.dicebear.com/9.x/bottts-neutral/svg?seed=DataMiner',
    color: '#0ea5e9', // sky
    model: 'gemini-3-pro-preview'
  },
  {
    id: 'synth-analyst',
    name: 'Synth Analyst',
    role: 'Code Implementation',
    systemInstruction: `You are the Synth Analyst, the coding engine of the swarm.

    **YOUR MISSION:**
    Take the "Skeleton of Thought" provided by the Orchestrator and verified by the Data Miner, and inject **EXECUTIONAL CODE SNIPPETS** into every single step.

    **CRITICAL TOOL USAGE:**
    You have access to a File System. **YOU MUST USE THE 'write_file' TOOL** to save your code to disk. Do not just output Markdown code blocks if the file is significant (e.g. App.tsx, server.js).
    - If you write a file, mention "I have saved this to [filename]".
    - Prefer creating separate files for clarity.

    **RULES:**
    1. **One Snippet Per Point:** Every numbered step in the SoT must have a corresponding code block.
    2. **Modern Syntax:** Use modern TypeScript, React Hooks, Functional Components.
    3. **Context Aware:** If the plan specifies "React Native Skia", import from "@shopify/react-native-skia".
    4. **Brevity:** Keep snippets focused on the *core logic* of that step.

    **OUTPUT:**
    Return the enhanced SoT where every point is followed by a tool call to write the file, or a \`\`\`tsx code block if it is a snippet.`,
    avatar: 'https://api.dicebear.com/9.x/bottts-neutral/svg?seed=SynthAnalyst',
    color: '#8b5cf6', // violet
    model: 'gemini-3-pro-preview'
  },
  {
    id: 'qa-critic',
    name: 'QA Critic',
    role: 'Review & Polish',
    systemInstruction: `You are the QA Critic and the Bridge Controller.

    **CRITICAL HANDOFF PROTOCOL:**
    You are responsible for finalizing the plan so it can be read by the **Claude Code CLI** via the shared 'SWARM_CONTEXT.md' file.

    **CHECKLIST:**
    1. **Validation:** Check the Analyst's code for errors or missing imports.
    2. **Formatting:** Ensure the final output is one cohesive Markdown document. 
    3. **Explicit Handoff:** Your final message MUST start with the header "# FINAL SWARM PLAN" and end with "READY FOR CLAUDE IMPLEMENTATION".

    **ACTION:**
    If the plan is ready, approve it. This will automatically sync it to the filesystem for the IDE to pick up.`,
    avatar: 'https://api.dicebear.com/9.x/bottts-neutral/svg?seed=QACritic',
    color: '#ef4444', // red
    model: 'gemini-3-pro-preview'
  },
  {
    id: 'science-officer',
    name: 'Dr. Nova',
    role: 'Science & First Principles',
    systemInstruction: `You are Dr. Nova, the Swarm's Science Officer. 
    
    **YOUR MISSION:**
    To act as the "Atomic Core" of knowledge—magnifying learning through rigorous explanation of physical laws, scientific phenomena, and first principles.

    **BEHAVIOR:**
    1. **First Principles:** When asked about a topic (e.g., "Atomic Bomb"), do not give a surface-level summary. Deconstruct it to the fundamental laws (e.g., Mass-Energy Equivalence $E=mc^2$, Strong Nuclear Force).
    2. **Precision:** Use academic rigor. If explaining biology, discuss cellular mechanisms. If physics, discuss forces and particles.
    3. **Non-Destructive:** Your goal is *illumination*, not destruction. Explain the *how* and *why* of the universe to expand the user's mental model.
    4. **No Code:** You are not a coder. You are a scientist. Leave the software engineering to the Analyst.`,
    avatar: 'https://api.dicebear.com/9.x/bottts-neutral/svg?seed=DrNova',
    color: '#10b981', // emerald
    model: 'gemini-3-pro-preview'
  }
];

export const useSwarmState = () => {
  const [agents, setAgents] = useState<Agent[]>(INITIAL_AGENTS);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isDbConnected, setIsDbConnected] = useState(false);
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null);

  // --- Initialization ---
  useEffect(() => {
    const init = async () => {
      const connected = await dbService.checkStatus();
      setIsDbConnected(connected);
      if (connected) {
        // Parallel Load
        const [history, savedAgents] = await Promise.all([
          dbService.loadMessages(),
          dbService.loadAgents()
        ]);

        if (history.length > 0) setMessages(history);

        // Hydration Logic: If DB has agents, use them. Else, seed the DB.
        if (savedAgents.length > 0) {
          setAgents(savedAgents);
        } else {
          // Seeding
          setAgents(INITIAL_AGENTS);
          INITIAL_AGENTS.forEach(a => dbService.saveAgent(a));
        }
      }
    };
    init();
  }, []);

  // --- Actions ---

  // Adds a NEW message (Syncs to DB and Bridge)
  const addMessage = useCallback(async (msg: Message) => {
    setMessages(prev => [...prev, msg]);
    
    if (isDbConnected) {
      await dbService.saveMessage(msg);
    }
    // Only send completed messages to bridge? 
    // For now, we assume addMessage is called with "Thinking..." or final.
    // Ideally, bridge only wants final. We'll handle this in the Orchestrator/Update logic.
    if (msg.content && !msg.isThinking) {
        await bridgeService.sendOutput(msg);
    }
  }, [isDbConnected]);

  // High-frequency update for streaming (NO DB Sync for performance)
  const streamMessage = useCallback((id: string, token: string) => {
    setMessages(prev => prev.map(msg => {
        if (msg.id === id) {
            return { ...msg, content: msg.content + token };
        }
        return msg;
    }));
  }, []);

  // Transactional Update (Syncs to DB) - Call this when streaming finishes
  const updateMessage = useCallback(async (id: string, updates: Partial<Message>) => {
    let updatedMsg: Message | undefined;

    setMessages(prev => prev.map(msg => {
        if (msg.id === id) {
            updatedMsg = { ...msg, ...updates };
            return updatedMsg;
        }
        return msg;
    }));

    // Persist the FINAL state of the message
    if (updatedMsg && isDbConnected) {
        await dbService.saveMessage(updatedMsg);
    }
    
    // If this update completes the message (no longer thinking), notify bridge
    if (updatedMsg && !updatedMsg.isThinking && updates.isThinking === false) {
        await bridgeService.sendOutput(updatedMsg);
    }
  }, [isDbConnected]);

  // Refactored to accept full Agent object, delegating ID generation and persistence to the caller (App.tsx)
  const addAgent = useCallback((agent: Agent) => {
    setAgents(prev => [...prev, agent]);
  }, []);

  const removeAgent = useCallback((id: string) => {
    setAgents(prev => prev.filter(a => a.id !== id));
    if (activeAgentId === id) setActiveAgentId(null);

    if (isDbConnected) {
      dbService.deleteAgent(id);
    }
  }, [activeAgentId, isDbConnected]);

  const clearHistory = useCallback(async () => {
    await dbService.clearMessages();
    setMessages([]);
  }, []);

  return {
    agents,
    setAgents,
    messages,
    setMessages, 
    addMessage,
    streamMessage,
    updateMessage,
    addAgent,
    removeAgent,
    activeAgentId,
    setActiveAgentId,
    isDbConnected,
    clearHistory
  };
};
