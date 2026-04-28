# Dify — clone the official compose into this directory

Dify is a multi-container application (web, api, worker, db, redis, weaviate,
sandbox, ssrf_proxy, nginx). It ships its own `docker-compose.yml`, so we don't
inline it — clone it here so the rest of the Node A stack can sit alongside it.

## Install

```bash
cd /srv/ai/infra/node-a-bosgame
git clone https://github.com/langgenius/dify dify
cd dify/docker
cp .env.example .env

# Point Dify at the local LiteLLM router so model traffic stays on-box.
# Edit .env — at minimum set:
#   OPENAI_API_BASE=http://litellm:4000/v1
#   OPENAI_API_KEY=<the LITELLM_MASTER_KEY from ../../.env>
#
# Then bring it up on the same Docker network as the rest of the stack:
docker compose up -d
```

## Wire up the reverse proxy

Once Dify is running, uncomment the `dify` block in `../caddy/Caddyfile` and
restart Caddy:

```bash
cd /srv/ai/infra/node-a-bosgame
docker compose restart caddy
```

You should now reach Dify at `https://dify.bosgame.local`.

## Why not pin a Dify version?

Dify ships frequent breaking schema migrations. Following `main` is the project's
own recommendation; pin a specific tag once you have apps in production.
