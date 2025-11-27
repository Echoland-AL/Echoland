@echo off
title Echoland Multiplayer Server
color 0A

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
bun game-server.ts
pause
goto menu

:list_profiles
echo.
bun create-profile.ts --list
echo.
pause
goto menu

:create_profile
echo.
set /p pname=Enter profile name (or press Enter for random): 
if "%pname%"=="" (
    bun create-profile.ts
) else (
    bun create-profile.ts %pname%
)
echo.
pause
goto menu

:start_with_profile
echo.
echo Existing profiles:
bun create-profile.ts --list
echo.
set /p testprofile=Enter profile name to use as default (for testing): 
if "%testprofile%"=="" (
    echo No profile specified, starting without default.
    bun game-server.ts
) else (
    echo Starting server with default profile: %testprofile%
    set DEFAULT_PROFILE=%testprofile%
    bun game-server.ts
)
pause
goto menu

:end
echo Goodbye!
exit
