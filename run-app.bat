@echo off
chcp 65001 >nul
pushd "%~dp0"
title ZiloX ERP & POS Launcher

echo ======================================================================
echo   ⚡ ZiloX ERP ^& Cloud POS - تشغيل البرنامج المباشر
echo ======================================================================
echo.
echo [1/3] جاري تهيئة مسار العمل وفحص الملفات...

set "WEB_DIR="
if exist "web-dashboard\dist\index.html" set "WEB_DIR=web-dashboard\dist"
if exist "publish\wwwroot\index.html" set "WEB_DIR=publish\wwwroot"

if "%WEB_DIR%"=="" (
    echo [خطأ] لم يتم العثور على ملفات الواجهة web-dashboard\dist\index.html
    echo يرجى التأكد من مسار المشروع.
    pause
    popd
    exit /b 1
)

echo [2/3] جاري تشغيل خادم النظام المحلي على المنفذ 5174...

:: Start the standalone background TCP server
start "ZiloX_Local_Server" /min powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve.ps1" -WebDir "%WEB_DIR%" -Port 5174

:: Wait until 127.0.0.1:5174 is actively responding (up to 6 seconds)
powershell -NoProfile -Command "$ready=$false; for ($i=0; $i -lt 15; $i++) { try { $t = New-Object System.Net.Sockets.TcpClient('127.0.0.1', 5174); $t.Close(); $ready=$true; break } catch { Start-Sleep -Milliseconds 400 } }; exit $(if ($ready) { 0 } else { 1 })"

if %ERRORLEVEL% neq 0 (
    echo [تحذير] الخادم أخذ وقتاً أطول، جاري فتح الواجهة مباشرة...
)

echo [3/3] جاري فتح نافذة البرنامج المستقلة...
echo.

:: Open in standalone App Window Mode using Microsoft Edge or Chrome
where msedge >nul 2>&1
if %ERRORLEVEL% equ 0 (
    start "" msedge --app=http://127.0.0.1:5174/ --window-size=1366,768
) else (
    where chrome >nul 2>&1
    if %ERRORLEVEL% equ 0 (
        start "" chrome --app=http://127.0.0.1:5174/ --window-size=1366,768
    ) else (
        start http://127.0.0.1:5174/
    )
)

echo ======================================================================
echo   ✓ تم تشغيل البرنامج بنجاح!
echo   الرابط المحلي: http://127.0.0.1:5174/
echo.
echo   ملاحظة: اترك هذه الشاشة السوداء مفتوحة أو مصغرة، 
echo   لأنها المسؤولة عن تزويد نافذة البرنامج بالبيانات.
echo ======================================================================
echo.
pause
popd
