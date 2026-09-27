@echo off
title Routify LifeOS - Disable Autostart on Boot
color 0E

echo ====================================================================
echo        ROUTIFY LIFEOS - DISABLE AUTOSTART ON BOOT
echo ====================================================================
echo.

set "STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "SHORTCUT_PATH=%STARTUP_DIR%\Routify LifeOS.lnk"

if exist "%SHORTCUT_PATH%" (
    del /f /q "%SHORTCUT_PATH%" >nul 2>nul
    echo ====================================================================
    echo  [OK] AUTOSTART DISABLED SUCCESSFULLY!
    echo ====================================================================
    echo  - Routify will no longer start automatically when Windows boots.
    echo  - You can re-enable it anytime by running "enable_autostart.bat".
    echo ====================================================================
) else (
    echo [*] Routify is not currently in Windows Startup list.
)

echo.
echo Press any key to exit...
pause >nul
