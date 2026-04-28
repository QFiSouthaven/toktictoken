# Local-Only AI Lab — Two-Node Install Guide

Reproducible build for the user's two-machine private AI stack:

- **Node A — Bosgame M5** mini PC (Ryzen AI Max+ 395 "Strix Halo", Radeon 8060S iGPU, **128 GB unified memory**, 2 TB NVMe). Hosts the big-model inference + the no-code orchestration layer.
- **Node B — Desktop** (RTX 4070 12 GB, i7-13700K, 64 GB DDR5). Hosts fast small-model inference + embeddings + reranker, and (Phase 5) the draft model for cross-node speculative decoding.

Designed for: a **no-code AI prompt developer** who wants **100% local privacy** and **persistent automation** running 24/7.

> Plan source of truth: `/root/.claude/plans/no-no-no-go-keen-wolf.md`

---

## TL;DR — what gets installed

| Layer | Tool | Why |
|---|---|---|
| Inference (Node A) | **llama.cpp + Vulkan/AMDVLK** | +16% tok/s vs ROCm 7.x on Strix Halo (March 2026 benchmarks) |
| Inference (Node B) | **llama.cpp + CUDA** | Fastest path for ≤8B models, embeddings |
| Routing | **LiteLLM Proxy** | Single OpenAI-compatible endpoint with fallbacks across nodes |
| Daily chat | **Open WebUI** | ChatGPT-style UI, prompt library, RAG, voice |
| No-code automation | **n8n** | 24/7 cron, webhooks, AI nodes |
| No-code prompt apps | **Dify** | Polished prompt-engineer IDE with debugging |
| Stateful agents | **Letta** | Persistent agent memory across sessions |
| Vector DB | **Qdrant** | RAG storage |
| Reverse proxy | **Caddy** | Auto-HTTPS, friendly hostnames |
| Observability | **Uptime Kuma** | Service monitoring + alerts |
| Auto-update | **Watchtower** | Weekly container updates |
| Backups | **restic** | Daily snapshots of all stateful volumes |
| Mesh network | **Tailscale** | Private remote access, no public exposure |

---

## Phase 0 — pre-wipe checklist (do this BEFORE wiping Windows)

1. Back up anything you want to keep from the current Bosgame M5 install.
2. Note the BIOS hotkey for the M5 (usually **Del** or **F2** at boot).
3. Update BIOS to the latest Bosgame firmware if not already current.
4. **Critical BIOS setting:** in the BIOS, find the iGPU memory allocation (sometimes called **UMA Frame Buffer Size** or **GPU Memory**). Set it to a **fixed 96 GB** (out of 128 GB). This guarantees enough unified memory for 70B/80B models with KV cache.
5. Download Ubuntu 24.04.2 LTS Desktop ISO and write to USB (use Rufus or `dd`).

---

## Phase 1 — Node A baseline (Strix Halo → working chat)

### 1.1 Install Ubuntu — pick ONE of two paths

**Path A (recommended): unattended autoinstall.** All of §1.2–§1.4 below happens automatically. Use `infra/node-a-bosgame/autoinstall.yaml`:

1. Edit the file and replace the three `<<<REPLACE_ME_*>>>` placeholders:
   - `<<<REPLACE_ME_PASSWORD_HASH>>>` — generate with `mkpasswd -m sha-512` (apt install whois first).
   - `<<<REPLACE_ME_DISK_PASSWORD>>>` — strong LUKS passphrase (≥ 20 chars).
   - `<<<REPLACE_ME_PUBKEY>>>` — your SSH public key (cat ~/.ssh/id_ed25519.pub).
2. Write Ubuntu Server 24.04.2 LTS ISO to one USB stick (Rufus / `dd`).
3. Build the CIDATA seed USB — see `infra/cidata/README.md` for the exact `mkfs.vfat` / copy commands.
4. Boot the M5 from the Ubuntu USB (with CIDATA inserted). Confirm partitioning when it prompts. Walk away — comes back as a fully provisioned host with Docker, AMDVLK, Tailscale, and the repo cloned to `/srv/ai`. Skip to §1.5.

**Path B (interactive): step-by-step manual install.** Use this if you want to learn each layer.

- Boot the USB, install Ubuntu Server 24.04.2 LTS (Desktop also works).
- Pick **full disk encryption** (LUKS) — it's a privacy lab.
- Username: `ai` (matches the systemd unit). Password: strong.
- After first boot, run §1.2 → §1.4 by hand:

