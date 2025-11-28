@echo off
echo ============================================
echo   Echoland Multiplayer - Profile List
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

cd /d "%~dp0.."
"%BUN_CMD%" create-profile.ts --list
echo.
pause
