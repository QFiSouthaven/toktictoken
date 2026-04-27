# Ubuntu 24.04 Partition Setup — M5 LLM-Server Dual-Boot

Companion to `sunny-noodling-cosmos.md` Phase 1.3 (install). Use this when you're sitting in front of the live USB Ubuntu installer and need to configure partitions.

## Pre-flight check (in the live session, before launching the installer)

Open a Terminal and run:

```bash
sudo parted -l
lsblk -o NAME,SIZE,FSTYPE,LABEL,MOUNTPOINT,PARTLABEL
```

Confirm you see, on the NVMe (likely `/dev/nvme0n1`):

- p1: ~200 MB EFI System (fat32)
- p2: 16 MB Microsoft reserved
- p3: ~1300 GB ntfs (Windows C:)
- ~606 GB free / unallocated
- p4: ~780 MB ntfs (Recovery)

If anything is off — stop. Do not proceed.

## Installer flow

1. Launch **Install Ubuntu 24.04 LTS**.
2. Keyboard / network / updates: defaults are fine. Pick **Normal installation**.
3. On **Installation type**, choose **Manual installation** ("Something else" in older wording).
   - Do NOT pick "Install alongside Windows" — won't give us LUKS the way the plan wants.
   - Do NOT pick "Erase disk" — wipes Windows.

## Target layout

Out of the ~606 GB free space, build:

| Partition | Size | Type | Mount | Encrypted |
|---|---|---|---|---|
| `/boot` | 2 GB | ext4 | `/boot` | No (GRUB needs to read it) |
| LUKS container | ~604 GB | physical volume for encryption | — | Yes |
| └─ root inside LUKS | ~604 GB | ext4 | `/` | Yes (via container) |

Reuse the existing EFI partition (`nvme0n1p1`) — do **not** format it.

Skip swap partition; create a swapfile post-install (simpler, resizable).

## Step-by-step in the manual partitioner

### 1. Create `/boot`
- Click the free space row → `+`
- Size: **2048 MB**
- Type for new partition: **Primary**
- Location: **Beginning of this space**
- Use as: **Ext4 journaling file system**
- Mount point: **`/boot`**
- OK

### 2. Create the LUKS container
- Click the remaining free space row → `+`
- Size: **all remaining** (leave default)
- Type: **Primary**
- Location: **Beginning**
- Use as: **physical volume for encryption**
- Set a strong passphrase. Write it down. No recovery.
- OK

### 3. Format the unlocked volume as root
- The new unlocked volume appears (something like `/dev/mapper/...`).
- Edit it:
  - Use as: **Ext4 journaling file system**
  - Mount point: **`/`**
- OK

### 4. Tell installer to reuse the EFI partition
- Find `nvme0n1p1` (200 MB, fat32).
- Edit:
  - Use as: **EFI System Partition**
  - **Do NOT tick "Format the partition"**
- OK

### 5. Bootloader device
- Bottom of the manual partitioning screen: **"Device for bootloader installation"** dropdown.
- Set to the **whole disk**: `/dev/nvme0n1`
- NOT a partition like `/dev/nvme0n1p1`.

### 6. Confirm and write
- Click **Install Now**, review the summary carefully:
  - It should say it will create /boot, create the encrypted volume, and format root.
  - It should say nothing about touching `nvme0n1p3` (Windows) or `nvme0n1p4` (Recovery) or formatting `nvme0n1p1` (EFI).
- If anything mentions Windows partitions: cancel, take a photo, ask for help.
- Otherwise: continue.

### 7. User account
- Username, hostname, password, encryption-at-login: standard.
- Untick "Log in automatically".

### 8. Finish
- Wait for install to complete.
- When prompted: remove USB, then reboot.
- Should boot into GRUB menu with Ubuntu (default) and "Windows Boot Manager".
- LUKS will prompt for passphrase before GRUB hands off to the kernel.

## First-boot smoke test

Once Ubuntu boots and you log in:

```bash
# Confirm we're on UEFI
[ -d /sys/firmware/efi ] && echo "UEFI ok" || echo "BIOS mode — wrong"

# Confirm encryption
lsblk -f
# Should show: nvme0n1p? crypto_LUKS, with mapper/<name> ext4 mounted at /

# Confirm Windows still bootable from GRUB
sudo update-grub
# Should list Windows Boot Manager among entries

# Free space sanity
df -h /
```

Then jump back to the canonical plan at **§1.4 (first-boot sanity)** and continue.

## Common gotchas

- **"No root file system is defined"** — you forgot to set mount point `/` on the unlocked volume. Edit the mapper device and set it.
- **"EFI partition needs to be flagged"** — installer wants you to mark p1 as ESP. The "Use as: EFI System Partition" step covers this.
- **Installer wants to format the EFI partition** — uncheck the format box. Windows boot files live there.
- **Installer offers to encrypt /boot too** — say no. GRUB needs to read /boot before LUKS unlock.
- **After install, no GRUB menu, boots straight to Windows** — BIOS boot order is wrong. Reboot, F2/Del into BIOS, set "ubuntu" first in UEFI boot order.
- **After install, boots to GRUB but no Windows entry** — run `sudo os-prober && sudo update-grub` from Ubuntu.

## What NOT to do

- Don't disable Secure Boot mid-install. Per the canonical plan, it gets turned off in BIOS **before** install (Phase 1.2). If you forgot — finish the install (it'll work with Secure Boot on as long as you didn't disable shim), then reboot to BIOS and turn it off there.
- Don't shrink C: from inside the Ubuntu installer. The shrink already happened in Windows. Touch only the free space.
- Don't create a separate `/home` partition. Adds complexity for no win on a single-user dev box.