```bash
sudo apt update && sudo apt full-upgrade -y
sudo apt install -y linux-generic-hwe-24.04 git curl wget htop iperf3 \
                    libvulkan1 mesa-vulkan-drivers vulkan-tools radeontop \
                    python3-pip restic ufw whois
# huggingface-cli is not an apt package on noble — install via pip:
pip3 install --break-system-packages 'huggingface_hub[cli]'
sudo reboot
```

### 1.2 Install AMDVLK (Vulkan ICD) — Path B only

AMDVLK currently produces the highest token-generation throughput on Strix Halo
(beats ROCm 7.x by ~16% per March 2026 benchmarks).

```bash
# Grab the latest AMDVLK release from GitHub
LATEST=$(curl -s https://api.github.com/repos/GPUOpen-Drivers/AMDVLK/releases/latest \
         | grep browser_download_url | grep _amd64.deb | cut -d '"' -f 4)
wget "${LATEST}" -O /tmp/amdvlk.deb
sudo apt install -y /tmp/amdvlk.deb

# Confirm AMDVLK is the active ICD
vulkaninfo --summary | grep -i amdvlk
```

### 1.3 Install Docker — Path B only

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
sudo usermod -aG video,render $USER
newgrp docker   # or log out / back in
```

### 1.4 Install Tailscale — Path B only

```bash
curl -fsSL https://tailscale.com/install.sh | sudo sh
sudo tailscale up --ssh
# Enable HTTPS in the Tailscale admin console for cert auto-issuance.
```

> **Path A users**: just run `sudo tailscale up --ssh` once after first boot.

### 1.5 Clone this repo and bring up the Node A stack

```bash
sudo mkdir -p /srv && sudo chown $USER:$USER /srv
git clone https://github.com/qfisouthaven/toktictoken /srv/ai
cd /srv/ai/infra/node-a-bosgame

cp .env.example .env
# Generate and paste real secrets:
echo "POSTGRES_PASSWORD=$(openssl rand -hex 32)"
echo "LITELLM_MASTER_KEY=sk-litellm-$(openssl rand -hex 32)"
echo "LITELLM_SALT_KEY=$(openssl rand -hex 32)"
echo "N8N_ENCRYPTION_KEY=$(openssl rand -hex 32)"
$EDITOR .env

# Pull the primary model (~17 GB).
sudo mkdir -p /mnt/nvme/models && sudo chown $USER:$USER /mnt/nvme/models
../scripts/pull-models.sh node-a

# Bring it up.
docker compose up -d llama-server open-webui
```

### 1.6 Smoke test

```bash
curl -fsS http://localhost:8080/v1/models | jq .
# Expect: {"data":[{"id":"primary",...}]}
```

Open http://localhost:8080 in a browser (or `chat.bosgame.local` later). You
should be chatting with Qwen3 30B-A3B on the iGPU. Watch `radeontop` to confirm
the iGPU is active.

---

## Phase 2 — orchestration (everything else on Node A)

```bash
cd /srv/ai/infra/node-a-bosgame
docker compose up -d
docker compose ps
```

This starts: `litellm`, `postgres`, `qdrant`, `letta`, `n8n`, `open-webui`,
`caddy`, `watchtower`, `uptime-kuma`.

Run smoke tests:

```bash
export LITELLM_MASTER_KEY=$(grep ^LITELLM_MASTER_KEY .env | cut -d= -f2)
../scripts/healthcheck.sh
```

### 2.1 Add Caddy hostnames to your machine's hosts file

Edit `/etc/hosts` (or your home router's DNS) to point these names at Node A:

```
192.168.1.50  chat.bosgame.local n8n.bosgame.local api.bosgame.local letta.bosgame.local status.bosgame.local dify.bosgame.local
```

Replace `192.168.1.50` with Node A's LAN IP.

### 2.2 Set up Dify (optional but recommended for prompt-app building)

Dify is a multi-container app and ships with its own Compose. Don't try to inline
it — clone their official compose alongside ours:

```bash
cd /srv/ai/infra/node-a-bosgame
git clone https://github.com/langgenius/dify dify
cd dify/docker
cp .env.example .env
# Edit .env — set OPENAI_API_BASE to http://litellm:4000/v1 so Dify uses local models.
docker compose up -d
```

Then uncomment the Dify block in `caddy/Caddyfile` and `docker compose restart caddy`.

### 2.3 First wins to try

- **Open WebUI** (`https://chat.bosgame.local`): create your account, pick `default-smart`, ask it something.
- **n8n** (`https://n8n.bosgame.local`): create a "Schedule → AI Agent → Email" workflow. The AI Agent node should auto-detect the OpenAI-compatible endpoint pointing at LiteLLM.
- **Dify** (`https://dify.bosgame.local`): build a "Chatbot with knowledge" app, upload a PDF, deploy it as an internal app.
- **Letta**: create a persistent agent via the Letta SDK or its built-in UI.

