#!/usr/bin/env bash
# Daily restic snapshot of all stateful Docker volumes on Node A.
#
# Pair with infra/node-a-bosgame/systemd/restic-backup.timer (write yourself, or
# install as a root cron entry):
#   0 3 * * *  /srv/ai/scripts/restic-backup.sh >> /var/log/restic-backup.log 2>&1

set -euo pipefail

export RESTIC_REPOSITORY="${RESTIC_REPOSITORY:-/mnt/nvme/restic-repo}"
export RESTIC_PASSWORD_FILE="${RESTIC_PASSWORD_FILE:-/etc/restic.password}"

# Init repo on first run.
if [[ ! -d "${RESTIC_REPOSITORY}/keys" ]]; then
  restic init
fi

# Stop services that hold open files we want consistent snapshots of.
# Skip llama-server (read-only models) and caddy (no state).
TARGETS=(postgres qdrant n8n open-webui letta uptime-kuma)

cd /srv/ai/compose
docker compose stop "${TARGETS[@]}"

# Back up Docker volumes mounted under /var/lib/docker/volumes/ai-node-a_*
restic backup \
  --tag "node-a-daily" \
  --exclude-caches \
  /var/lib/docker/volumes/ai-node-a_postgres-data \
  /var/lib/docker/volumes/ai-node-a_qdrant-data \
  /var/lib/docker/volumes/ai-node-a_letta-data \
  /var/lib/docker/volumes/ai-node-a_n8n-data \
  /var/lib/docker/volumes/ai-node-a_open-webui-data \
  /var/lib/docker/volumes/ai-node-a_uptime-kuma-data

docker compose start "${TARGETS[@]}"

# Retain: 7 daily, 4 weekly, 6 monthly.
restic forget --prune \
  --keep-daily 7 \
  --keep-weekly 4 \
  --keep-monthly 6

restic check --read-data-subset=5%

echo "Backup complete: $(date -Iseconds)"
