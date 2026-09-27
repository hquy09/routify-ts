@echo off
title Routify LifeOS - Start Services
color 0A

echo ====================================================================
echo                   [START] ROUTIFY LIFEOS
echo ====================================================================
echo.

set "ROOT_DIR=%~dp0"
if "%ROOT_DIR:~-1%"=="\" set "ROOT_DIR=%ROOT_DIR:~0,-1%"
cd /d "%ROOT_DIR%"

:: 1. Check Python
where python >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Python not found on your system!
    echo Please install Python and check "Add Python to PATH".
    echo Or run "setup_full.bat" to install automatically.
    echo.
    pause
    exit /b 1
)

:: 2. Check Node.js / npm
where npm >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js / npm not found on your system!
    echo Please install Node.js from https://nodejs.org/
    echo Or run "setup_full.bat" to install automatically.
    echo.
    pause
    exit /b 1
)

:: 3. Clean old processes on ports 8000 and 5173
echo [*] Checking and freeing ports 8000 and 5173...
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":8000" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>nul
)
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":5173" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>nul
)

:: 4. Start Backend
echo [*] Starting Backend (FastAPI - Port 8000)...
start "Routify - Backend (FastAPI)" cmd /k "title Routify - Backend && cd /d "%ROOT_DIR%\backend" && python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload"

:: 5. Start Frontend
echo [*] Starting Frontend (Vite - Port 5173)...
start "Routify - Frontend (Vite)" cmd /k "title Routify - Frontend && cd /d "%ROOT_DIR%\frontend" && npm run dev"

:: 6. Wait 3 seconds for servers to be ready and launch browser
echo [*] Opening browser...
ping -n 4 127.0.0.1 >nul

start "" "http://localhost:5173/"

echo.
echo ====================================================================
echo                   [OK] ROUTIFY STARTED SUCCESSFULLY!
echo ====================================================================
echo.
echo  - Frontend Web UI : http://localhost:5173/
echo  - Backend API Docs: http://127.0.0.1:8000/docs
echo.
echo  * Notes:
echo    - Backend and Frontend consoles are running independently.
echo    - To stop all services, run "stop.bat".
echo ====================================================================
echo.
echo This window will close automatically in 5 seconds...
timeout /t 5 >nul 2>nul || ping -n 6 127.0.0.1 >nul
