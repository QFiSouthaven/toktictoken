import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import type { DB } from '../db/index.js';

const loginBody = z.object({ password: z.string().min(1) });

export function registerAuthRoutes(app: FastifyInstance, db: DB, cookieSecure: boolean) {
  app.post('/api/auth/login', {
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    handler: async (req, reply) => {
      const parsed = loginBody.safeParse(req.body);
      if (!parsed.success) return reply.code(400).send({ error: 'invalid_body' });

      const user = db.prepare('SELECT id, password_hash FROM users ORDER BY id LIMIT 1').get() as
        | { id: number; password_hash: string }
        | undefined;
      if (!user) return reply.code(500).send({ error: 'no_user' });

      const ok = await bcrypt.compare(parsed.data.password, user.password_hash);
      if (!ok) return reply.code(401).send({ error: 'invalid_credentials' });

      const token = await reply.jwtSign({ sub: user.id }, { expiresIn: '30d' });
      reply.setCookie('openclaw_session', token, {
        httpOnly: true,
        secure: cookieSecure,
        sameSite: 'strict',
        path: '/',
        maxAge: 60 * 60 * 24 * 30,
      });
      return { ok: true };
    },
  });

  app.post('/api/auth/logout', async (_req, reply) => {
    reply.clearCookie('openclaw_session', { path: '/' });
    return { ok: true };
  });

  app.get('/api/auth/me', async (req, reply) => {
    try {
      await req.jwtVerify({ onlyCookie: true });
      return { authenticated: true };
    } catch {
      return reply.code(401).send({ authenticated: false });
    }
  });
}
