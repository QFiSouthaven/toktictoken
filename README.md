# openclaw

Private, self-hosted chat over your own LM Studio. Runs entirely on your machine — nothing leaves the box.

- **UI**: Telegram-style, dark, streaming
- **Backend**: bound to `127.0.0.1` by default — not reachable from anything but your own machine
- **Storage**: one SQLite file on your disk
- **LLM**: whatever you load in [LM Studio](https://lmstudio.ai)
- **Privacy**: no CDN, no external fonts, no telemetry, strict CSP

## Quick start (local)

Requires **Node 20+** and **LM Studio** running with a model loaded and its local server started on port `1234`.

```bash
# 1. install deps
npm install

# 2. set a password + generate secrets (once)
export ADMIN_PASSWORD_HASH="$(node -e "console.log(require('bcryptjs').hashSync(process.argv[1], 12))" 'changeme')"
export JWT_SECRET="$(openssl rand -hex 48)"
export LM_STUDIO_URL="http://localhost:1234"

# 3. run
npm run dev
```

Open http://localhost:5173 and sign in with the password you picked (`changeme` above).

Your chats + settings are stored in `backend/data/openclaw.sqlite`. Back that up if you care about history.

### Persist those env vars

Drop them into a shell rc file, or create a tiny loader:

```bash
cat > ~/.openclaw.env <<EOF
export ADMIN_PASSWORD_HASH='$(node -e "console.log(require('bcryptjs').hashSync('changeme', 12))")'
export JWT_SECRET='$(openssl rand -hex 48)'
export LM_STUDIO_URL='http://localhost:1234'
EOF
chmod 600 ~/.openclaw.env
# then every session:
source ~/.openclaw.env && npm run dev
```

To change the password later, regenerate the hash and restart.

## What LM Studio capabilities are wired up

| Capability | Where in the UI |
|---|---|
| Streaming chat | Token-by-token rendering as the model generates |
| Model switching | Dropdown in the chat header |
| System prompt / persona | Settings → "System prompt" (default persona: `openclaw`) |
| Vision models | Attach an image in the composer — sent as `image_url` content part |
| Embeddings + RAG | Settings → set embedding model + enable RAG; ingests via upload |
| Tool / function calling | Backend forwards `tools`/`tool_choice`; `tool_calls` deltas stream through |
| Sampling params | Settings → temperature, top_p, max_tokens |

## Commands

```bash
npm run dev         # backend on :3000, vite on :5173
npm run build       # compile backend + bundle frontend
npm start           # run compiled backend serving the bundled frontend at :3000
npm test            # unit tests (SSE parser)
npm run typecheck   # tsc on both workspaces
```

## Layout

```
backend/   Fastify API + SQLite + LM Studio client
frontend/  React + Vite UI (Telegram-style dark theme)
deploy/    Docker/Caddy/VPS scripts — unused for local, kept for later
```

## Privacy details

- Backend binds to `127.0.0.1` — not `0.0.0.0` — so nothing on your LAN can reach it.
- Password stored as a bcrypt hash (cost 12). Session is a JWT in an httpOnly `SameSite=Strict` cookie.
- CSP locks `connect-src` to `self`; no third-party scripts, fonts, or images loaded.
- LM Studio is only reached by the backend. Browsers never speak to it directly.
- SQLite file is yours. Delete it to wipe everything.

## Later: want it on a VPS?

There's a Docker + Caddy deploy scaffold under `deploy/` with a `bootstrap.sh` for Ubuntu 24.04. It's not needed for local use and is left as-is until you're ready.

## License

MIT
