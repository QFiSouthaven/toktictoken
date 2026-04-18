import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { DB } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';

const createBody = z.object({
  title: z.string().min(1).max(200).optional(),
  model: z.string().optional(),
  system_prompt: z.string().optional(),
});

const patchBody = z.object({
  title: z.string().min(1).max(200).optional(),
  model: z.string().nullable().optional(),
  system_prompt: z.string().nullable().optional(),
});

export function registerChatRoutes(app: FastifyInstance, db: DB) {
  app.get('/api/chats', { preHandler: requireAuth }, async () => {
    const rows = db
      .prepare('SELECT id, title, model, updated_at, created_at FROM chats ORDER BY updated_at DESC')
      .all();
    return { chats: rows };
  });

  app.post('/api/chats', { preHandler: requireAuth }, async (req, reply) => {
    const parsed = createBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_body' });
    const now = Date.now();
    const title = parsed.data.title ?? 'New chat';
    const info = db
      .prepare(
        'INSERT INTO chats (title, model, system_prompt, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      )
      .run(title, parsed.data.model ?? null, parsed.data.system_prompt ?? null, now, now);
    const id = Number(info.lastInsertRowid);
    return { id, title, model: parsed.data.model ?? null, created_at: now, updated_at: now };
  });

  app.patch('/api/chats/:id', { preHandler: requireAuth }, async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    if (!Number.isFinite(id)) return reply.code(400).send({ error: 'invalid_id' });
    const parsed = patchBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_body' });
    const fields = parsed.data;
    const sets: string[] = [];
    const vals: (string | number | null)[] = [];
    if (fields.title !== undefined) {
      sets.push('title = ?');
      vals.push(fields.title);
    }
    if (fields.model !== undefined) {
      sets.push('model = ?');
      vals.push(fields.model);
    }
    if (fields.system_prompt !== undefined) {
      sets.push('system_prompt = ?');
      vals.push(fields.system_prompt);
    }
    if (sets.length === 0) return { ok: true };
    sets.push('updated_at = ?');
    vals.push(Date.now());
    vals.push(id);
    db.prepare(`UPDATE chats SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
    return { ok: true };
  });

  app.delete('/api/chats/:id', { preHandler: requireAuth }, async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    if (!Number.isFinite(id)) return reply.code(400).send({ error: 'invalid_id' });
    db.prepare('DELETE FROM chats WHERE id = ?').run(id);
    return { ok: true };
  });

  app.get('/api/chats/:id/messages', { preHandler: requireAuth }, async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    if (!Number.isFinite(id)) return reply.code(400).send({ error: 'invalid_id' });
    const chat = db.prepare('SELECT id, title, model, system_prompt FROM chats WHERE id = ?').get(id);
    if (!chat) return reply.code(404).send({ error: 'not_found' });
    const messages = db
      .prepare(
        'SELECT id, role, content, attachments_json, created_at FROM messages WHERE chat_id = ? ORDER BY id ASC',
      )
      .all(id);
    return { chat, messages };
  });
}
