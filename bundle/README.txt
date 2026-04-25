openclaw — private, self-hosted LM Studio chat
================================================

Quick start:
  1. Install Node.js 22.13+ or 24 LTS from https://nodejs.org/en/download
     (one-time, ~30 MB).
  2. Open LM Studio, load a model, click "Start Server" on the Developer
     tab. Keep "Serve on Local Network" OFF.
  3. Double-click start.bat. On first run you'll set a password.
  4. Your browser will open at http://127.0.0.1:3000. Sign in.

Files:
  start.bat   - launch openclaw (close the window to stop)
  stop.bat    - emergency kill of all Node processes
  data\       - your chats, settings, uploads, secrets (back this up)
  app\        - the application; do not modify

Privacy:
  Bound to 127.0.0.1 only. Nothing on your network can reach it.
  No telemetry, no CDN, no external fonts. All local.
