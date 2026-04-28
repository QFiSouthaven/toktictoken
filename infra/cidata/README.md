# cidata — building the autoinstall USB stick

This directory contains the static `meta-data` file you need on the **CIDATA**
USB stick that pairs with the Ubuntu Server installer USB. Cloud-init / Subiquity
needs both files (`user-data` + `meta-data`) on the seed source to detect it as
a NoCloud datasource.

## Build the USB (on any Linux box)

```bash
# Identify your USB stick (CAREFUL — pick the right device!)
lsblk
USB=/dev/sdX           # ← replace X

# Format FAT32 with label CIDATA
sudo mkfs.vfat -F 32 -n CIDATA "${USB}"
sudo mkdir -p /mnt/cidata && sudo mount "${USB}" /mnt/cidata

# Drop the autoinstall + meta-data on it
#   For Node A:
sudo cp ../node-a-bosgame/autoinstall.yaml /mnt/cidata/user-data
#   For Node B:
# sudo cp ../node-b-desktop/autoinstall.yaml /mnt/cidata/user-data
sudo cp meta-data /mnt/cidata/meta-data

sudo umount /mnt/cidata
```

> **Before you copy `user-data`**: open the autoinstall.yaml and replace the
> three `<<<REPLACE_ME_*>>>` placeholders. See the file header for instructions.

## Boot

1. Plug both USB sticks (Ubuntu Server ISO + CIDATA) into the target machine.
2. Boot from the Ubuntu USB.
3. The installer will detect CIDATA and proceed unattended (except the storage
   confirmation step, which is intentionally interactive as a safety net).

## Why two files

Cloud-init's NoCloud datasource expects:
- `user-data` — the actual config (our `autoinstall.yaml`).
- `meta-data` — instance metadata (hostname, instance-id). Can be empty but
  the file MUST exist.

The `meta-data` file in this directory has a non-empty `instance-id` so cloud-init
treats reboots as the same instance and doesn't re-run `runcmd` / `bootcmd` blocks.
