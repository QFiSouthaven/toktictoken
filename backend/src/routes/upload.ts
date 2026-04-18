import type { FastifyInstance } from 'fastify';
import { mkdirSync, createWriteStream } from 'node:fs';
import { join, extname } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { randomBytes } from 'node:crypto';
import type { DB } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';

export function registerUploadRoutes(app: FastifyInstance, _db: DB, dataDir: string) {
  const uploadDir = join(dataDir, 'uploads');
  mkdirSync(uploadDir, { recursive: true });

  app.post('/api/upload', { preHandler: requireAuth }, async (req, reply) => {
    const file = await req.file();
    if (!file) return reply.code(400).send({ error: 'no_file' });

    const ext = extname(file.filename) || '';
    const name = `${Date.now()}-${randomBytes(6).toString('hex')}${ext}`;
    const dest = join(uploadDir, name);
    await pipeline(file.file, createWriteStream(dest));

    if (file.file.truncated) {
      return reply.code(413).send({ error: 'file_too_large' });
    }

    const kind = file.mimetype.startsWith('image/') ? 'image' : 'file';
    const url = `/uploads/${name}`;
    return { url, kind, mime: file.mimetype, name: file.filename };
  });
}