---

## Phase 3 — Node B integration (RTX 4070 desktop)

### 3.1 Install Ubuntu + NVIDIA + Docker — pick ONE path

**Path A (recommended): unattended autoinstall.** Use `infra/node-b-desktop/autoinstall.yaml`. Same procedure as Node A's Path A — replace the three `<<<REPLACE_ME_*>>>` placeholders, write Ubuntu Server ISO to one USB, write `autoinstall.yaml` as `user-data` on a CIDATA USB, boot. The autoinstall handles `nvidia-driver-550`, `nvidia-container-toolkit`, Docker, and Tailscale. Skip to §3.2.

**Path B (interactive):**

```bash
# Ubuntu Server 24.04.2 LTS install.
sudo apt update && sudo apt full-upgrade -y
sudo apt install -y nvidia-driver-550 git curl iperf3
sudo reboot
nvidia-smi   # confirm driver

# nvidia-container-toolkit
curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | \
  sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg
curl -s -L https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list | \
  sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | \
  sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list
sudo apt update && sudo apt install -y nvidia-container-toolkit

curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
sudo nvidia-ctk runtime configure --runtime=docker
sudo systemctl restart docker
docker run --rm --gpus all nvidia/cuda:12.4.1-base-ubuntu24.04 nvidia-smi
```

### 3.2 Bring up Node B services

```bash
git clone https://github.com/qfisouthaven/toktictoken /srv/ai
cd /srv/ai/infra/node-b-desktop
cp .env.example .env

sudo mkdir -p /mnt/models && sudo chown $USER:$USER /mnt/models
../scripts/pull-models.sh node-b

docker compose up -d llama-server-fast llama-server-embed
# Optional, slightly more VRAM:
docker compose --profile full up -d llama-server-rerank
```

### 3.3 Wire Node B into Node A's LiteLLM

Edit `/etc/hosts` on Node A:
```
192.168.1.51  node-b.local
```

Then reload LiteLLM: `docker compose restart litellm` on Node A.
Re-run `../scripts/healthcheck.sh` — Phase 3 checks should now pass.

### 3.4 Direct 2.5 GbE link (optional but recommended)

Z790-Plus has no native USB4. The clean upgrade:

1. Buy a **Realtek RTL8125 2.5 GbE PCIe card** (~$25) for the desktop. The M5 already has 2.5 GbE.
2. Run a Cat6 cable directly between the two boxes (no switch).
3. Configure a private `/30` subnet on each side (e.g., `10.0.0.1/30` and `10.0.0.2/30`).
4. Verify: `iperf3 -c 10.0.0.2` → ~2.35 Gbps.
5. Update LiteLLM's `node-b.local` mapping to use the direct-link IP.

---

## Phase 4 — observability + persistence hardening

### 4.1 Uptime Kuma

Open `https://status.bosgame.local`, create an account, add HTTP monitors for:
- `https://chat.bosgame.local`
- `https://n8n.bosgame.local`
- `https://api.bosgame.local/health/liveliness`
- `http://node-b.local:8080/health` (when Node B is up)

Add an ntfy / email / Slack notifier so you get alerted on outages.

### 4.2 Daily backups

```bash
sudo install -m 600 /dev/stdin /etc/restic.password <<< "$(openssl rand -hex 32)"
# Test once
sudo /srv/ai/infra/scripts/restic-backup.sh
# Then schedule via cron
echo "0 3 * * * root /srv/ai/infra/scripts/restic-backup.sh >> /var/log/restic-backup.log 2>&1" | \
  sudo tee /etc/cron.d/restic-backup
```

### 4.3 Firewall (UFW)

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow from 100.64.0.0/10 to any port 443  # Tailscale
sudo ufw allow from 192.168.0.0/16 to any port 443 # LAN
sudo ufw allow ssh
sudo ufw enable
```

---

## Phase 5 — advanced (opt-in)

### 5.1 RPC clustering for huge models (>128 GB)

On Node B:
```bash
cd /srv/ai/infra/node-b-desktop
docker compose --profile cluster up -d rpc-server
```

On Node A, stop the regular `llama-server` and launch with RPC + a giant model:
```bash
docker compose stop llama-server
# (one-shot example; codify in compose later)
docker run --rm -it --device /dev/dri --group-add video --group-add render \
  -p 8080:8080 -v /mnt/nvme/models:/models:ro \
  ghcr.io/ggml-org/llama.cpp:server-vulkan \
  -m /models/DeepSeek-V3-Q4_K_M.gguf \
  --rpc node-b.local:50052 \
  -ngl 999 --host 0.0.0.0 --port 8080 \
  --cache-type-k q8_0 --cache-type-v q8_0 \
  --jinja --metrics
