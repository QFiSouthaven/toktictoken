#!/usr/bin/env bash
# Idempotent GGUF model fetcher.
#
# Usage:
#   ./pull-models.sh node-a   # primary big models for Strix Halo
#   ./pull-models.sh node-b   # fast / embed / rerank / draft for RTX 4070
#   ./pull-models.sh both
#
# Requires: huggingface-cli (pip install huggingface_hub) and a HF token in
# $HF_TOKEN (or `huggingface-cli login`). Models are public but rate-limited.

set -euo pipefail

ROLE="${1:-both}"
MODELS_DIR="${MODELS_DIR:-/mnt/nvme/models}"

mkdir -p "${MODELS_DIR}"
cd "${MODELS_DIR}"

# huggingface-cli download <repo> <filename> --local-dir <dir> --local-dir-use-symlinks False
hf_pull() {
  local repo="$1"
  local file="$2"
  local target="${MODELS_DIR}/${file}"
  if [[ -f "${target}" ]]; then
    echo "✓ already present: ${file}"
    return 0
  fi
  echo "→ downloading ${repo} :: ${file}"
  huggingface-cli download "${repo}" "${file}" \
    --local-dir "${MODELS_DIR}" \
    --local-dir-use-symlinks False
}

pull_node_a() {
  echo "=== Node A (Strix Halo) primary models ==="
  # Daily-driver MoE — fastest big model on Strix Halo (~86 t/s tg per 2026 bench)
  hf_pull "Qwen/Qwen3-30B-A3B-Instruct-GGUF" "Qwen3-30B-A3B-Instruct-Q4_K_M.gguf"
  # Heavy-reasoning dense
  hf_pull "bartowski/Llama-3.3-70B-Instruct-GGUF" "Llama-3.3-70B-Instruct-Q4_K_M.gguf"
  # Coder MoE
  hf_pull "Qwen/Qwen3-Coder-Next-80B-A3B-GGUF" "Qwen3-Coder-Next-80B-A3B-Q4_K_M.gguf"
}

pull_node_b() {
  echo "=== Node B (RTX 4070) fast + embed + draft models ==="
  # Fast small model
  hf_pull "Qwen/Qwen3-8B-Instruct-GGUF" "Qwen3-8B-Instruct-Q4_K_M.gguf"
  # Embeddings
  hf_pull "CompendiumLabs/bge-m3-gguf" "bge-m3-Q8_0.gguf"
  # Reranker
  hf_pull "gpustack/bge-reranker-v2-m3-GGUF" "bge-reranker-v2-m3-Q8_0.gguf"
  # Draft model for spec decode of Llama 3.3 70B (Phase 5)
  hf_pull "bartowski/Llama-3.2-1B-Instruct-GGUF" "Llama-3.2-1B-Instruct-Q4_K_M.gguf"
}

case "${ROLE}" in
  node-a) pull_node_a ;;
  node-b) pull_node_b ;;
  both)   pull_node_a; pull_node_b ;;
  *) echo "usage: $0 {node-a|node-b|both}"; exit 2 ;;
esac

echo
echo "Done. Models in: ${MODELS_DIR}"
ls -lh "${MODELS_DIR}"
