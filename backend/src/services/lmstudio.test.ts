import { describe, it, expect, vi, afterEach } from 'vitest';
import { LMStudioClient } from './lmstudio.js';

function sseResponse(frames: string[]): Response {
  const body = frames.join('');
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(body));
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  });
}

describe('LMStudioClient.streamChat', () => {
  afterEach(() => vi.restoreAllMocks());

  it('parses SSE data frames and ignores [DONE]', async () => {
    const frames = [
      'data: {"choices":[{"delta":{"content":"Hel"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"lo"}}]}\n\n',
      'data: [DONE]\n\n',
    ];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(sseResponse(frames)));
    const lm = new LMStudioClient('http://fake:1234');
    const out: unknown[] = [];
    for await (const c of lm.streamChat({ messages: [{ role: 'user', content: 'hi' }] })) {
      out.push(c);
    }
    expect(out).toHaveLength(2);
  });

  it('tolerates frames split across reads', async () => {
    const stream = new ReadableStream({
      start(controller) {
        const enc = new TextEncoder();
        controller.enqueue(enc.encode('data: {"choices":[{"del'));
        controller.enqueue(enc.encode('ta":{"content":"x"}}]}\n\n'));
        controller.enqueue(enc.encode('data: [DONE]\n\n'));
        controller.close();
      },
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(stream, { status: 200, headers: { 'content-type': 'text/event-stream' } }),
      ),
    );
    const lm = new LMStudioClient('http://fake:1234');
    const out: unknown[] = [];
    for await (const c of lm.streamChat({ messages: [{ role: 'user', content: 'hi' }] })) {
      out.push(c);
    }
    expect(out).toHaveLength(1);
  });
});
