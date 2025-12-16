
# Scalability Strategy: From Local Swarm to Cloud Hive

## Phase 1: Containerization (Current Next Step)
**Goal:** Remove dependency on host node/mongo versions.
- **Docker Compose:** Create a `docker-compose.yml` that spins up:
  - `swarm-web` (Nginx serving React build)
  - `swarm-proxy` (Node.js API)
  - `mongo-db` (MongoDB container)
- **Volume Mapping:** Map the host's project directory to the container to allow the "Data Miner" agent to read local files.

## Phase 2: Remote Collaboration
**Goal:** Allow a team to share a single Swarm context.
- **Database Migration:** Move from `localhost:27017` to **MongoDB Atlas** (Cloud).
- **Socket.IO:** Replace the polling mechanism in `ChatInterface.tsx` with WebSockets for real-time multiplayer updates.
- **Auth:** Implement GitHub OAuth via Passport.js in `proxy.js` to track who is sending messages.

## Phase 3: Distributed Inference
**Goal:** Offload heavy thinking from the user's laptop.
- **Inference Router:** Instead of proxying to `localhost:1235` (LM Studio), point the proxy to a centralized GPU cluster (e.g., vLLM or Ollama hosted on AWS/GCP).
- **Queue System:** Implement Redis + BullMQ in the proxy to handle bursty swarm traffic without timing out HTTP requests.

## Phase 4: The "Hive" (Multi-Swarm)
**Goal:** Multiple specialized swarms working together.
- **Federated Context:** Break `SWARM_CONTEXT.md` into a vector database (Pinecone/Weaviate).
- **Swarm-to-Swarm Protocol:** Define a standard JSON schema for one Swarm (e.g., "Frontend Swarm") to send a formal request to another (e.g., "DevOps Swarm").
