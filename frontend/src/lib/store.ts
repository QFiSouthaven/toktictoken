import { create } from 'zustand';

export interface ChatSummary {
  id: number;
  title: string;
  model: string | null;
  updated_at: number;
}

export interface Attachment {
  kind: 'image' | 'file';
  url: string;
  mime?: string;
}

export interface UiMessage {
  id?: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  attachments?: Attachment[];
  pending?: boolean;
}

interface UiState {
  selectedChatId: number | null;
  selectChat: (id: number | null) => void;
  settingsOpen: boolean;
  toggleSettings: (open?: boolean) => void;
}

export const useUi = create<UiState>((set) => ({
  selectedChatId: null,
  selectChat: (id) => set({ selectedChatId: id }),
  settingsOpen: false,
  toggleSettings: (open) => set((s) => ({ settingsOpen: open ?? !s.settingsOpen })),
}));
