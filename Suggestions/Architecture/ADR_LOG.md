
# Architecture Decision Log (ADR)

This document records the architectural decisions made for the Local Swarm Assistant.

| ID | Date | Title | Status | Context | Decision | Consequences |
|----|------|-------|--------|---------|----------|--------------|
| **ADR-001** | 2025-05-15 | **Hybrid Proxy Architecture** | Accepted | Browsers cannot access the local file system or spawn shell processes directly due to security sandboxing. | Implement an Express.js middleware (`proxy.js`) to bridge the React UI and the Host Machine. | **Pros:** Enables powerful local integrations (CLI, FS, MongoDB).<br>**Cons:** Requires users to run a separate Node process (`node proxy.js`). |
| **ADR-002** | 2025-05-16 | **The "Swinging Door" Pattern** | Accepted | Multi-agent chats often become chaotic with race conditions where agents talk over each other. | Implement a centralized orchestration step that "locks" the thread to exactly one speaker based on conversation context. | **Pros:** Ensures coherent, linear conversation flow and prevents token waste.<br>**Cons:** Increases latency per turn due to the routing API call. |
| **ADR-003** | 2025-05-18 | **Markdown-First Shared Memory** | Accepted | The "Claude Code" CLI tool needs to read the swarm's plan. Claude is optimized for reading code and Markdown. | Store the "Shared Brain" state in `SWARM_CONTEXT.md` rather than a hidden database format. | **Pros:** Human-readable; Claude can natively read/write it.<br>**Cons:** File I/O can be slower than in-memory DB (mitigated by MongoDB caching). |
| **ADR-004** | 2025-05-20 | **Local Storage Strategy** | Accepted | We need persistence for UI state (Terminal height, history) but want to avoid database overhead for preferences. | Use `localStorage` for UI preferences and `MongoDB` (via Proxy) for critical chat history. | **Pros:** Fast load times for UI state; Robust storage for data.<br>**Cons:** LocalStorage is limited to ~5MB (requires history truncation). |
