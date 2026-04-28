#!/usr/bin/env bash
# Bare-metal alternative to the Docker llama-server service in docker-compose.yml.
#
# Use this when you want to skip the container layer for maximum performance
# (saves ~3-5% tok/s on Strix Halo) or want easier `--rpc` clustering setup.
#
# Prereqs (Ubuntu 24.04):
#   sudo apt install -y libvulkan1 mesa-vulkan-drivers vulkan-tools
#   # AMDVLK driver (token-gen champion on Strix Halo per April 2026 benchmarks):
#   wget https://github.com/GPUOpen-Drivers/AMDVLK/releases/latest/...
#   # Build llama.cpp with Vulkan:
#   git clone https://github.com/ggml-org/llama.cpp /opt/llama.cpp
#   cmake -B /opt/llama.cpp/build -DGGML_VULKAN=ON /opt/llama.cpp
#   cmake --build /opt/llama.cpp/build --config Release -j

set -euo pipefail

LLAMA_BIN="${LLAMA_BIN:-/opt/llama.cpp/build/bin/llama-server}"
MODELS_DIR="${MODELS_DIR:-/mnt/nvme/models}"
PRIMARY_MODEL_GGUF="${PRIMARY_MODEL_GGUF:-Qwen3-30B-A3B-Q4_K_M.gguf}"
PORT="${PORT:-8080}"
NGL="${NGL:-999}"
CTX="${CTX:-32768}"
PARALLEL="${PARALLEL:-2}"
THREADS="${THREADS:-12}"

# Force AMDVLK ICD if installed alongside RADV. AMDVLK has been measured ~16%
# faster than ROCm 7.x for token generation on Strix Halo (March 2026).
export AMD_VULKAN_ICD="${AMD_VULKAN_ICD:-AMDVLK}"

exec "${LLAMA_BIN}" \
  -m "${MODELS_DIR}/${PRIMARY_MODEL_GGUF}" \
  --host 0.0.0.0 --port "${PORT}" \
  --jinja \
  --metrics \
  --n-gpu-layers "${NGL}" \
  --ctx-size "${CTX}" \
  --cache-type-k q8_0 \
  --cache-type-v q8_0 \
  --parallel "${PARALLEL}" \
  --cont-batching \
  --threads "${THREADS}" \
  --alias primary \
  "$@"
