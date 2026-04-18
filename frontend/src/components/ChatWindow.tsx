import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import { streamSse } from '../lib/sse.js';
import type { Attachment, UiMessage } from '../lib/store.js';
import { MessageBubble } from './MessageBubble.js';
import { Composer } from './Composer.js';
import { ModelPicker } from './ModelPicker.js';

interface ApiMessage {
  id: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  attachments_json: string | null;
  created_at: number;
}

interface ChatDetail {
  chat: { id: number; title: string; model: string | null; system_prompt: string | null };
  messages: ApiMessage[];
}

export function ChatWindow({ chatId }: { chatId: number }) {
  const qc = useQueryClient();
  const detail = useQuery({
    queryKey: ['chat', chatId],
    queryFn: () => api.get<ChatDetail>(`/api/chats/${chatId}/messages`),
  });

  const [live, setLive] = useState<UiMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<null | (() => void)>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const persisted: UiMessage[] = (detail.data?.messages ?? []).map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    attachments: m.attachments_json ? (JSON.parse(m.attachments_json) as Attachment[]) : undefined,
  }));
  const all = [...persisted, ...live];

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [all.length, live]);

  useEffect(() => {
    setLive([]);
    abortRef.current?.();
    abortRef.current = null;
  }, [chatId]);

  async function send(content: string, attachments: Attachment[], model: string | null) {
    setStreaming(true);
    setLive([
      { role: 'user', content, attachments },
      { role: 'assistant', content: '', pending: true },
    ]);
    let assistant = '';
    const stop = streamSse(
      `/api/chats/${chatId}/messages`,
      { content, attachments, ...(model ? { model } : {}) },
      {
        onDelta: (c) => {
          assistant += c;
          setLive((prev) => {
            const next = [...prev];
            next[next.length - 1] = { role: 'assistant', content: assistant, pending: true };
            return next;
          });
        },
        onDone: async () => {
          setStreaming(false);
          abortRef.current = null;
          setLive([]);
          await qc.invalidateQueries({ queryKey: ['chat', chatId] });
          await qc.invalidateQueries({ queryKey: ['chats'] });
        },
        onError: (msg) => {
          setStreaming(false);
          setLive((prev) => {
            const next = [...prev];
            next[next.length - 1] = {
              role: 'assistant',
              content: assistant || `_error: ${msg}_`,
            };
            return next;
          });
        },
      },
    );
    abortRef.current = stop;
  }

  function stop() {
    abortRef.current?.();
    abortRef.current = null;
    setStreaming(false);
  }

  return (
    <div className="chatwindow">
      <header className="chat-head">
        <div className="chat-head-title">{detail.data?.chat.title ?? '…'}</div>
        <ModelPicker chatId={chatId} currentModel={detail.data?.chat.model ?? null} />
      </header>
      <div className="messages" ref={scrollRef}>
        {all.length === 0 && (
          <div className="muted small pad">Send a message to start the conversation.</div>
        )}
        {all.map((m, i) => (
          <MessageBubble key={m.id ?? `live-${i}`} message={m} />
        ))}
      </div>
      <Composer onSend={send} onStop={stop} streaming={streaming} />
    </div>
  );
}
