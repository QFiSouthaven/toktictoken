export interface SseHandlers {
  onDelta?: (content: string) => void;
  onToolCalls?: (calls: unknown) => void;
  onDone?: () => void;
  onError?: (msg: string) => void;
}

/**
 * POSTs JSON and parses a text/event-stream response body.
 * Returns an abort function.
 */
export function streamSse(
  url: string,
  body: unknown,
  handlers: SseHandlers,
): () => void {
  const ctrl = new AbortController();
  (async () => {
    try {
      const res = await fetch(url, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json', accept: 'text/event-stream' },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        handlers.onError?.(`HTTP ${res.status}`);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let sep: number;
        while ((sep = buf.indexOf('\n\n')) !== -1) {
          const frame = buf.slice(0, sep);
          buf = buf.slice(sep + 2);
          const lines = frame.split('\n');
          let event = 'message';
          let data = '';
          for (const line of lines) {
            if (line.startsWith('event:')) event = line.slice(6).trim();
            else if (line.startsWith('data:')) data += line.slice(5).trim();
          }
          if (!data) continue;
          try {
            const parsed = JSON.parse(data);
            if (event === 'delta') handlers.onDelta?.(parsed.content ?? '');
            else if (event === 'tool_calls') handlers.onToolCalls?.(parsed);
            else if (event === 'done') handlers.onDone?.();
            else if (event === 'error') handlers.onError?.(parsed.message ?? 'error');
          } catch {
            // ignore partial
          }
        }
      }
      handlers.onDone?.();
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        handlers.onError?.((err as Error).message);
      }
    }
  })();
  return () => ctrl.abort();
}
