
# Contributing to Local Swarm Assistant

Welcome to the Swarm. This project follows strict architectural guidelines to ensure the React UI remains performant while handling heavy real-time data streams.

## 1. Architectural Standards

### A. The "Brain-Body" Separation
- **Logic:** All complex logic (API calls, data parsing) belongs in `services/` or custom hooks (`hooks/`).
- **UI:** Components should be "dumb" renderers where possible.
- **Example:** `ChatInterface.tsx` should not fetch data directly; it should call `useSwarmCycle()`.

### B. State Management
- **Local State:** Use `useState` for UI transient state (modals, inputs).
- **Global State:** We currently avoid Redux/Zustand to keep the bundle small. Pass props or use Context for `Agent[]` and `Message[]` if prop drilling becomes deeper than 3 levels.

### C. Performance
- **Render Cycles:** This app runs a recursive loop (`runSwarmCycle`). Avoid `useEffect` without strict dependency arrays.
- **Memoization:** Use `React.memo` for list items (`MessageBubble`) and `useMemo` for heavy graph calculations (`SwarmTimeline`).

## 2. Code Style

- **TypeScript:** Strict mode is ON. No `any` types unless interacting with a legacy 3rd party library without types.
- **Styling:** Tailwind CSS only. No `.css` files except for global resets.
- **Icons:** Use `lucide-react` exclusively.

## 3. The "Swinging Door" Protocol
If you modify `geminiService.ts`:
1. **Determinism:** The `determineNextSpeaker` function MUST return a valid Agent ID or `null`.
2. **Locking:** Ensure the UI shows a "Thinking" state while the routing decision is being made.

## 4. Testing
- **Unit:** Run `npm test` (Vitest) for logic in `services/`.
- **Integration:** Run `node scripts/test-bridge.js` to verify the Proxy<->App loop.
