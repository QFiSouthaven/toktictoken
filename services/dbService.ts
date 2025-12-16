
import { Message, Agent, VersionControlEntry } from "../types";

const BASE_URL = 'http://127.0.0.1:1234/db';

export const dbService = {
  /**
   * Checks if the backend DB connection is active.
   */
  checkStatus: async (): Promise<boolean> => {
    try {
      const res = await fetch(`${BASE_URL}/status`);
      const data = await res.json();
      return data.connected;
    } catch (e) {
      return false;
    }
  },

  /**
   * Loads full chat history.
   */
  loadMessages: async (): Promise<Message[]> => {
    try {
      const res = await fetch(`${BASE_URL}/messages`);
      const data = await res.json();
      return Array.isArray(data.messages) ? data.messages : [];
    } catch (e) {
      console.error("Failed to load history", e);
      return [];
    }
  },

  /**
   * Saves or upserts a single message.
   */
  saveMessage: async (message: Message): Promise<void> => {
    try {
      await fetch(`${BASE_URL}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
      });
    } catch (e) {
      console.error("Failed to save message", e);
    }
  },

  /**
   * Clears all messages from the database.
   */
  clearMessages: async (): Promise<void> => {
    try {
      await fetch(`${BASE_URL}/messages`, { method: 'DELETE' });
    } catch (e) {
      console.error("Failed to clear DB", e);
    }
  },

  /**
   * Loads all Agents
   */
  loadAgents: async (): Promise<Agent[]> => {
    try {
      const res = await fetch(`${BASE_URL}/agents`);
      const data = await res.json();
      return Array.isArray(data.agents) ? data.agents : [];
    } catch (e) {
      console.error("Failed to load agents", e);
      return [];
    }
  },

  /**
   * Saves or upserts a single Agent
   */
  saveAgent: async (agent: Agent): Promise<void> => {
    try {
      await fetch(`${BASE_URL}/agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent })
      });
    } catch (e) {
      console.error("Failed to save agent", e);
    }
  },

  /**
   * Deletes an Agent by ID
   */
  deleteAgent: async (id: string): Promise<void> => {
    try {
      await fetch(`${BASE_URL}/agents/${id}`, { method: 'DELETE' });
    } catch (e) {
      console.error("Failed to delete agent", e);
    }
  },

  // --- LEARNING SYSTEM ---

  logMemory: async (entry: Omit<VersionControlEntry, 'id' | 'timestamp'>): Promise<void> => {
    try {
      await fetch(`${BASE_URL}/memory/log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry)
      });
    } catch (e) {
      console.error("Failed to log memory", e);
    }
  },

  queryMemory: async (tags: string[]): Promise<VersionControlEntry[]> => {
    try {
      const res = await fetch(`${BASE_URL}/memory/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags })
      });
      const data = await res.json();
      return Array.isArray(data.lessons) ? data.lessons : [];
    } catch (e) {
      console.error("Failed to query memory", e);
      return [];
    }
  }
};
