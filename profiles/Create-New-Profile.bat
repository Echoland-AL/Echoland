@echo off
echo ============================================
echo   Echoland Multiplayer - Profile Creator
echo ============================================
echo.
echo This creates a profile that can be used by clients.
echo (Note: Profiles are also auto-created when clients connect!)
echo.

set /p PROFILE_NAME=Enter profile name (or press Enter for random): 

if "%PROFILE_NAME%"=="" (
    bun create-profile.ts
) else (
    bun create-profile.ts %PROFILE_NAME%
)

echo.
pause
