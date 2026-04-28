#!/usr/bin/env bash
# Post-install smoke tests. Run on Node A after `docker compose up -d` settles.
#
# Exits non-zero on any failure so it can be wired into Uptime Kuma /
# CI / a pre-commit hook.

set -uo pipefail

LITELLM_HOST="${LITELLM_HOST:-localhost:4000}"
LITELLM_KEY="${LITELLM_MASTER_KEY:?LITELLM_MASTER_KEY must be set}"
NODE_B="${NODE_B:-node-b.local}"

red()   { printf '\e[31m%s\e[0m\n' "$*"; }
green() { printf '\e[32m%s\e[0m\n' "$*"; }
yellow(){ printf '\e[33m%s\e[0m\n' "$*"; }

fail=0
pass=0

check() {
  local name="$1"; shift
  if "$@" >/dev/null 2>&1; then
    green "  ✓ ${name}"
    pass=$((pass+1))
  else
    red "  ✗ ${name}"
    fail=$((fail+1))
  fi
}

echo "=== Phase 1: Node A core services ==="
check "llama-server /v1/models" curl -fsS http://localhost:8080/v1/models
check "llama-server /metrics"   curl -fsS http://localhost:8080/metrics
check "llama-server chat"       curl -fsS -X POST http://localhost:8080/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"ping"}],"max_tokens":4}'

echo
echo "=== Phase 2: orchestration ==="
check "litellm /v1/models"      curl -fsS -H "Authorization: Bearer ${LITELLM_KEY}" "http://${LITELLM_HOST}/v1/models"
check "litellm chat: smart"     curl -fsS -X POST -H "Authorization: Bearer ${LITELLM_KEY}" \
  -H 'Content-Type: application/json' \
  -d '{"model":"default-smart","messages":[{"role":"user","content":"ping"}],"max_tokens":4}' \
  "http://${LITELLM_HOST}/v1/chat/completions"
check "qdrant /readyz"          curl -fsS http://localhost:6333/readyz
check "n8n healthz"             curl -fsS http://localhost:5678/healthz
check "letta health"            curl -fsS http://localhost:8283/v1/health
check "open-webui /health"      curl -fsS http://localhost:8080/health
check "uptime-kuma"             curl -fsS http://localhost:3001

echo
echo "=== Phase 3: Node B reachability (skip if not yet set up) ==="
if ping -c1 -W2 "${NODE_B}" >/dev/null 2>&1; then
  check "node-b: fast model"   curl -fsS "http://${NODE_B}:8080/v1/models"
  check "node-b: embeddings"   curl -fsS "http://${NODE_B}:8081/v1/models"
  check "litellm fallback to fast" curl -fsS -X POST -H "Authorization: Bearer ${LITELLM_KEY}" \
    -H 'Content-Type: application/json' \
    -d '{"model":"default-fast","messages":[{"role":"user","content":"ping"}],"max_tokens":4}' \
    "http://${LITELLM_HOST}/v1/chat/completions"
  check "iperf3 ≥ 2 Gbps"      bash -c "iperf3 -c ${NODE_B} -t 5 -J | python3 -c 'import sys,json; r=json.load(sys.stdin); s=r[\"end\"][\"sum_received\"][\"bits_per_second\"]/1e9; print(s); exit(0 if s>2 else 1)'"
else
  yellow "  - skipping (node-b unreachable)"
fi

echo
if [[ ${fail} -eq 0 ]]; then
  green "All ${pass} checks passed."
  exit 0
else
  red "${fail} check(s) failed (${pass} passed)."
  exit 1
fi
