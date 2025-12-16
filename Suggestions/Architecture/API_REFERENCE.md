
# Local Swarm Bridge API Reference

**Base URL:** `http://localhost:1234`
**Version:** v1.0.0

## 1. Bridge Endpoints (CLI <-> App Communication)

The Bridge functions as an asynchronous message queue between the React App and external tools (Claude Code CLI, Scripts).

| Method | Endpoint | Description | Payload / Params | Response |
|--------|----------|-------------|------------------|----------|
| `POST` | `/bridge/cli/input` | **CLI -> App**: Send a message/task from the terminal to the Swarm. | `{ "content": "string" }` | `{ "success": true, "status": "queued" }` |
| `GET` | `/bridge/cli/output` | **CLI -> App**: Poll for the latest response *from* the Swarm. | N/A | `{ "message": { "content": "...", "agentId": "..." } }` |
| `GET` | `/bridge/app/input` | **App -> CLI**: Poll for pending messages *from* the CLI. | N/A | `{ "message": { "content": "..." } }` or `{ "message": null }` |
| `POST` | `/bridge/app/output` | **App -> CLI**: Send a Swarm response back to the CLI context. | `{ "message": MessageObj }` | `{ "success": true }` |

## 2. Database Endpoints (Persistence)

Manages the MongoDB message history.

| Method | Endpoint | Description | Payload | Response |
|--------|----------|-------------|---------|----------|
| `GET` | `/db/status` | Check if MongoDB is connected. | N/A | `{ "connected": boolean }` |
| `GET` | `/db/messages` | Retrieve full chat history. | N/A | `{ "messages": Message[] }` |
| `POST` | `/db/messages` | Save or Update a single message. | `{ "message": MessageObj }` | `{ "success": true }` |
| `DELETE` | `/db/messages` | **Destructive**: Clear all history. | N/A | `{ "success": true }` |

## 3. System Endpoints

Access local resources securely.

| Method | Endpoint | Description | Payload | Response |
|--------|----------|-------------|---------|----------|
| `POST` | `/terminal/exec` | Execute a shell command. **Restricted Allowlist**. | `{ "command": "npm install..." }` | Streamed text (stdout/stderr) |
| `GET` | `/files/read` | Read a file from the Allowlist. | `?path=SWARM_CONTEXT.md` | `{ "content": "..." }` |

## 4. LM Studio Proxy

All requests to `/v1/*` are proxied to `http://127.0.0.1:1235` to bypass browser CORS restrictions when accessing local inference servers.
