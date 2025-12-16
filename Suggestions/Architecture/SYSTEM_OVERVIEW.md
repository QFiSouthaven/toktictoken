
# System Architecture: Local Swarm Assistant

## 1. Context (The "Why")
The Local Swarm Assistant is a hybrid interface designed to bridge the gap between **Web-based AI Agents** (React UI) and **Local Machine Execution** (CLI/File System). It allows a user to plan complex software architectures using a "Swarm" of agents and then execute that plan using local tools (Claude Code, Terminal).

## 2. Container Diagram (The "What")

```mermaid
graph TD
    User[Developer]
    
    subgraph "Browser (Client)"
        UI[React Application]
        Storage[LocalStorage / IndexedDB]
    end
    
    subgraph "Host Machine (Localhost)"
        Proxy[Express Proxy Server (Port 1234)]
        DB[MongoDB (Message Store)]
        FS[File System (Context Files)]
        Term[Shell (PowerShell/Bash)]
    end
    
    subgraph "External AI Services"
        Gemini[Google Gemini API]
        LM[LM Studio (Local Inference)]
        Claude[Claude Code CLI]
    end

    User -->|Interacts| UI
    UI -->|HTTP/REST| Proxy
    Proxy -->|Read/Write| FS
    Proxy -->|Persist| DB
    Proxy -->|Spawn| Term
    Proxy -->|Forward| LM
    
    UI -->|API Call| Gemini
    Claude -->|Reads Plan| FS
```

## 3. Core Components

### A. The Bridge (`proxy.js`)
- **Role:** The API Gateway and Security Boundary.
- **Responsibilities:**
  - CORS handling for local-network requests.
  - Sanitizing terminal commands (Allowlist).
  - Syncing chat messages to `SWARM_CONTEXT.md`.
  - Proxying requests to LM Studio (avoiding mixed-content errors).

### B. The Swarm Engine (`geminiService.ts`)
- **Role:** The Orchestration Logic.
- **Mechanism:** "The Swinging Door".
- **Logic:**
  1. Analyzes conversation history.
  2. Selects the next speaker based on urgency and role.
  3. Locks the thread to a single agent.
  4. Generates response (Remote Gemini or Local LLM).

### C. The Timeline (`SwarmTimeline.tsx`)
- **Role:** Observability.
- **Logic:** Visualizes the internal state of the swarm (Impact, Flow, Consistency) to help the user trust the autonomous process.

## 4. Data Flow: The "Plan-to-Code" Pipeline

1. **Ideation:** User chats with the Swarm in the UI.
2. **Consensus:** The `QA Critic` agent finalizes a plan.
3. **Sync:** The UI sends the final plan to the Proxy -> `SWARM_CONTEXT.md`.
4. **Handoff:** User runs `claude` in their terminal.
5. **Execution:** Claude reads `SWARM_CONTEXT.md` and implements the code.
6. **Feedback:** User sends Claude's output back to the Swarm via the Bridge API.
