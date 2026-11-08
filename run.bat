@echo off
pushd "%~dp0"
title ZiloX ERP Launcher
cls
echo ======================================================================
echo   ZiloX ERP ^& Cloud POS - Launcher
echo   Starting local server and desktop window...
echo ======================================================================
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve.ps1" -LaunchBrowser -Port 5174
popd

