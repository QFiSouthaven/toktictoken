import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import { useUi, type ChatSummary } from '../lib/store.js';
import { ChatList } from '../components/ChatList.js';
import { ChatWindow } from '../components/ChatWindow.js';
import { SettingsPanel } from '../components/SettingsPanel.js';

export function ChatPage({ onLogout }: { onLogout: () => void }) {
  const qc = useQueryClient();
  const { selectedChatId, selectChat, settingsOpen, toggleSettings } = useUi();

  const chatsQuery = useQuery({
    queryKey: ['chats'],
    queryFn: () => api.get<{ chats: ChatSummary[] }>('/api/chats'),
  });

  useEffect(() => {
    const chats = chatsQuery.data?.chats ?? [];
    if (selectedChatId == null && chats[0]) selectChat(chats[0].id);
  }, [chatsQuery.data, selectedChatId, selectChat]);

  async function newChat() {
    const chat = await api.post<{ id: number }>('/api/chats', {});
    await qc.invalidateQueries({ queryKey: ['chats'] });
    selectChat(chat.id);
  }

  async function deleteChat(id: number) {
    await api.delete(`/api/chats/${id}`);
    await qc.invalidateQueries({ queryKey: ['chats'] });
    if (selectedChatId === id) selectChat(null);
  }

  async function logout() {
    await api.post('/api/auth/logout');
    onLogout();
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <header className="sidebar-head">
          <span className="brand-sm">openclaw</span>
          <button className="icon-btn" title="New chat" onClick={newChat}>
            +
          </button>
        </header>
        <ChatList
          chats={chatsQuery.data?.chats ?? []}
          selectedId={selectedChatId}
          onSelect={selectChat}
          onDelete={deleteChat}
        />
        <footer className="sidebar-foot">
          <button className="btn ghost" onClick={() => toggleSettings(true)}>
            Settings
          </button>
          <button className="btn ghost" onClick={logout}>
            Sign out
          </button>
        </footer>
      </aside>
      <main className="main">
        {selectedChatId ? (
          <ChatWindow chatId={selectedChatId} />
        ) : (
          <div className="full-center muted">
            <div className="empty">
              <div className="empty-title">No chat selected</div>
              <button className="btn primary" onClick={newChat}>
                Start a new chat
              </button>
            </div>
          </div>
        )}
      </main>
      {settingsOpen && <SettingsPanel onClose={() => toggleSettings(false)} />}
    </div>
  );
}
