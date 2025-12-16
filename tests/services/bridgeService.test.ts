import { describe, it, expect, vi, beforeEach } from 'vitest';
import { bridgeService } from '../../services/bridgeService';

describe('Bridge Service', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
    vi.spyOn(console, 'error').mockImplementation(() => {}); // Silence errors
  });

  describe('fetchInput', () => {
    it('should return message when bridge returns 200 and data', async () => {
      const mockMessage = { id: '123', content: 'Task from CLI' };
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ message: mockMessage })
      });

      const result = await bridgeService.fetchInput();
      expect(result).toEqual(mockMessage);
    });

    it('should return null when bridge returns 200 but no message', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ message: null })
      });

      const result = await bridgeService.fetchInput();
      expect(result).toBeNull();
    });

    it('should return null gracefully when fetch fails (Bridge Offline)', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Connection refused'));

      const result = await bridgeService.fetchInput();
      expect(result).toBeNull();
      // Should handle error internally without throwing
    });
  });

  describe('sendOutput', () => {
    it('should post message to bridge/app/output', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: true });
      
      const mockMsg = { id: '1', content: 'Response', timestamp: 123 };
      const success = await bridgeService.sendOutput(mockMsg);

      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/app/output'),
        expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ message: mockMsg })
        })
      );
      expect(success).toBe(true);
    });

    it('should return false on failure', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network Error'));
      const success = await bridgeService.sendOutput({ id: '1', content: 'test', timestamp: 0 });
      expect(success).toBe(false);
    });
  });
});