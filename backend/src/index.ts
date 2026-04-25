import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import jwt from '@fastify/jwt';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import fstatic from '@fastify/static';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { loadConfig } from './config.js';
import { openDb } from './db/index.js';
import { LMStudioClient } from './services/lmstudio.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerChatRoutes } from './routes/chats.js';
import { registerMessageRoutes } from './routes/messages.js';
import { registerModelRoutes } from './routes/models.js';
import { registerSettingsRoutes } from './routes/settings.js';
import { registerUploadRoutes } from './routes/upload.js';

async function main() {
  const cfg = loadConfig();
  const dataDir = resolve(cfg.DATA_DIR);
  const db = openDb(dataDir, cfg.ADMIN_PASSWORD_HASH);
  const lm = new LMStudioClient(cfg.LM_STUDIO_URL);

  const app = Fastify({
    logger: { level: cfg.NODE_ENV === 'production' ? 'info' : 'debug' },
    bodyLimit: cfg.UPLOAD_MAX_BYTES,
  });

  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        mediaSrc: ["'self'", 'blob:'],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        frameAncestors: ["'none'"],
        formAction: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    crossOriginResourcePolicy: { policy: 'same-origin' },
    referrerPolicy: { policy: 'no-referrer' },
  });

  app.addHook('onSend', async (req, reply) => {
    if (req.url.startsWith('/api/auth/')) {
      reply.header('Cache-Control', 'no-store');
      reply.header('Pragma', 'no-cache');
    }
    reply.header('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=()');
  });
  await app.register(rateLimit, { global: false });
  await app.register(cookie);
  await app.register(jwt, {
    secret: cfg.JWT_SECRET,
    cookie: { cookieName: 'openclaw_session', signed: false },
  });
  await app.register(multipart, {
    limits: { fileSize: cfg.UPLOAD_MAX_BYTES, files: 1 },
  });

  registerAuthRoutes(app, db, cfg.COOKIE_SECURE ?? cfg.NODE_ENV === 'production');
  registerChatRoutes(app, db);
  registerMessageRoutes(app, db, lm);
  registerModelRoutes(app, lm);
  registerSettingsRoutes(app, db);
  registerUploadRoutes(app, db, dataDir);

  app.get('/api/health', async () => ({ ok: true }));

  const uploadsPath = join(dataDir, 'uploads');
  await app.register(fstatic, {
    root: uploadsPath,
    prefix: '/uploads/',
    decorateReply: false,
  });

  const staticDir = resolve(process.cwd(), 'public');
  if (existsSync(staticDir)) {
    await app.register(fstatic, {
      root: staticDir,
      prefix: '/',
      wildcard: false,
    });
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith('/api/') || req.url.startsWith('/uploads/')) {
        return reply.code(404).send({ error: 'not_found' });
      }
      return reply.sendFile('index.html');
    });
  }

  await app.listen({ host: cfg.HOST, port: cfg.PORT });
  app.log.info(`openclaw listening on ${cfg.HOST}:${cfg.PORT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
