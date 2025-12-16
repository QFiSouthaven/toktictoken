
# Refactoring Plan: Decoupling Local Swarm Assistant

## 1. Architectural Goals
The current `App.tsx` acts as a monolithic controller. We will transition to a **Layered Architecture** to improve maintainability, testability, and scalability.

### Layers:
1.  **Presentation Layer (Components):** Dumb UI components (`ChatInterface`, `Sidebar`) that simply render props.
2.  **Logic Layer (Hooks):** Custom React hooks that manage specific domains of state (`useSwarmState`, `useOrchestrator`).
3.  **Service Layer (API):** Pure TypeScript functions that handle external communication (Bridge, DB, Gemini).

## 2. Directory Structure Changes

```text
src/
├── components/       # UI Components (Existing)
├── services/         # API & Logic
│   ├── geminiService.ts  # (Existing) AI Logic
│   ├── bridgeService.ts  # (New) CLI Bridge API wrappers
│   └── dbService.ts      # (New) MongoDB API wrappers
├── hooks/            # State Logic
│   ├── useLmStudio.ts    # (Existing)
│   ├── useSwarmState.ts  # (New) Manages Agents, Messages, DB Sync
│   ├── useOrchestrator.ts# (New) Manages the Swarm Cycle loop
│   └── useBridge.ts      # (New) Manages Polling effects
└── App.tsx           # (Refactored) Composition Root
```

## 3. Implementation Steps

### Step 1: Extract Service Layer (Complete)
- Move raw `fetch` calls for the Bridge (`localhost:1234/bridge`) to `bridgeService.ts`.
- Move raw `fetch` calls for the DB (`localhost:1234/db`) to `dbService.ts`.

### Step 2: Extract State Logic (Complete)
- Create `useSwarmState`:
    - Manages `messages[]` and `agents[]`.
    - Handles initialization (loading from DB).
    - Handles persistence (saving new messages to DB).
    - Handles appending messages to the Bridge.

### Step 3: Extract Orchestration Logic (Complete)
- Create `useOrchestrator`:
    - Contains the `runSwarmCycle` recursive logic.
    - Determines next speaker.
    - Handles the "thinking" delay.
    - Updates status text.

### Step 4: Component Cleanup (Complete)
- Rewrite `App.tsx` to consume these hooks.
- It should essentially look like:
  ```tsx
  const state = useSwarmState();
  const engine = useOrchestrator(state);
  return <Layout state={state} actions={engine} />;
  ```

## 4. Future Improvements
- **Context API:** If prop drilling becomes annoying between `App` and `Sidebar`, wrap the hooks in a `SwarmProvider`.
- **Testing:** Now that logic is in `hooks/` and `services/`, we can write unit tests without mocking the DOM.
