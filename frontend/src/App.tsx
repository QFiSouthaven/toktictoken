import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { LoginPage } from './pages/LoginPage.js';
import { ChatPage } from './pages/ChatPage.js';
import { api } from './lib/api.js';

export function App() {
  const [status, setStatus] = useState<'loading' | 'in' | 'out'>('loading');

  useEffect(() => {
    let alive = true;
    api
      .get('/api/auth/me')
      .then(() => alive && setStatus('in'))
      .catch(() => alive && setStatus('out'));
    return () => {
      alive = false;
    };
  }, []);

  if (status === 'loading') {
    return <div className="full-center muted">loading…</div>;
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={
          status === 'in' ? (
            <Navigate to="/" replace />
          ) : (
            <LoginPage onLogin={() => setStatus('in')} />
          )
        }
      />
      <Route
        path="/*"
        element={
          status === 'in' ? (
            <ChatPage onLogout={() => setStatus('out')} />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
    </Routes>
  );
}
