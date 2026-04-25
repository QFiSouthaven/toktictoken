@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo Node.js 22.13+ or 24 LTS is required.
  echo Install it from https://nodejs.org/en/download then run start.bat again.
  echo.
  pause
  exit /b 1
)

if not exist "data" mkdir data

if not exist "data\.env" (
  echo.
  echo === First-time setup ===
  set /p "PW=Choose a password (you'll use this to log in): "
  if "!PW!"=="" (
    echo Password cannot be empty.
    pause
    exit /b 1
  )
  for /f "delims=" %%h in ('node -e "console.log(require('./app/node_modules/bcryptjs').hashSync(process.argv[1],12))" "!PW!"') do set "ADMIN_HASH=%%h"
  for /f "delims=" %%j in ('node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"') do set "JWT=%%j"
  > "data\.env" (
    echo ADMIN_PASSWORD_HASH=!ADMIN_HASH!
    echo JWT_SECRET=!JWT!
  )
  echo.
  echo Saved. Starting openclaw...
  echo.
)

for /f "usebackq tokens=1,* delims==" %%a in ("data\.env") do set "%%a=%%b"
set "DATA_DIR=%~dp0data"
set "HOST=127.0.0.1"
set "PORT=3000"
if "%LM_STUDIO_URL%"=="" set "LM_STUDIO_URL=http://127.0.0.1:1234"
set "NODE_ENV=production"

echo openclaw is running at http://127.0.0.1:3000
echo Make sure LM Studio is open with a model loaded and "Start Server" enabled on port 1234.
echo Close this window to stop.
echo.

start "" http://127.0.0.1:3000
node app\index.js
