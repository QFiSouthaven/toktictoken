# openclaw

Private, self-hosted chat over your own LM Studio — Telegram-style web UI. All inference stays on your machine; nothing is sent to third parties.

## Stack

- **Backend**: Fastify + TypeScript, `better-sqlite3`, `sqlite-vec` for RAG, JWT in httpOnly cookies
- **Frontend**: React 18 + Vite + TypeScript, TanStack Query, Zustand, `react-markdown` (with GFM + syntax highlight)
- **Deploy**: Docker Compose + Caddy (auto-HTTPS) on Ubuntu 24.04
- **LLM**: any model loaded in [LM Studio](https://lmstudio.ai) — chat, vision, embeddings, tool-calling

## Local development

Requires Node 20+, and LM Studio running locally with a model loaded (server on `:1234`).

```bash
# 1. install deps
npm install

# 2. generate a password hash + secret
export ADMIN_PASSWORD_HASH="$(node -e "console.log(require('bcrypt').hashSync('changeme', 12))")"
export JWT_SECRET="$(openssl rand -hex 48)"
export LM_STUDIO_URL=http://localhost:1234

# 3. run dev (backend :3000, vite :5173 with proxy)
npm run dev
```

Open http://localhost:5173 and log in with `changeme`.

### Tests & typecheck

```bash
npm test
npm run typecheck
```

## VPS deploy (Ubuntu 24.04)

1. Point a DNS `A` record at your VPS (e.g. `chat.example.com`).
2. SSH in, clone the repo:
   ```bash
   sudo mkdir -p /opt && cd /opt
   sudo git clone <your-fork-url> openclaw
   cd openclaw
   sudo bash deploy/bootstrap.sh
   ```
   The script installs Docker, configures `ufw`, prompts for domain/email/password, generates secrets, and boots the stack with Caddy auto-HTTPS.
3. Install LM Studio on the same VPS, load a model, start its local server on `:1234`. (LM Studio runs on the host so it can access the GPU.)
4. Visit `https://<your-domain>` and sign in.

### Useful commands

```bash
docker compose -f deploy/docker-compose.yml logs -f app
docker compose -f deploy/docker-compose.yml restart app
docker compose -f deploy/docker-compose.yml down
```

### Backup

Your entire chat history + attachments live in one Docker volume:

```bash
docker run --rm -v openclaw_openclaw_data:/data -v "$PWD":/out alpine \
  tar czf /out/openclaw-backup-$(date +%F).tar.gz -C /data .
```

## Privacy posture

- No CDN, no external fonts, no telemetry, strict CSP (`connect-src 'self'`).
- Password stored as bcrypt hash; session is an httpOnly SameSite=Strict cookie.
- All traffic forced to HTTPS via Caddy + HSTS.
- LM Studio is only reached through the backend — it's never exposed to browsers.
- SQLite DB file is the single source of truth; easy to back up and encrypt at rest.

## LM Studio capabilities exposed

| Capability | Where |
|---|---|
| Streaming chat completions | Send a message — response streams token-by-token (SSE) |
| Model switching | Model picker in chat header |
| System prompt / persona | Settings panel (default: "openclaw") |
| Vision models | Attach an image, it's sent as `image_url` content part |
| Embeddings & RAG | Settings: enable RAG, set embedding model; documents ingested via upload |
| Tool / function calling | Backend forwards `tools`/`tool_choice`; UI surface TBD per your tool schema |
| Parameters | temperature, top_p, max_tokens configurable per settings |

## Project layout

```
backend/   Fastify API + SQLite + LM Studio client
frontend/  React + Vite UI
deploy/    Dockerfile, docker-compose.yml, Caddyfile, bootstrap.sh
```

## License

MIT
