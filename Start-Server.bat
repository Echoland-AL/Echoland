@echo off
set BASE=%~dp0

REM Kill any leftovers
taskkill /F /IM caddy.exe >nul 2>&1
taskkill /F /IM bun.exe >nul 2>&1

REM Start Caddy visibly
start "" "%BASE%CADDY\caddy.exe" run --config "%BASE%CADDY\Caddyfile"

REM Start Bun server
cd /d "%BASE%"
start "" bun start

echo Caddy and Bun server started. Press any key to close this launcher...
pause >nul