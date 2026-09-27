@echo off
title Routify LifeOS - Automated Full Setup
color 0B

set "ROOT_DIR=%~dp0"
if "%ROOT_DIR:~-1%"=="\" set "ROOT_DIR=%ROOT_DIR:~0,-1%"
cd /d "%ROOT_DIR%"

echo ====================================================================
echo             ROUTIFY LIFEOS - AUTOMATED FULL INSTALLER
echo ====================================================================
echo  Version: v28.9.6
echo  Automatically verifies and configures:
echo   - Python environment and dependencies
echo   - Node.js and npm environment
echo   - SQLite database initialization
echo   - Frontend Vite build
echo   - Desktop shortcut creation
echo   - Windows Startup configuration (autostart on boot)
echo ====================================================================
echo.

:: ---------------------------------------------------------------------
:: 1. CHECK AND INSTALL PYTHON
:: ---------------------------------------------------------------------
echo [1/6] Checking Python environment...

where python >nul 2>nul
if %ERRORLEVEL% neq 0 goto :INSTALL_PYTHON

for /f "tokens=*" %%v in ('python --version 2^>^&1') do echo  [OK] Found Python: %%v
goto :PYTHON_DONE

:INSTALL_PYTHON
echo  [-] Python not found on your system.
echo  [*] Downloading and installing Python 3.12 automatically...

where winget >nul 2>nul
if %ERRORLEVEL% neq 0 goto :DOWNLOAD_PYTHON_DIRECT

echo  [*] Installing via Windows Package Manager (winget)...
winget install --id Python.Python.3.12 -e --silent --accept-package-agreements --accept-source-agreements
goto :FINISH_PYTHON_INSTALL

:DOWNLOAD_PYTHON_DIRECT
echo  [*] Downloading installer directly from python.org...
powershell -NoProfile -Command "Invoke-WebRequest -Uri 'https://www.python.org/ftp/python/3.12.8/python-3.12.8-amd64.exe' -OutFile 'python_temp_installer.exe'"
echo  [*] Running silent installer...
python_temp_installer.exe /quiet InstallAllUsers=0 PrependPath=1 Include_pip=1 SimpleInstall=1
del /f /q python_temp_installer.exe >nul 2>nul

:FINISH_PYTHON_INSTALL
for /f "tokens=2*" %%A in ('reg query "HKCU\Environment" /v Path 2^>nul') do set "PATH=%%B;%PATH%"
for /f "tokens=2*" %%A in ('reg query "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" /v Path 2^>nul') do set "PATH=%%B;%PATH%"
set "PATH=%LOCALAPPDATA%\Programs\Python\Python312;%LOCALAPPDATA%\Programs\Python\Python312\Scripts;%PATH%"

echo  [OK] Python installation completed!

:PYTHON_DONE
echo.

:: ---------------------------------------------------------------------
:: 2. CHECK AND INSTALL NODE.JS & NPM
:: ---------------------------------------------------------------------
echo [2/6] Checking Node.js and npm...

where npm >nul 2>nul
if %ERRORLEVEL% neq 0 goto :INSTALL_NODE

for /f "tokens=*" %%v in ('node -v 2^>^&1') do echo  [OK] Found Node.js: %%v
for /f "tokens=*" %%v in ('npm -v 2^>^&1') do echo  [OK] Found npm: %%v
goto :NODE_DONE

:INSTALL_NODE
echo  [-] Node.js not found on your system.
echo  [*] Downloading and installing Node.js LTS automatically...

where winget >nul 2>nul
if %ERRORLEVEL% neq 0 goto :DOWNLOAD_NODE_DIRECT

echo  [*] Installing via Windows Package Manager (winget)...
winget install --id OpenJS.NodeJS.LTS -e --silent --accept-package-agreements --accept-source-agreements
goto :FINISH_NODE_INSTALL

:DOWNLOAD_NODE_DIRECT
echo  [*] Downloading MSI installer directly from nodejs.org...
powershell -NoProfile -Command "Invoke-WebRequest -Uri 'https://nodejs.org/dist/v20.18.0/node-v20.18.0-x64.msi' -OutFile 'node_temp_installer.msi'"
echo  [*] Running silent MSI installer...
msiexec /i node_temp_installer.msi /qn
del /f /q node_temp_installer.msi >nul 2>nul

:FINISH_NODE_INSTALL
set "PATH=C:\Program Files\nodejs;%APPDATA%\npm;%PATH%"
for /f "tokens=2*" %%A in ('reg query "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" /v Path 2^>nul') do set "PATH=%%B;%PATH%"

echo  [OK] Node.js and npm installation completed!

:NODE_DONE
echo.

:: ---------------------------------------------------------------------
:: 3. SETUP BACKEND & PYTHON PACKAGES
:: ---------------------------------------------------------------------
echo [3/6] Setting up Backend environment and Python packages...

set "VENV_DIR=%ROOT_DIR%\backend\.venv"
set "PY_EXE=%VENV_DIR%\Scripts\python.exe"

if exist "%PY_EXE%" goto :VENV_EXISTS