```

> Use `-dio` if you see hangs loading >100 GiB models over RPC (introduced Feb 2026).

### 5.2 Cross-node speculative decoding (dense models only)

Node B exposes a draft model (e.g., Llama 3.2 1B). Node A loads Llama 3.3 70B
as the target with `--model-draft` pointing at the RPC worker. Expect ≥1.5×
tok/s on dense models. **Skip for MoE** — currently net-negative on A3B-style MoEs.

### 5.3 ThunderboltEX 4 add-in card (only if you actually need it)

If 2.5 GbE becomes the bottleneck for RPC clustering (visible as low GPU
utilization on Node A during RPC inference), drop in an **ASUS ThunderboltEX 4**
add-in card on the Z790-Plus's TB header. ~10 Gbps real-world IP-over-Thunderbolt
to the M5's USB4 port.

---

## Daily operations

| Task | Command |
|---|---|
| Update everything | `cd /srv/ai && git pull && cd infra/node-a-bosgame && docker compose pull && docker compose up -d` |
| View logs | `docker compose logs -f --tail=100 <service>` |
| Run health checks | `/srv/ai/infra/scripts/healthcheck.sh` |
| Pull a new model | edit `pull-models.sh` → run it → update `.env` `PRIMARY_MODEL_GGUF` → `docker compose up -d llama-server` |
| Backup now | `sudo /srv/ai/infra/scripts/restic-backup.sh` |
| Restore from backup | `restic restore latest --target /tmp/restore --tag node-a-daily` |

---

## Why these specific choices (April 2026)

- **Vulkan AMDVLK over ROCm 7.x for inference**: per [Phoronix](https://www.phoronix.com/review/amd-rocm-7-strix-halo) and [Strix Halo Toolboxes](https://kyuz0.github.io/amd-strix-halo-toolboxes/) benchmarks, AMDVLK leads token generation by ~16% on Strix Halo, while ROCm wins prompt processing by ~30%. We use Vulkan as the primary because conversational latency is what most no-code workflows care about; ROCm can be added in a sidecar container for batch RAG ingestion.
- **Specialized nodes + LiteLLM router** rather than true cluster as default: cluster mode runs at slowest-node speed and adds failure surface a no-code user shouldn't fight with. We provide cluster mode as Phase 5 opt-in.
- **n8n + Dify + Open WebUI rather than picking one**: per [2026 review consensus](https://blog.n8n.io/we-need-re-learn-what-ai-agent-development-tools-are-in-2026/), each excels at a different job. n8n = Ops, Dify = polished prompt apps, Open WebUI = daily chat. Together they cover the prompt-engineer's full surface area.
- **Letta for persistent memory**: model-agnostic, free, self-hostable, best-in-class for stateful agents per [Letta's project page](https://github.com/letta-ai/letta).
- **2.5 GbE direct link instead of USB4 hacks**: Z790-Plus has no native USB4. IP-over-USB at 20 Gbps has flaky Linux driver support; 2.5 GbE is rock-solid and sufficient for routing-mode traffic.

---

## Repo layout

```
infra/
├── README.md                          ← you are here
├── cidata/                            # CIDATA seed USB helpers (autoinstall path)
│   ├── README.md
│   └── meta-data
├── node-a-bosgame/
│   ├── autoinstall.yaml               # unattended Ubuntu Server installer (Path A)
│   ├── docker-compose.yml             # primary stack
│   ├── .env.example                   # secrets template
│   ├── litellm/config.yaml            # routing rules
│   ├── caddy/Caddyfile                # reverse-proxy + auto-TLS
│   ├── dify/README.md                 # how to clone Dify's compose alongside
│   ├── llama-server/run.sh            # bare-metal alt launch script
│   └── systemd/llama-server.service   # bare-metal systemd unit
├── node-b-desktop/
│   ├── autoinstall.yaml               # unattended Ubuntu Server installer (Path A)
│   ├── docker-compose.yml             # CUDA: fast / embed / rerank / RPC
│   └── .env.example
└── scripts/
    ├── pull-models.sh                 # idempotent GGUF fetcher
    ├── restic-backup.sh               # daily snapshots
    └── healthcheck.sh                 # post-install smoke tests
```
