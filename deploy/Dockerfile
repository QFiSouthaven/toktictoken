FROM node:20-bookworm-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm install --workspaces --include-workspace-root

COPY backend ./backend
COPY frontend ./frontend

RUN npm run build -w backend
RUN npm run build -w frontend

FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
ENV DATA_DIR=/data

RUN apt-get update && apt-get install -y --no-install-recommends tini ca-certificates && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/backend/package.json ./backend/package.json
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/backend/src/db/schema.sql ./backend/dist/db/schema.sql
COPY --from=builder /app/frontend/dist ./backend/public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/backend/node_modules ./backend/node_modules

VOLUME ["/data"]
EXPOSE 3000
WORKDIR /app/backend
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "dist/index.js"]
