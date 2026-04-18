import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { DB } from '../db/index.js';
import type { LMStudioClient, ChatMessage } from '../services/lmstudio.js';
import { requireAuth } from '../middleware/auth.js';

const sendBody = z.object({
  content: z.string().min(1),
  attachments: z
    .array(
      z.object({
        kind: z.enum(['image', 'file']),
        url: z.string(),
        mime: z.string().optional(),
      }),
    )
    .optional(),
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  top_p: z.number().min(0).max(1).optional(),
  max_tokens: z.number().int().positive().optional(),
  system_prompt: z.string().optional(),
});

export function registerMessageRoutes(app: FastifyInstance, db: DB, lm: LMStudioClient) {
  app.post('/api/chats/:id/messages', { preHandler: requireAuth }, async (req, reply) => {
    const chatId = Number((req.params as { id: string }).id);
    if (!Number.isFinite(chatId)) return reply.code(400).send({ error: 'invalid_id' });

    const parsed = sendBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_body' });

    const chat = db
      .prepare('SELECT id, model, system_prompt, title FROM chats WHERE id = ?')
      .get(chatId) as
      | { id: number; model: string | null; system_prompt: string | null; title: string }
      | undefined;
    if (!chat) return reply.code(404).send({ error: 'chat_not_found' });

    const now = Date.now();
    const attachmentsJson = parsed.data.attachments ? JSON.stringify(parsed.data.attachments) : null;
    db.prepare(
      'INSERT INTO messages (chat_id, role, content, attachments_json, created_at) VALUES (?, ?, ?, ?, ?)',
    ).run(chatId, 'user', parsed.data.content, attachmentsJson, now);

    const history = db
      .prepare(
        'SELECT role, content, attachments_json FROM messages WHERE chat_id = ? ORDER BY id ASC',
      )
      .all(chatId) as { role: string; content: string; attachments_json: string | null }[];

    const systemPrompt = parsed.data.system_prompt ?? chat.system_prompt ?? defaultSystemPrompt();
    const messages: ChatMessage[] = [{ role: 'system', content: systemPrompt }];

    for (const m of history) {
      const attachments = m.attachments_json ? (JSON.parse(m.attachments_json) as {
        kind: string;
        url: string;
      }[]) : [];
      const images = attachments.filter((a) => a.kind === 'image');
      if (images.length > 0 && m.role === 'user') {
        messages.push({
          role: 'user',
          content: [
            { type: 'text', text: m.content },
            ...images.map((i) => ({ type: 'image_url' as const, image_url: { url: i.url } })),
          ],
        });
      } else {
        messages.push({ role: m.role as ChatMessage['role'], content: m.content });
      }
    }

    const model = parsed.data.model ?? chat.model ?? undefined;

    reply.raw.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    });

    const abort = new AbortController();
    req.raw.on('close', () => abort.abort());

    let assistantText = '';
    try {
      const stream = lm.streamChat({
        model,
        messages,
        temperature: parsed.data.temperature,
        top_p: parsed.data.top_p,
        max_tokens: parsed.data.max_tokens,
        signal: abort.signal,
      });
      for await (const chunk of stream) {
        const c = chunk as {
          choices?: {
            delta?: { content?: string; tool_calls?: unknown };
            finish_reason?: string;
          }[];
        };
        const delta = c.choices?.[0]?.delta;
        if (delta?.content) {
          assistantText += delta.content;
          reply.raw.write(`event: delta\ndata: ${JSON.stringify({ content: delta.content })}\n\n`);
        }
        if (delta?.tool_calls) {
          reply.raw.write(
            `event: tool_calls\ndata: ${JSON.stringify(delta.tool_calls)}\n\n`,
          );
        }
      }
      reply.raw.write(`event: done\ndata: {}\n\n`);
    } catch (err) {
      reply.raw.write(
        `event: error\ndata: ${JSON.stringify({ message: (err as Error).message })}\n\n`,
      );
    } finally {
      const savedAt = Date.now();
      db.prepare(
        'INSERT INTO messages (chat_id, role, content, created_at) VALUES (?, ?, ?, ?)',
      ).run(chatId, 'assistant', assistantText, savedAt);
      if (chat.title === 'New chat') {
        const firstLine = parsed.data.content.split('\n')[0]?.slice(0, 80) ?? 'New chat';
        db.prepare('UPDATE chats SET title = ?, updated_at = ? WHERE id = ?').run(
          firstLine,
          savedAt,
          chatId,
        );
      } else {
        db.prepare('UPDATE chats SET updated_at = ? WHERE id = ?').run(savedAt, chatId);
      }
      reply.raw.end();
    }
  });
}

function defaultSystemPrompt(): string {
  return 'You are openclaw, a private self-hosted assistant. Be concise, accurate, and direct.';
}
