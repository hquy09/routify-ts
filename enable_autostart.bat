@echo off
title Routify LifeOS - Enable Autostart on Boot
color 0A

echo ====================================================================
echo         ROUTIFY LIFEOS - ENABLE AUTOSTART ON BOOT
echo ====================================================================
echo.

set "ROOT_DIR=%~dp0"
if "%ROOT_DIR:~-1%"=="\" set "ROOT_DIR=%ROOT_DIR:~0,-1%"

set "STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "SHORTCUT_PATH=%STARTUP_DIR%\Routify LifeOS.lnk"
set "TARGET_PATH=%ROOT_DIR%\Routify.vbs"
set "ICON_PATH=%ROOT_DIR%\routify.ico"

echo [*] Creating shortcut in Windows Startup folder...

powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT_DIR%\scripts\create_shortcut.ps1" -ShortcutPath "%SHORTCUT_PATH%" -TargetPath "%TARGET_PATH%" -WorkingDir "%ROOT_DIR%" -IconPath "%ICON_PATH%" -Description "Routify LifeOS - Autostart on boot"

if exist "%SHORTCUT_PATH%" (
    echo.
    echo ====================================================================
    echo  [OK] AUTOSTART ENABLED SUCCESSFULLY!
    echo ====================================================================
    echo  - Routify will now start automatically and silently whenever
    echo    you log into Windows.
    echo  - You can disable this anytime by running "disable_autostart.bat".
    echo ====================================================================
) else (
    echo [ERROR] Failed to create shortcut in Startup folder.
)

echo.
echo Press any key to exit...
pause >nul
