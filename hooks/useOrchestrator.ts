
import { useState, useCallback, useRef } from 'react';
import { Agent, Message } from '../types';
import { generateAgentResponse, determineNextSpeaker } from '../services/geminiService';
import { tracer } from '../utils/telemetry'; // Import Tracer
import { Span } from '@opentelemetry/api';
import { dbService } from '../services/dbService'; // To log lessons

interface OrchestratorDeps {
  messages: Message[];
  agents: Agent[];
  addMessage: (msg: Message) => Promise<void>;
  streamMessage: (id: string, token: string) => void;
  updateMessage: (id: string, updates: Partial<Message>) => Promise<void>;
  useLocalLLM: boolean;
  localModelId: string;
  localBaseUrl: string;
}

const MAX_ROUNDS = 25;

export const useOrchestrator = ({
  messages,
  agents,
  addMessage,
  streamMessage,
  updateMessage,
  useLocalLLM,
  localModelId,
  localBaseUrl
}: OrchestratorDeps) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSwarmActive, setIsSwarmActive] = useState(false);
  const [swarmStatus, setSwarmStatus] = useState<string>('');
  const stopRef = useRef(false);

  const stopSwarm = useCallback(() => {
    stopRef.current = true;
    setIsSwarmActive(false);
    setIsProcessing(false);
    setSwarmStatus('');
  }, []);

  /**
   * Tool Approval Handler: Executes the tool and adds the result to the conversation.
   * Also stamps the result into Version Control Memory for future learning.
   */
  const handleToolApproval = useCallback(async (messageId: string, toolCallId: string, isApproved: boolean) => {
      // Find the message
      const msg = messages.find(m => m.id === messageId);
      if (!msg || !msg.toolCalls) return;

      const toolCall = msg.toolCalls.find(tc => tc.id === toolCallId);
      if (!toolCall) return;

      // Update UI state immediately
      toolCall.status = isApproved ? 'approved' : 'rejected';
      await updateMessage(messageId, { toolCalls: [...msg.toolCalls] });

      if (isApproved && toolCall.functionName === 'write_file') {
          try {
              setSwarmStatus('Writing to filesystem...');
              const { filename, content } = toolCall.args;
              
              // FIX: Use 127.0.0.1
              const res = await fetch('http://127.0.0.1:1234/files/write', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ filename, content })
              });

              const data = await res.json();
              if (res.ok) {
                  toolCall.status = 'executed';
                  toolCall.result = `Success: Written to ${data.path}`;
                  
                  // STAMP SUCCESS TO MEMORY
                  await dbService.logMemory({
                      tags: [filename, 'write_file', 'filesystem'],
                      action: `write_file: ${filename}`,
                      outcome: 'success'
                  });

                  // Add System Output Message
                  await addMessage({
                      id: Date.now().toString(),
                      agentId: 'system-fs',
                      content: `✅ **File Created:** \`${data.path}\`\nFile is available in workspace.`,
                      timestamp: Date.now()
                  });
              } else {
                  toolCall.status = 'error';
                  toolCall.result = `Error: ${data.error}`;

                  // STAMP FAILURE TO MEMORY (Critical Learning Moment)
                  await dbService.logMemory({
                      tags: [filename, 'write_file', 'filesystem'],
                      action: `write_file: ${filename}`,
                      outcome: 'failure',
                      errorDetails: data.error
                  });

                  await addMessage({ id: Date.now().toString(), agentId: 'system-fs', content: `❌ Write Failed: ${data.error}`, timestamp: Date.now() });
              }
          } catch (e: any) {
              toolCall.status = 'error';
              toolCall.result = e.message;

              // STAMP EXCEPTION TO MEMORY
              await dbService.logMemory({
                  tags: ['write_file', 'network_error'],
                  action: `write_file`,
                  outcome: 'failure',
                  errorDetails: e.message
              });
          }
      } else if (!isApproved) {
          await addMessage({
              id: Date.now().toString(),
              agentId: 'system-fs',
              content: `🚫 **Action Denied:** User rejected file write request.`,
              timestamp: Date.now()
          });
          
          // Log User Rejection as a form of "failure" (or strict constraint)
          await dbService.logMemory({
              tags: ['user_permission', 'write_file'],
              action: `write_file`,
              outcome: 'failure',
              errorDetails: 'User denied permission'
          });
      }

      await updateMessage(messageId, { toolCalls: [...msg.toolCalls] });
      setSwarmStatus('');
      
      // If swarm was active, we could resume here, but typically we wait for user to re-trigger or 
      // strictly speaking, we should probably auto-resume if it was a pause.
      // For now, we leave it paused to let the user see the result.
  }, [messages, updateMessage, addMessage]);

  const handleDirectMessage = useCallback(async (content: string, targetAgentId: string) => {
    // ... (Existing implementation unchanged for brevity, unless tool support needed here too)
    // For brevity, assuming direct message also needs tool support, but focus is on Swarm Cycle.
    // Copying existing logic just to ensure file completeness if requested, but only changing what's needed.
    // ... Keeping logic as is for now.
    const targetAgent = agents.find(a => a.id === targetAgentId);
    if (!targetAgent) return;

    stopRef.current = false;
    setIsProcessing(true);
    setSwarmStatus('Thinking...');

    try {
        const userMsg: Message = { id: Date.now().toString(), content, timestamp: Date.now() };
        await addMessage(userMsg);

        const messageId = Date.now().toString() + Math.random();
        const placeholderMsg: Message = {
            id: messageId,
            agentId: targetAgent.id,
            content: '',
            timestamp: Date.now(),
            isThinking: true
        };
        await addMessage(placeholderMsg);

        const { text, sources, usage, cost, toolCalls } = await generateAgentResponse(
            targetAgent,
            [...messages, userMsg],
            content,
            agents,
            useLocalLLM,
            localModelId,
            localBaseUrl,
            (token) => streamMessage(messageId, token)
        );

        await updateMessage(messageId, {
            content: text,
            isThinking: false,
            sources,
            usage,
            cost,
            toolCalls
        });
    } catch (e) {
        console.error(e);
    } finally {
        setIsProcessing(false);
        setSwarmStatus('');
    }
  }, [agents, messages, addMessage, streamMessage, updateMessage, useLocalLLM, localModelId, localBaseUrl]);

  const startSwarmCycle = useCallback(async (initialContent: string) => {
    stopRef.current = false;
    setIsSwarmActive(true);
    setIsProcessing(true);

    const userMsg: Message = { id: Date.now().toString(), content: initialContent, timestamp: Date.now() };
    await addMessage(userMsg);

    tracer.startActiveSpan('Swarm Cycle Root', { 
        attributes: { 'user.input': initialContent } 
    }, async (rootSpan) => {
        try {
             await runCycle([...messages, userMsg], 0, rootSpan);
        } finally {
             rootSpan.end();
        }
    });

  }, [messages, addMessage]);

  // Pass parentSpan to link recursion in the trace tree
  const runCycle = async (currentHistory: Message[], round: number, parentSpan?: Span) => {
    if (stopRef.current || round >= MAX_ROUNDS) {
      stopSwarm();
      return;
    }

    const ctx = parentSpan ? import('@opentelemetry/api').then(api => api.trace.setSpan(api.context.active(), parentSpan)) : undefined;

    await tracer.startActiveSpan(`Swarm Round ${round + 1}`, async (roundSpan) => {
        try {
            // 1. Orchestration
            setSwarmStatus('The Swinging Door is opening...');
            
            const nextAgentId = await determineNextSpeaker(
                currentHistory,
                agents,
                useLocalLLM,
                localModelId,
                localBaseUrl
            );

            let selectedAgent = agents.find(a => a.id === nextAgentId);
            
            if (!selectedAgent) {
                if (round > 5) selectedAgent = agents.find(a => a.id === 'qa-critic');
                else selectedAgent = agents.find(a => a.id === 'chief-orchestrator');
                if (!selectedAgent) { stopSwarm(); return; }
            }

            roundSpan.setAttribute('round.selected_agent', selectedAgent.id);

            // 2. Generation
            setSwarmStatus(`${selectedAgent.name} is speaking...`);
            const lastMsg = currentHistory[currentHistory.length - 1];
            const trigger = lastMsg.agentId 
                ? "Continue the planning/coding process based on previous inputs." 
                : lastMsg.content;
            
            const messageId = Date.now().toString() + Math.random();
            const placeholderMsg: Message = {
                id: messageId,
                agentId: selectedAgent.id,
                content: '',
                timestamp: Date.now(),
                isThinking: true
            };
            await addMessage(placeholderMsg);

            const { text, sources, usage, cost, toolCalls } = await generateAgentResponse(
                selectedAgent,
                currentHistory,
                trigger,
                agents,
                useLocalLLM,
                localModelId,
                localBaseUrl,
                (token) => streamMessage(messageId, token)
            );

            await updateMessage(messageId, {
                content: text,
                isThinking: false,
                sources,
                usage,
                cost,
                toolCalls
            });

            // CRITICAL: PAUSE FOR TOOL APPROVAL
            // If the agent requested a tool (file write), we MUST pause the recursion 
            // and wait for the user to click "Approve" in the UI.
            if (toolCalls && toolCalls.length > 0) {
                setSwarmStatus('Waiting for User Approval...');
                setIsProcessing(false); 
                // We do NOT call stopSwarm() because we want to remain "Active" (just paused)
                // We do NOT call runCycle(). The cycle is broken here.
                // It will be resumed manually or by a specialized "Resume" button if we add one.
                return;
            }

            const completedMsg = { ...placeholderMsg, content: text, isThinking: false, sources, usage, cost, toolCalls };
            const updatedHistory = [...currentHistory, completedMsg];

            if (stopRef.current) return stopSwarm();
            const delay = Math.floor(Math.random() * 1000) + 500;
            await new Promise(r => setTimeout(r, delay));
            if (stopRef.current) return stopSwarm();

            if (selectedAgent.id === 'qa-critic' && text.toLowerCase().includes("ready for claude")) {
                setIsSwarmActive(false);
                setIsProcessing(false);
                setSwarmStatus('Plan Synced to Context');
                return;
            }

            await runCycle(updatedHistory, round + 1, parentSpan); 

        } catch (e: any) {
            console.error("Swarm cycle error:", e);
            roundSpan.recordException(e);
            stopSwarm();
        } finally {
            roundSpan.end();
        }
    });
  };

  return {
    isProcessing,
    isSwarmActive,
    swarmStatus,
    handleDirectMessage,
    startSwarmCycle,
    stopSwarm,
    handleToolApproval
  };
};
