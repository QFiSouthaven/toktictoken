import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { DB } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';

const DEFAULTS: Record<string, string> = {
  persona: 'openclaw',
  system_prompt:
    'You are openclaw, a private self-hosted assistant. Be concise, accurate, and direct.',
  default_model: '',
  temperature: '0.7',
  top_p: '0.95',
  max_tokens: '2048',
  rag_enabled: 'false',
  embedding_model: '',
};

const putBody = z.record(z.string(), z.string());

export function registerSettingsRoutes(app: FastifyInstance, db: DB) {
  app.get('/api/settings', { preHandler: requireAuth }, async () => {
    const rows = db.prepare('SELECT key, value FROM settings').all() as {
      key: string;
      value: string;
    }[];
    const out: Record<string, string> = { ...DEFAULTS };
    for (const r of rows) out[r.key] = r.value;
    return out;
  });

  app.put('/api/settings', { preHandler: requireAuth }, async (req, reply) => {
    const parsed = putBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_body' });
    const stmt = db.prepare(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    );
    const tx = db.transaction((entries: [string, string][]) => {
      for (const [k, v] of entries) stmt.run(k, v);
    });
    tx(Object.entries(parsed.data));
    return { ok: true };
  });
}
