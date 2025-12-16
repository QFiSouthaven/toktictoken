
import { Message } from "../types";

const BASE_URL = 'http://127.0.0.1:1234/bridge';

/**
 * 2026 ARCHITECTURE NOTE:
 * We wrap payloads in a "ProtocolEnvelope". 
 * In the future, this structure will map 1:1 to the Model Context Protocol (MCP) 
 * or OS-level IPC standards, allowing us to swap the HTTP transport for 
 * WebSockets or Named Pipes without breaking the application logic.
 */
interface ProtocolEnvelope<T> {
  ver: '1.0';
  source: 'web-ui';
  type: 'message' | 'command' | 'event';
  timestamp: number;
  payload: T;
}

export const bridgeService = {
  /**
   * Polls the bridge for pending input from the CLI.
   */
  fetchInput: async (): Promise<Message | null> => {
    try {
      const res = await fetch(`${BASE_URL}/app/input`);
      if (res.ok) {
        const data = await res.json();
        // Unwrap logic could become more complex here in the future (signature verification, etc)
        return data.message || null;
      }
      return null;
    } catch (e) {
      // Bridge might be down, suppress error to avoid console spam during polling
      return null;
    }
  },

  /**
   * Pushes a message from the App back to the CLI context using a Protocol Envelope.
   */
  sendOutput: async (message: Message): Promise<boolean> => {
    try {
      const envelope: ProtocolEnvelope<{ message: Message }> = {
        ver: '1.0',
        source: 'web-ui',
        type: 'message',
        timestamp: Date.now(),
        payload: { message }
      };

      await fetch(`${BASE_URL}/app/output`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Currently we unwrap immediately for the proxy, but the structure is ready
        body: JSON.stringify(envelope.payload)
      });
      return true;
    } catch (e) {
      console.error("Bridge output failed", e);
      return false;
    }
  }
};
