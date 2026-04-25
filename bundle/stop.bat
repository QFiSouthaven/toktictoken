@echo off
echo This will kill all node.exe processes on this machine.
echo If you have other Node apps running, close them via Ctrl+C in their windows instead.
set /p "OK=Continue? (y/N): "
if /i not "%OK%"=="y" exit /b 0
taskkill /IM node.exe /F
