@echo off
REM === Base folder is where this batch file lives ===
set BASE=%~dp0

REM === Start Caddy (expects caddy.exe and Caddyfile in a subfolder called CADDY) ===
start "Caddy" cmd /c "%BASE%CADDY\caddy.exe run --config %BASE%CADDY\Caddyfile"

REM === Start Bun game server (expects server files in a subfolder called Echoland) ===
cd /d "%BASE%Echoland"
start "GameServer" cmd /c "bun start"

REM === Keep launcher window open ===
echo Caddy and Bun server started. Press any key to close this launcher...
pause >nul