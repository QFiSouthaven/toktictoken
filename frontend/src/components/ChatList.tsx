import { useState } from 'react';
import type { ChatSummary } from '../lib/store.js';

interface Props {
  chats: ChatSummary[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  onDelete: (id: number) => void;
}

export function ChatList({ chats, selectedId, onSelect, onDelete }: Props) {
  const [q, setQ] = useState('');
  const filtered = chats.filter((c) => c.title.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="chatlist">
      <input
        className="input search"
        placeholder="Search chats…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <ul className="chatlist-items">
        {filtered.map((c) => (
          <li key={c.id} className={`chatlist-item ${selectedId === c.id ? 'active' : ''}`}>
            <button className="chatlist-row" onClick={() => onSelect(c.id)}>
              <span className="chat-title">{c.title}</span>
              <span className="chat-meta">{new Date(c.updated_at).toLocaleDateString()}</span>
            </button>
            <button
              className="icon-btn danger"
              title="Delete chat"
              onClick={(e) => {
                e.stopPropagation();
                if (confirm('Delete this chat?')) onDelete(c.id);
              }}
            >
              ×
            </button>
          </li>
        ))}
        {filtered.length === 0 && <li className="muted small pad">No chats</li>}
      </ul>
    </div>
  );
}
