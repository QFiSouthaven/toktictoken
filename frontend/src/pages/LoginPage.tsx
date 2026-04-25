import { useState, type FormEvent } from 'react';
import { api } from '../lib/api.js';

export function LoginPage({ onLogin }: { onLogin: () => void }) {
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await api.post('/api/auth/login', { password });
      onLogin();
    } catch {
      setErr('Invalid password');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="full-center">
      <form className="card login-card" onSubmit={submit}>
        <h1 className="brand">openclaw</h1>
        <p className="muted small">Private · self-hosted · local LLM</p>
        <input
          className="input"
          type="password"
          autoFocus
          autoComplete="current-password"
          spellCheck={false}
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {err && <div className="error">{err}</div>}
        <button className="btn primary" disabled={busy || !password}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
