export type ChatRole = 'system' | 'user' | 'assistant' | 'tool';

export interface ChatMessagePart {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: { url: string };
}

export interface ChatMessage {
  role: ChatRole;
  content: string | ChatMessagePart[];
  name?: string;
  tool_call_id?: string;
  tool_calls?: unknown;
}

export interface ChatCompletionOptions {
  model?: string;
  messages: ChatMessage[];
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  tools?: unknown;
  tool_choice?: unknown;
  signal?: AbortSignal;
}

export interface LMStudioModel {
  id: string;
  object: string;
  owned_by?: string;
}

export class LMStudioClient {
  constructor(private readonly baseUrl: string) {}

  private url(path: string): string {
    return `${this.baseUrl.replace(/\/$/, '')}${path}`;
  }

  async listModels(): Promise<LMStudioModel[]> {
    const res = await fetch(this.url('/v1/models'));
    if (!res.ok) throw new Error(`LM Studio /v1/models failed: ${res.status}`);
    const json = (await res.json()) as { data: LMStudioModel[] };
    return json.data ?? [];
  }

  async embeddings(model: string, input: string | string[]): Promise<number[][]> {
    const res = await fetch(this.url('/v1/embeddings'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model, input }),
    });
    if (!res.ok) throw new Error(`LM Studio /v1/embeddings failed: ${res.status}`);
    const json = (await res.json()) as { data: { embedding: number[] }[] };
    return json.data.map((d) => d.embedding);
  }

  /**
   * Streams chat completions as raw SSE delta lines from LM Studio.
   * Yields objects parsed from each `data: {...}` line; skips `[DONE]`.
   */
  async *streamChat(opts: ChatCompletionOptions): AsyncGenerator<unknown, void, void> {
    const body = {
      model: opts.model ?? 'local-model',
      messages: opts.messages,
      temperature: opts.temperature,
      top_p: opts.top_p,
      max_tokens: opts.max_tokens,
      tools: opts.tools,
      tool_choice: opts.tool_choice,
      stream: true,
    };
    const res = await fetch(this.url('/v1/chat/completions'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: opts.signal,
    });
    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => '');
      throw new Error(`LM Studio stream failed: ${res.status} ${text}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buf.indexOf('\n')) !== -1) {
        const raw = buf.slice(0, idx).replace(/\r$/, '');
        buf = buf.slice(idx + 1);
        if (!raw.startsWith('data:')) continue;
        const payload = raw.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        try {
          yield JSON.parse(payload);
        } catch {
          // tolerate parse errors on partial frames
        }
      }
    }
  }
}
