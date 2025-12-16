
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { determineNextSpeaker, generateAgentResponse } from '../../services/geminiService';
import { Agent, Message } from '../../types';
import { GoogleGenAI } from '@google/genai';

// Mock the Google GenAI SDK
vi.mock('@google/genai', () => {
  return {
    GoogleGenAI: vi.fn().mockImplementation(() => ({
      models: {
        generateContent: vi.fn(),
        generateContentStream: vi.fn()
      }
    }))
  };
});

describe('Gemini Service', () => {
  const mockAgents: Agent[] = [
    { id: 'agent-1', name: 'Orchestrator', role: 'Planner', systemInstruction: 'Plan stuff', avatar: '', color: '', model: 'gemini-3-pro-preview' },
    { id: 'agent-2', name: 'Coder', role: 'Developer', systemInstruction: 'Write code', avatar: '', color: '', model: 'gemini-2.5-flash' }
  ];

  const mockHistory: Message[] = [
    { id: '1', content: 'Hello', timestamp: 1000 }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('API_KEY', 'test-api-key');
    // Default mock for fetch to avoid "fetch is not defined" errors
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('determineNextSpeaker', () => {
    it('should return an agent ID when Gemini returns a valid name', async () => {
      // Setup Gemini Mock Response
      const mockGenerateContent = vi.fn().mockResolvedValue({
        text: 'agent-2'
      });
      (GoogleGenAI as any).mockImplementation(() => ({
        models: { generateContent: mockGenerateContent }
      }));

      const result = await determineNextSpeaker(mockHistory, mockAgents, false);
      expect(result).toBe('agent-2');
    });

    it('should use Local LLM when useLocalLLM flag is true', async () => {
      // Setup Fetch Mock for Local LLM
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ data: [{ id: 'local-model' }] }) }) // Model check
        .mockResolvedValueOnce({ 
          ok: true, 
          json: () => Promise.resolve({ 
            choices: [{ message: { content: 'agent-1' } }] 
          }) 
        }); // Chat completion

      globalThis.fetch = mockFetch;

      const result = await determineNextSpeaker(mockHistory, mockAgents, true);
      
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/v1/chat/completions'), expect.anything());
      expect(result).toBe('agent-1');
    });

    it('should return null if API fails', async () => {
       const mockGenerateContent = vi.fn().mockRejectedValue(new Error('API Down'));
       (GoogleGenAI as any).mockImplementation(() => ({
         models: { generateContent: mockGenerateContent }
       }));

       const result = await determineNextSpeaker(mockHistory, mockAgents, false);
       expect(result).toBeNull();
    });

    it('should handle Local LLM network errors gracefully', async () => {
        globalThis.fetch = vi.fn().mockRejectedValue(new Error('Connection Refused'));
        const result = await determineNextSpeaker(mockHistory, mockAgents, true);
        expect(result).toBeNull();
    });
  });

  describe('generateAgentResponse', () => {
    // Helper to mock the async generator for streams
    const mockStreamResponse = (text: string, usageMetadata?: any) => {
        return {
            [Symbol.asyncIterator]: async function* () {
                yield { 
                    text, 
                    usageMetadata,
                    candidates: [{ 
                        content: { parts: [] },
                        groundingMetadata: { groundingChunks: [] }
                    }] 
                };
            }
        };
    };

    it('should calculate cost correctly for Gemini Flash models', async () => {
      const mockUsage = {
        promptTokenCount: 1000,
        candidatesTokenCount: 500,
        totalTokenCount: 1500
      };

      const mockGenerateContentStream = vi.fn().mockReturnValue(
          mockStreamResponse('Response text', mockUsage)
      );

      (GoogleGenAI as any).mockImplementation(() => ({
        models: { generateContentStream: mockGenerateContentStream }
      }));

      const targetAgent = mockAgents[1]; // Flash (Agent 2)
      const result = await generateAgentResponse(targetAgent, mockHistory, 'User input');

      expect(result.text).toBe('Response text');
      expect(result.usage?.totalTokens).toBe(1500);
      
      // Flash Pricing: Input $0.075/1M, Output $0.30/1M
      // (1000/1M * 0.075) + (500/1M * 0.30) = 0.000075 + 0.00015 = 0.000225
      expect(result.cost).toBeCloseTo(0.000225);
    });

    it('should calculate cost correctly for Gemini Pro models', async () => {
        const mockUsage = {
          promptTokenCount: 1000,
          candidatesTokenCount: 500,
          totalTokenCount: 1500
        };
  
        const mockGenerateContentStream = vi.fn().mockReturnValue(
            mockStreamResponse('Pro Response', mockUsage)
        );
  
        (GoogleGenAI as any).mockImplementation(() => ({
          models: { generateContentStream: mockGenerateContentStream }
        }));
  
        const targetAgent = mockAgents[0]; // Pro (Agent 1)
        const result = await generateAgentResponse(targetAgent, mockHistory, 'User input');
  
        expect(result.text).toBe('Pro Response');
        
        // Pro Pricing (Preview): Input $3.50/1M, Output $10.50/1M
        // (1000/1M * 3.50) + (500/1M * 10.50) = 0.0035 + 0.00525 = 0.00875
        expect(result.cost).toBeCloseTo(0.00875);
      });

    it('should use default Flash pricing for unknown models', async () => {
      const mockUsage = {
        promptTokenCount: 1000,
        candidatesTokenCount: 500,
        totalTokenCount: 1500
      };

      const mockGenerateContentStream = vi.fn().mockReturnValue(
          mockStreamResponse('Unknown Model Response', mockUsage)
      );

      (GoogleGenAI as any).mockImplementation(() => ({
        models: { generateContentStream: mockGenerateContentStream }
      }));

      // Agent with unknown model
      const unknownAgent: Agent = { ...mockAgents[0], model: 'gemini-future-model' };
      const result = await generateAgentResponse(unknownAgent, mockHistory, 'User input');

      expect(result.text).toBe('Unknown Model Response');
      // Should match Flash pricing: (1000/1M * 0.075) + (500/1M * 0.30) = 0.000225
      expect(result.cost).toBeCloseTo(0.000225);
    });

    it('should handle zero token usage correctly', async () => {
      const mockUsage = {
        promptTokenCount: 0,
        candidatesTokenCount: 0,
        totalTokenCount: 0
      };

      const mockGenerateContentStream = vi.fn().mockReturnValue(
          mockStreamResponse('Zero Response', mockUsage)
      );

      (GoogleGenAI as any).mockImplementation(() => ({
        models: { generateContentStream: mockGenerateContentStream }
      }));

      const result = await generateAgentResponse(mockAgents[1], mockHistory, 'User input');
      expect(result.cost).toBe(0);
    });

    it('should return $0.00 cost for Local LLM (Payment Knockoff)', async () => {
      // Mock LM Studio Responses
      globalThis.fetch = vi.fn()
        // 1. Model Check
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ data: [{ id: 'local-model' }] }) })
        // 2. Chat Completion
        .mockResolvedValueOnce({ 
          ok: true, 
          json: () => Promise.resolve({ 
            choices: [{ message: { content: 'Local response' } }],
            usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 }
          }) 
        });

      const result = await generateAgentResponse(mockAgents[0], mockHistory, 'Input', [], true);

      expect(result.text).toBe('Local response');
      expect(result.cost).toBe(0); // Critical requirement: Local is free
      expect(result.usage?.totalTokens).toBe(150);
      
      // Verify the fetch call structure for LM Studio
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/v1/chat/completions'),
        expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('"temperature":0.7')
        })
      );
    });

    it('should return [SYSTEM ERROR] when Local LLM fails', async () => {
        globalThis.fetch = vi.fn().mockRejectedValue(new Error('LM Studio Crashed'));
        
        const result = await generateAgentResponse(mockAgents[0], mockHistory, 'Input', [], true);
        
        expect(result.text).toContain('[SYSTEM ERROR]');
        expect(result.cost).toBeUndefined(); // Cost is undefined on error
    });

    it('should NOT call fetch when useLocalLLM is false (Strict Isolation)', async () => {
        // Setup Gemini to succeed so function doesn't fail early
        const mockGenerateContentStream = vi.fn().mockReturnValue(
            mockStreamResponse('Cloud Response')
        );
        (GoogleGenAI as any).mockImplementation(() => ({
          models: { generateContentStream: mockGenerateContentStream }
        }));

        await generateAgentResponse(mockAgents[0], mockHistory, 'Input', [], false);
        
        // Ensure we didn't accidentally hit any HTTP endpoints
        expect(globalThis.fetch).not.toHaveBeenCalled();
    });
  });
});
