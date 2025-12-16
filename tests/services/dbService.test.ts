import { describe, it, expect, vi, beforeEach } from 'vitest';
import { dbService } from '../../services/dbService';

describe('DB Service', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('checkStatus', () => {
    it('should return true if DB is connected', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        json: () => Promise.resolve({ connected: true })
      });
      const status = await dbService.checkStatus();
      expect(status).toBe(true);
    });

    it('should return false if fetch fails', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('DB Down'));
      const status = await dbService.checkStatus();
      expect(status).toBe(false);
    });
  });

  describe('loadMessages', () => {
    it('should return array of messages', async () => {
      const mockMsgs = [{ id: '1', content: 'hi' }];
      globalThis.fetch = vi.fn().mockResolvedValue({
        json: () => Promise.resolve({ messages: mockMsgs })
      });
      
      const msgs = await dbService.loadMessages();
      expect(msgs).toEqual(mockMsgs);
    });

    it('should return empty array on failure', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Failed'));
      const msgs = await dbService.loadMessages();
      expect(msgs).toEqual([]);
    });
  });

  describe('saveMessage', () => {
    it('should call POST /messages', async () => {
      const msg = { id: '1', content: 'test', timestamp: 100 };
      await dbService.saveMessage(msg);
      
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/messages'),
        expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ message: msg })
        })
      );
    });
  });
});