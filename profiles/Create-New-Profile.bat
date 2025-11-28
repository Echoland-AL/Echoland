@echo off
echo ============================================
echo   Echoland Multiplayer - Profile Creator
echo ============================================
echo.
echo This creates a profile that can be used by clients.
echo (Note: Profiles are also auto-created when clients connect!)
echo.
echo Make sure the server is running first!
echo.

set /p PROFILE_NAME=Enter profile name (or press Enter for random): 

cd /d "%~dp0.."

if "%PROFILE_NAME%"=="" (
    docker-compose exec al-gameserver bun create-profile.ts
) else (
    docker-compose exec al-gameserver bun create-profile.ts %PROFILE_NAME%
)

echo.
pause
