@echo off
title Echoland Multiplayer Server
color 0A

:: Find bun executable
set "BUN_CMD=bun"
where bun >nul 2>nul
if %errorlevel% neq 0 (
    :: Check common install location
    if exist "%USERPROFILE%\.bun\bin\bun.exe" (
        set "BUN_CMD=%USERPROFILE%\.bun\bin\bun.exe"
    ) else (
        echo.
        echo  ERROR: Bun is not installed or not in PATH!
        echo.
        echo  Install Bun by running this in PowerShell:
        echo    irm bun.sh/install.ps1 ^| iex
        echo.
        echo  Or download from: https://bun.sh
        echo.
        pause
        exit /b 1
    )
)

echo.
echo  ============================================
echo     ECHOLAND MULTIPLAYER SERVER
echo  ============================================
echo.
echo  This server handles MULTIPLE players.
echo  Each player connects with their own profile.
echo.

:menu
echo  What would you like to do?
echo.
echo  [1] Start Server (multiplayer mode)
echo  [2] List existing profiles
echo  [3] Create a new profile
echo  [4] Start Server with a default test profile
echo  [5] Exit
echo.
set /p choice=Enter choice (1-5): 

if "%choice%"=="1" goto start_server
if "%choice%"=="2" goto list_profiles
if "%choice%"=="3" goto create_profile
if "%choice%"=="4" goto start_with_profile
if "%choice%"=="5" goto end
echo Invalid choice. Try again.
goto menu

:start_server
echo.
echo Starting multiplayer server...
echo Players connect with X-Profile header or ?profile= param
echo.
"%BUN_CMD%" game-server.ts
pause
goto menu

:list_profiles
echo.
"%BUN_CMD%" create-profile.ts --list
echo.
pause
goto menu

:create_profile
echo.
set /p pname=Enter profile name (or press Enter for random): 
if "%pname%"=="" (
    "%BUN_CMD%" create-profile.ts
) else (
    "%BUN_CMD%" create-profile.ts %pname%
)
echo.
pause
goto menu

:start_with_profile
echo.
echo Existing profiles:
"%BUN_CMD%" create-profile.ts --list
echo.
set /p testprofile=Enter profile name to use as default (for testing): 
if "%testprofile%"=="" (
    echo No profile specified, starting without default.
    "%BUN_CMD%" game-server.ts
) else (
    echo Starting server with default profile: %testprofile%
    set DEFAULT_PROFILE=%testprofile%
    "%BUN_CMD%" game-server.ts
)
pause
goto menu

:end
echo Goodbye!
exit
