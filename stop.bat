@echo off
title Routify LifeOS - Stop Services
color 0C

echo ====================================================================
echo                   [STOP] ROUTIFY LIFEOS
echo ====================================================================
echo.
echo [*] Terminating Backend (Port 8000) and Frontend (Port 5173)...

for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":8000" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>nul
)

for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":5173" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>nul
)

echo.
echo [OK] All Routify LifeOS services have been stopped cleanly!
echo ====================================================================
echo.
timeout /t 3 >nul 2>nul || ping -n 4 127.0.0.1 >nul
