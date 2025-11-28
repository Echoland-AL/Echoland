@echo off
echo ============================================
echo   Echoland Multiplayer - Profile Creator
echo ============================================
echo.

:: Find bun executable
set "BUN_CMD=bun"
where bun >nul 2>nul
if %errorlevel% neq 0 (
    if exist "%USERPROFILE%\.bun\bin\bun.exe" (
        set "BUN_CMD=%USERPROFILE%\.bun\bin\bun.exe"
    ) else (
        echo ERROR: Bun is not installed or not in PATH!
        echo Install: irm bun.sh/install.ps1 ^| iex
        pause
        exit /b 1
    )
)

echo This creates a profile that can be used by clients.
echo (Note: Profiles are also auto-created when clients connect!)
echo.

set /p PROFILE_NAME=Enter profile name (or press Enter for random): 

cd /d "%~dp0.."

if "%PROFILE_NAME%"=="" (
    "%BUN_CMD%" create-profile.ts
) else (
    "%BUN_CMD%" create-profile.ts %PROFILE_NAME%
)

echo.
pause
