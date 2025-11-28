@echo off
echo ============================================
echo   Echoland Multiplayer - Profile List
echo ============================================
echo.
echo Make sure the server is running first!
echo.

cd /d "%~dp0.."
docker-compose exec al-gameserver bun create-profile.ts --list
echo.
pause