echo  [*] Creating Python virtual environment .venv...
python -m venv "%VENV_DIR%"

:VENV_EXISTS
if not exist "%PY_EXE%" set "PY_EXE=python"

echo  [*] Upgrading pip...
"%PY_EXE%" -m pip install --upgrade pip -q >nul 2>nul

echo  [*] Installing Backend dependencies (FastAPI, Uvicorn, SQLAlchemy, Pillow)...
"%PY_EXE%" -m pip install -r "%ROOT_DIR%\backend\requirements.txt" pillow -q

echo  [*] Initializing SQLite database (lifeos.db)...
cd /d "%ROOT_DIR%\backend"
"%PY_EXE%" -c "from app.models import Base; from app.database.session import engine; Base.metadata.create_all(bind=engine); print('  [OK] SQLite database schema ready.')"
cd /d "%ROOT_DIR%"

echo  [OK] Backend setup completed!
echo.

:: ---------------------------------------------------------------------
:: 4. SETUP FRONTEND (REACT VITE)
:: ---------------------------------------------------------------------
echo [4/6] Setting up Frontend (React Vite)...

cd /d "%ROOT_DIR%\frontend"
echo  [*] Installing Frontend packages via npm (please wait a moment)...
call npm.cmd install --no-fund --no-audit >nul 2>nul || call npm install --no-fund --no-audit >nul 2>nul

echo  [*] Compiling production build (Vite build)...
call npm.cmd run build >nul 2>nul || call npm run build >nul 2>nul
cd /d "%ROOT_DIR%"

if exist "%ROOT_DIR%\routify.ico" goto :ICON_EXISTS

echo  [*] Generating Routify application icon...
"%PY_EXE%" -c "from PIL import Image; img = Image.open('frontend/src/assets/hero.png'); img.save('routify.ico', format='ICO', sizes=[(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)])" 2>nul

:ICON_EXISTS
echo  [OK] Frontend setup completed!
echo.

:: ---------------------------------------------------------------------
:: 5. CREATE DESKTOP SHORTCUT
:: ---------------------------------------------------------------------
echo [5/6] Creating Desktop shortcut...

set "DESKTOP_DIR=%USERPROFILE%\Desktop"
set "DESKTOP_SHORTCUT=%DESKTOP_DIR%\Routify LifeOS.lnk"
set "LAUNCHER_TARGET=%ROOT_DIR%\Routify.vbs"
set "ICON_TARGET=%ROOT_DIR%\routify.ico"

powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT_DIR%\scripts\create_shortcut.ps1" -ShortcutPath "%DESKTOP_SHORTCUT%" -TargetPath "%LAUNCHER_TARGET%" -WorkingDir "%ROOT_DIR%" -IconPath "%ICON_TARGET%" -Description "Routify LifeOS - Study, Work and Fitness Management"

echo  [OK] Created shortcut 'Routify LifeOS' on your Desktop!
echo.

:: ---------------------------------------------------------------------
:: 6. CONFIGURE AUTOSTART WITH WINDOWS
:: ---------------------------------------------------------------------
echo [6/6] Configuring Windows Startup (autostart on boot)...

set "STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "STARTUP_SHORTCUT=%STARTUP_DIR%\Routify LifeOS.lnk"

powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT_DIR%\scripts\create_shortcut.ps1" -ShortcutPath "%STARTUP_SHORTCUT%" -TargetPath "%LAUNCHER_TARGET%" -WorkingDir "%ROOT_DIR%" -IconPath "%ICON_TARGET%" -Description "Routify LifeOS - Autostart on boot"

echo  [OK] Enabled: Routify will start automatically and silently when your PC boots up!
echo       (You can disable this anytime by running 'disable_autostart.bat').
echo.

:: ---------------------------------------------------------------------
:: SETUP COMPLETED
:: ---------------------------------------------------------------------
color 0A
echo ====================================================================
echo             SETUP COMPLETED SUCCESSFULLY!
echo ====================================================================
echo.
echo  * Summary:
echo    [+] Python and Node.js environments verified
echo    [+] Backend and Frontend dependencies installed
echo    [+] SQLite database verified and ready
echo    [+] 'Routify LifeOS' Desktop shortcut created
echo    [+] Autostart on Windows boot configured
echo.
echo  * Quick Guide:
echo    - Double-click 'Routify LifeOS' on your Desktop to open.
echo    - To stop the application: Run 'stop.bat'.
echo    - To disable autostart on boot: Run 'disable_autostart.bat'.
echo ====================================================================
echo.

set /p START_NOW="Do you want to launch Routify LifeOS right now? (Y/N) [Default: Y]: "
if /i "%START_NOW%"=="n" goto :SKIP_LAUNCH

echo [*] Launching Routify LifeOS...
start "" wscript.exe "%ROOT_DIR%\Routify.vbs"
ping -n 3 127.0.0.1 >nul
exit /b 0

:SKIP_LAUNCH
echo.
echo Setup finished. Thank you for using Routify LifeOS!
ping -n 4 127.0.0.1 >nul
exit /b 0
