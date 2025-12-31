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
echo  [5] Stop Server
echo  [6] View Server Logs
echo  [7] Exit
echo.
set /p choice=Enter choice (1-7): 

if "%choice%"=="1" goto start_server
if "%choice%"=="2" goto list_profiles
if "%choice%"=="3" goto create_profile
if "%choice%"=="4" goto start_with_profile
if "%choice%"=="5" goto stop_server
if "%choice%"=="6" goto view_logs
if "%choice%"=="7" goto end
echo Invalid choice. Try again.
goto menu

:start_server
echo.
echo Starting multiplayer server with Docker...
echo.
docker-compose up -d
echo.
echo  ============================================
echo   SERVER STARTED!
echo  ============================================
echo.
echo   ADMIN PANEL: http://localhost:8000/admin
echo.
echo   When clients connect, assign their profiles
echo   through the admin panel in your browser!
echo.
echo   Use option 6 to view server logs.
echo  ============================================
echo.
pause
goto menu

:list_profiles
echo.
docker-compose exec al-gameserver bun create-profile.ts --list
echo.
pause
goto menu

:create_profile
echo.
set /p pname=Enter profile name (or press Enter for random): 
echo.
if "%pname%"=="" (
    docker-compose exec al-gameserver bun create-profile.ts
) else (
    docker-compose exec al-gameserver bun create-profile.ts %pname%
)
echo.
pause
goto menu

:start_with_profile
echo.
echo Existing profiles:
docker-compose exec al-gameserver bun create-profile.ts --list
echo.
set /p testprofile=Enter profile name to use as default (for testing): 
if "%testprofile%"=="" (
    echo No profile specified, starting without default.
    docker-compose up -d
) else (
    echo Starting server with default profile: %testprofile%
    docker-compose down 2>nul
    set DEFAULT_PROFILE=%testprofile%
    docker-compose up -d
)
echo.
pause
goto menu

:stop_server
echo.
echo Stopping server...
docker-compose down
echo Server stopped.
echo.
pause
goto menu

:view_logs
echo.
echo Showing server logs (press Ctrl+C to exit)...
echo.
docker-compose logs -f al-gameserver
pause
goto menu

:end
echo Goodbye!
exit
