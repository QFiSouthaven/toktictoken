
import { GoogleGenAI, GenerateContentResponse, Type, FunctionDeclaration } from "@google/genai";
import { Agent, Message, ToolCall } from "../types";
import { tracer, traceAsync } from "../utils/telemetry"; // Import OTel
import { dbService } from "./dbService"; // Import for Memory Check

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key is missing");
  }
  return new GoogleGenAI({ apiKey });
};

interface AgentResponse {
  text: string;
  sources?: { title: string; uri: string }[];
  toolCalls?: ToolCall[];
  usage?: {
    promptTokens: number;
    responseTokens: number;
    totalTokens: number;
  };
  cost?: number;
}

// Pricing Constants (approximate per 1M tokens)
const PRICING = {
  'gemini-2.5-flash': { input: 0.075, output: 0.30 },
  'gemini-3-pro-preview': { input: 3.50, output: 10.50 }, // Placeholder for Pro pricing
  'local': { input: 0, output: 0 }
};

const calculateCost = (model: string, promptTokens: number, responseTokens: number): number => {
  const rates = PRICING[model as keyof typeof PRICING] || PRICING['gemini-2.5-flash'];
  return (promptTokens / 1_000_000 * rates.input) + (responseTokens / 1_000_000 * rates.output);
};

// --- TOOL DEFINITIONS ---

// 1. Wikipedia (Local / OpenAI Format)
const WIKIPEDIA_TOOL_DEF = {
  type: "function",
  function: {
    name: "search_wikipedia",
    description: "Search Wikipedia for information about a topic. Use this when you need factual information, history, definitions, or recent events that might be on Wikipedia.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The search query topic (e.g. 'History of the Roman Empire', 'Quantum Mechanics')"
        }
      },
      required: ["query"]
    }
  }
};

// 2. File System Tools (Google GenAI Format)
const FILE_SYSTEM_TOOLS: FunctionDeclaration[] = [
    {
        name: "write_file",
        description: "Write code or content to a file in the workspace. ALWAYS use this when generating code for the user.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                filename: {
                    type: Type.STRING,
                    description: "The name of the file (e.g., 'App.tsx', 'script.py'). No directories."
                },
                content: {
                    type: Type.STRING,
                    description: "The full text content of the file."
                }
            },
            required: ["filename", "content"]
        }
    }
];

