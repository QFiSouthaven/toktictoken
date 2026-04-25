#!/usr/bin/env bash
# Openclaw — Ubuntu 24.04 VPS bootstrap.
# Idempotent: safe to re-run.
#
# Usage (as root or with sudo):
#   cd /opt && git clone <repo> openclaw && cd openclaw
#   sudo bash deploy/bootstrap.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEPLOY_DIR="$REPO_ROOT/deploy"
ENV_FILE="$DEPLOY_DIR/.env"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Please run as root (sudo bash deploy/bootstrap.sh)." >&2
  exit 1
fi

echo "==> Checking Ubuntu release"
if ! grep -q 'VERSION_ID="24.04"' /etc/os-release; then
  echo "WARNING: this script targets Ubuntu 24.04. Continuing anyway." >&2
fi

echo "==> Installing system packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y ca-certificates curl gnupg ufw openssl nodejs

if ! command -v docker >/dev/null 2>&1; then
  echo "==> Installing Docker Engine"
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi

echo "==> Configuring firewall (ufw)"
ufw allow 22/tcp || true
ufw allow 80/tcp || true
ufw allow 443/tcp || true
yes | ufw enable || true

if [[ ! -f "$ENV_FILE" ]]; then
  echo "==> Generating $ENV_FILE"
  read -r -p "Domain (e.g. chat.example.com): " DOMAIN
  read -r -p "Let's Encrypt email: " LE_EMAIL
  read -r -s -p "Admin password: " PW1; echo
  read -r -s -p "Confirm password: " PW2; echo
  if [[ "$PW1" != "$PW2" ]]; then
    echo "Passwords do not match." >&2
    exit 1
  fi

  JWT_SECRET="$(openssl rand -hex 48)"

  # Hash the password with bcrypt via node (installs bcrypt temporarily if missing).
  TMP_HASH_DIR="$(mktemp -d)"
  pushd "$TMP_HASH_DIR" >/dev/null
  npm init -y >/dev/null
  npm install bcryptjs --silent >/dev/null
  ADMIN_HASH="$(PW="$PW1" node -e "console.log(require('bcryptjs').hashSync(process.env.PW, 12))")"
  popd >/dev/null
  rm -rf "$TMP_HASH_DIR"

  LM_URL="${LM_STUDIO_URL:-http://host.docker.internal:1234}"

  cat > "$ENV_FILE" <<EOF
DOMAIN=$DOMAIN
LETSENCRYPT_EMAIL=$LE_EMAIL
JWT_SECRET=$JWT_SECRET
ADMIN_PASSWORD_HASH=$ADMIN_HASH
LM_STUDIO_URL=$LM_URL
EOF
  chmod 600 "$ENV_FILE"
  echo "==> Wrote $ENV_FILE"
else
  echo "==> $ENV_FILE already exists — leaving untouched"
fi

echo "==> Building and starting containers"
docker compose --env-file "$ENV_FILE" -f "$DEPLOY_DIR/docker-compose.yml" up -d --build

cat <<MSG

==> Done.
    Openclaw is starting at https://$(grep ^DOMAIN= "$ENV_FILE" | cut -d= -f2)
    It may take ~30s for Caddy to obtain a TLS certificate on first boot.

    Next:
    1. Install LM Studio on this VPS (https://lmstudio.ai) and start its local
       server on port 1234 with a model loaded.
    2. Visit the domain and sign in with the password you just set.
    3. To view logs:    docker compose -f $DEPLOY_DIR/docker-compose.yml logs -f
    4. To stop:         docker compose -f $DEPLOY_DIR/docker-compose.yml down
    5. To update:       git pull && sudo bash deploy/bootstrap.sh
MSG
