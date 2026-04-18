import type { FastifyInstance } from 'fastify';
import type { LMStudioClient } from '../services/lmstudio.js';
import { requireAuth } from '../middleware/auth.js';

export function registerModelRoutes(app: FastifyInstance, lm: LMStudioClient) {
  app.get('/api/models', { preHandler: requireAuth }, async (_req, reply) => {
    try {
      const models = await lm.listModels();
      return { models };
    } catch (err) {
      return reply.code(502).send({ error: 'lm_studio_unreachable', detail: (err as Error).message });
    }
  });
}