export const determineNextSpeaker = async (
  history: Message[],
  agents: Agent[],
  useLocalLLM: boolean = false,
  localModelId: string = "mlabonne_gemma-3-27b-it-abliterated",
  baseUrl: string = "http://127.0.0.1:1234"
): Promise<string | null> => {
  
  return traceAsync('determineNextSpeaker', { 
    'swarm.agents_count': agents.length,
    'swarm.use_local_llm': useLocalLLM,
    'swarm.history_depth': history.length
  }, async (span) => {

    // OPTIMIZATION: Map to a very concise list to save tokens
    const availableAgents = agents.map(a => `${a.id} (${a.role})`).join('\n');
    
    // OPTIMIZATION: Reduced context window (10 messages) for routing to save tokens
    const context = history.slice(-10).map(msg => {
        const role = msg.agentId ? (agents.find(a => a.id === msg.agentId)?.name || 'Agent') : 'User';
        const content = msg.content.length > 200 ? msg.content.substring(0, 200) + "..." : msg.content;
        return `${role}: ${content}`;
    }).join('\n');

    const prompt = `
      Role: Orchestrator. Task: Select ONE agent ID to speak next.
      Principles: Urgency, Flow, Silence.
      History: ${context}
      Agents: ${availableAgents}
      Return: ID ONLY. No text.
    `;

    span.setAttribute('llm.prompt_length', prompt.length);

    if (useLocalLLM) {
      try {
        let activeModelId = localModelId;
        try {
            const modelRes = await fetch(`${baseUrl}/v1/models`);
            if (modelRes.ok) {
                const modelData = await modelRes.json();
                if (modelData?.data?.[0]?.id) activeModelId = modelData.data[0].id;
            }
        } catch (e) {}
        
        span.setAttribute('llm.model', activeModelId);

        const response = await fetch(`${baseUrl}/v1/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: activeModelId,
            messages: [{ role: "user", content: prompt }],
            temperature: 0.1, 
            max_tokens: 10, 
            stream: false
          })
        });

        if (!response.ok) return null;
        const data = await response.json();
        const text = data.choices?.[0]?.message?.content?.trim() || "";
        const selectedId = agents.find(a => text.includes(a.id))?.id;
        
        span.setAttribute('swarm.decision', selectedId || 'null');
        return selectedId || null;
      } catch (e) {
        console.error("Local Orchestration failed", e);
        return null;
      }
    }

    try {
      const ai = getClient();
      const model = "gemini-2.5-flash"; 
      span.setAttribute('llm.model', model);

      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: { temperature: 0.1, maxOutputTokens: 20 }
      });
      
      const text = response.text || "";
      const selectedId = agents.find(a => text.includes(a.id))?.id;

      span.setAttribute('swarm.decision', selectedId || 'null');
      if (response.usageMetadata) {
        span.setAttribute('llm.tokens.total', response.usageMetadata.totalTokenCount || 0);
      }

      return selectedId || null;
    } catch (e) {
      console.error("Gemini Orchestration failed", e);
      return null;
    }
  });
};

/**
 * Extracts simple keywords from user input to serve as memory tags.
 */
const extractMemoryTags = (text: string): string[] => {
    const stopWords = ['the', 'and', 'is', 'it', 'to', 'for', 'with', 'a', 'an'];
    return text.toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(' ')
        .filter(w => w.length > 3 && !stopWords.includes(w))
        .slice(0, 5); // Top 5 keywords
};

export const generateAgentResponse = async (
  agent: Agent,
  history: Message[],
  userMessage: string,
  allAgents: Agent[] = [],
  useLocalLLM: boolean = false,
  localModelId: string = "mlabonne_gemma-3-27b-it-abliterated",
  baseUrl: string = "http://127.0.0.1:1234",
  onToken?: (token: string) => void
): Promise<AgentResponse> => {

  return traceAsync('generateAgentResponse', {
    'agent.id': agent.id,
    'agent.name': agent.name,
    'agent.role': agent.role,
    'swarm.use_local_llm': useLocalLLM
  }, async (span) => {

    // --- CHECK BEFORE DRAFT: Version Control Hook ---
    // Before we even ask the LLM, we check our VersionHistory for past failures
    // related to this task.
    let wisdomInjection = "";
    const tags = extractMemoryTags(userMessage);
    const pastFailures = await dbService.queryMemory(tags);
    
    if (pastFailures.length > 0) {
        wisdomInjection = `
        \n\n[SYSTEM WARNING: VERSION CONTROL HISTORY]
        The Swarm has attempted similar tasks in the past and failed. You MUST avoid these specific errors:
        ${pastFailures.map(f => `- Attempted: "${f.action}" -> Failed due to: ${f.errorDetails}`).join('\n')}
        \nUse this knowledge to self-correct your plan BEFORE generating the response.
        `;
        span.setAttribute('swarm.wisdom_injected', true);
    }

    const modifiedSystemInstruction = agent.systemInstruction + wisdomInjection;

    // --- Local LM Studio Logic ---
    if (useLocalLLM) {
       try {
        let activeModelId = localModelId; 
        try {
            const modelRes = await fetch(`${baseUrl}/v1/models`);
            if (modelRes.ok) {
                const modelData = await modelRes.json();
                if (modelData?.data?.[0]?.id) activeModelId = modelData.data[0].id;
            }
        } catch (e) {}

        span.setAttribute('llm.model', activeModelId);

        const messages: any[] = history.map(msg => {
          if (msg.agentId) {
            const msgAgent = allAgents.find(a => a.id === msg.agentId);
            return { 
              role: "assistant", 
              content: `${msgAgent ? msgAgent.name : 'Agent'}: ${msg.content}` 
            };
          }
          return { role: "user", content: msg.content };
        });

        messages.unshift({ role: "system", content: modifiedSystemInstruction });
        messages.push({ role: "user", content: userMessage });

        const isModernizer = agent.name.toLowerCase().includes("modernizer");
        const tools = isModernizer ? [WIKIPEDIA_TOOL_DEF] : undefined;

        const response = await fetch(`${baseUrl}/v1/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: activeModelId, 
            messages: messages,
            temperature: 0.7,
            max_tokens: -1,
            stream: false, 
            tools: tools,
            tool_choice: tools ? "auto" : undefined
          })
        });

        if (!response.ok) {
          throw new Error(`LM Studio API Error (${response.status})`);
        }

        const data = await response.json();
        const choice = data.choices?.[0];
        const message = choice?.message;
        
        const usage = data.usage ? {
          promptTokens: data.usage.prompt_tokens,
          responseTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens
        } : undefined;

        if (usage) {
           span.setAttribute('llm.tokens.prompt', usage.promptTokens);
           span.setAttribute('llm.tokens.completion', usage.responseTokens);
           span.setAttribute('llm.tokens.total', usage.totalTokens);
        }

        const text = message?.content || "No response.";
        
        if (onToken) onToken(text);

        return { text, usage, cost: 0 };

      } catch (error: any) {
        console.error("Error connecting to LM Studio:", error);
        return { text: `[SYSTEM ERROR] ${error.message}` };
      }
    }

    // --- Google Gemini Logic ---
    try {
      const ai = getClient();
      
      span.setAttribute('llm.model', agent.model);
      
      const context = history.map(msg => {
        if (msg.agentId) {
          const msgAgent = allAgents.find(a => a.id === msg.agentId);
          return `${msgAgent ? msgAgent.name : 'Agent'}: ${msg.content}`;
        }
        return `User: ${msg.content}`;
      }).join('\n');

      const prompt = `Context:\n${context}\n\nInput:\n${userMessage}`;

      // Config Tools
      let tools: any[] = [];
      const isModernizer = agent.name === 'Modernizer' || agent.role.toLowerCase().includes('modernizer');
      if (isModernizer) tools.push({ googleSearch: {} });
      
      // Inject File System Tools for 'Coder' / 'Analyst' roles
      const isCoder = agent.role.toLowerCase().includes('coder') || agent.role.toLowerCase().includes('analyst') || agent.role.toLowerCase().includes('implementation');
      if (isCoder) {
          tools.push({ functionDeclarations: FILE_SYSTEM_TOOLS });
      }

      let thinkingConfig = undefined;
      if (agent.model === 'gemini-3-pro-preview') {
        thinkingConfig = { thinkingBudget: 4096 }; 
        span.setAttribute('llm.thinking_budget', 4096);
      }

      const config: any = {
        systemInstruction: modifiedSystemInstruction,
        temperature: 0.7,
        tools: tools.length > 0 ? tools : undefined,
      };

      if (thinkingConfig) config.thinkingConfig = thinkingConfig;

      // USE STREAMING API
      const responseStream = await ai.models.generateContentStream({
        model: agent.model,
        contents: prompt,
        config: config,
      });

      let fullText = "";
      let usage = undefined;
      let cost = 0;
      let sources: { title: string; uri: string }[] = [];
      let toolCalls: ToolCall[] = [];

      for await (const chunk of responseStream) {
         // 1. Extract Text
         const chunkText = chunk.text;
         if (chunkText) {
             fullText += chunkText;
             if (onToken) onToken(chunkText);
         }

         // 2. Extract Tool Calls (Function Calls)
         // Note: Gemini sends tool calls in the 'functionCalls' property of candidates[0].content.parts
         const calls = chunk.candidates?.[0]?.content?.parts?.filter(p => p.functionCall).map(p => p.functionCall);
         if (calls && calls.length > 0) {
            calls.forEach((call: any) => {
                if (call) {
                    toolCalls.push({
                        id: `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                        functionName: call.name,
                        args: call.args,
                        status: 'pending'
                    });
                }
            });
         }

         // 3. Extract Metadata
         if (chunk.usageMetadata) {
            usage = {
                promptTokens: chunk.usageMetadata.promptTokenCount || 0,
                responseTokens: chunk.usageMetadata.candidatesTokenCount || 0,
                totalTokens: chunk.usageMetadata.totalTokenCount || 0
            };
            cost = calculateCost(agent.model, usage.promptTokens, usage.responseTokens);
         }
         
         // 4. Extract Sources
         if (chunk.candidates?.[0]?.groundingMetadata?.groundingChunks) {
            chunk.candidates[0].groundingMetadata.groundingChunks.forEach((c: any) => {
                if (c.web?.uri) {
                    sources.push({ title: c.web.title || "Source", uri: c.web.uri });
                }
            });
         }
      }

      // De-duplicate sources
      sources = sources.filter((v, i, a) => a.findIndex(t => t.uri === v.uri) === i);

      if (usage) {
          span.setAttribute('llm.tokens.prompt', usage.promptTokens);
          span.setAttribute('llm.tokens.completion', usage.responseTokens);
          span.setAttribute('llm.tokens.total', usage.totalTokens);
          span.setAttribute('llm.cost_usd', cost);
      }
      
      return { 
          text: fullText, 
          sources: sources.length > 0 ? sources : undefined, 
          toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
          usage, 
          cost 
      };

    } catch (error: any) {
      console.error("Error generating content:", error);
      return { text: `Error connecting to the swarm intelligence: ${error.message}` };
    }
  });
};

export const getTerminalCompletions = async (
  input: string,
  historyContext: string[],
  useLocalLLM: boolean,
  localModelId: string,
  baseUrl: string
): Promise<string[]> => {
    // Basic tracing for autocomplete
    return traceAsync('getTerminalCompletions', { 'terminal.input_length': input.length }, async () => {
         const prompt = `Role: Shell Copilot. Suggest 3 valid shell commands. Context: ${historyContext.join('\n')} User: "${input}". JSON Array only.`;
         
         try {
            let text = "";
            if (useLocalLLM) {
                const response = await fetch(`${baseUrl}/v1/chat/completions`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                    model: localModelId,
                    messages: [{ role: "user", content: prompt }],
                    temperature: 0.1,
                    stream: false
                    })
                });
                if (response.ok) {
                    const data = await response.json();
                    text = data.choices?.[0]?.message?.content || "[]";
                }
            } else {
                const ai = getClient();
                const response = await ai.models.generateContent({
                    model: "gemini-2.5-flash",
                    contents: prompt,
                    config: { responseMimeType: "application/json" }
                });
                text = response.text || "[]";
            }
            const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(jsonStr);
         } catch(e) { return [] }
    });
};
