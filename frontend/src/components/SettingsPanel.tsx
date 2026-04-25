import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';

type Settings = Record<string, string>;

export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get<Settings>('/api/settings'),
  });
  const [form, setForm] = useState<Settings>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (q.data) setForm(q.data);
  }, [q.data]);

  function set(k: string, v: string) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  async function save() {
    setSaving(true);
    try {
      await api.put('/api/settings', form);
      await qc.invalidateQueries({ queryKey: ['settings'] });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <h2>Settings</h2>
          <button className="icon-btn" onClick={onClose}>
            ×
          </button>
        </header>
        <div className="modal-body">
          <Field label="Persona name">
            <input
              className="input"
              value={form.persona ?? ''}
              onChange={(e) => set('persona', e.target.value)}
            />
          </Field>
          <Field label="System prompt">
            <textarea
              className="input"
              rows={4}
              spellCheck={false}
              autoCorrect="off"
              autoCapitalize="off"
              translate="no"
              data-gramm="false"
              value={form.system_prompt ?? ''}
              onChange={(e) => set('system_prompt', e.target.value)}
            />
          </Field>
          <Field label="Default model">
            <input
              className="input"
              value={form.default_model ?? ''}
              onChange={(e) => set('default_model', e.target.value)}
              placeholder="leave blank for LM Studio default"
            />
          </Field>
          <Field label="Embedding model (for RAG)">
            <input
              className="input"
              value={form.embedding_model ?? ''}
              onChange={(e) => set('embedding_model', e.target.value)}
              placeholder="e.g. text-embedding-nomic-embed-text-v1.5"
            />
          </Field>
          <div className="grid3">
            <Field label="Temperature">
              <input
                className="input"
                value={form.temperature ?? ''}
                onChange={(e) => set('temperature', e.target.value)}
              />
            </Field>
            <Field label="Top-P">
              <input
                className="input"
                value={form.top_p ?? ''}
                onChange={(e) => set('top_p', e.target.value)}
              />
            </Field>
            <Field label="Max tokens">
              <input
                className="input"
                value={form.max_tokens ?? ''}
                onChange={(e) => set('max_tokens', e.target.value)}
              />
            </Field>
          </div>
          <Field label="RAG enabled">
            <select
              className="input"
              value={form.rag_enabled ?? 'false'}
              onChange={(e) => set('rag_enabled', e.target.value)}
            >
              <option value="false">off</option>
              <option value="true">on</option>
            </select>
          </Field>
        </div>
        <footer className="modal-foot">
          <button className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" disabled={saving} onClick={save}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </footer>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}
