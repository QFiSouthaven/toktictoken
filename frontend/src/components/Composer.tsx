import { useRef, useState, type KeyboardEvent } from 'react';
import { uploadFile } from '../lib/api.js';
import type { Attachment } from '../lib/store.js';

interface Props {
  onSend: (content: string, attachments: Attachment[], model: string | null) => void;
  onStop: () => void;
  streaming: boolean;
}

export function Composer({ onSend, onStop, streaming }: Props) {
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  function autogrow() {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`;
  }

  function send() {
    const content = text.trim();
    if (!content || streaming) return;
    onSend(content, attachments, null);
    setText('');
    setAttachments([]);
    requestAnimationFrame(autogrow);
  }

  async function attach(files: FileList | null) {
    if (!files) return;
    const uploaded: Attachment[] = [];
    for (const f of Array.from(files)) {
      const r = await uploadFile(f);
      uploaded.push({ kind: r.kind as 'image' | 'file', url: r.url, mime: r.mime });
    }
    setAttachments((prev) => [...prev, ...uploaded]);
  }

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div className="composer">
      {attachments.length > 0 && (
        <div className="composer-attachments">
          {attachments.map((a, i) => (
            <div key={i} className="composer-attachment">
              {a.kind === 'image' ? (
                <img src={a.url} alt="" />
              ) : (
                <span className="file-chip">📎</span>
              )}
              <button
                className="icon-btn tiny"
                onClick={() => setAttachments(attachments.filter((_, j) => j !== i))}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="composer-row">
        <button
          className="icon-btn"
          title="Attach"
          onClick={() => fileRef.current?.click()}
          disabled={streaming}
        >
          📎
        </button>
        <input
          ref={fileRef}
          type="file"
          hidden
          onChange={(e) => {
            attach(e.target.files);
            e.target.value = '';
          }}
        />
        <textarea
          ref={taRef}
          className="composer-input"
          rows={1}
          placeholder="Message openclaw…"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            autogrow();
          }}
          onKeyDown={onKey}
        />
        {streaming ? (
          <button className="btn danger" onClick={onStop}>
            Stop
          </button>
        ) : (
          <button className="btn primary" disabled={!text.trim()} onClick={send}>
            Send
          </button>
        )}
      </div>
    </div>
  );
}
