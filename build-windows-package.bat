@echo off
setlocal enabledelayedexpansion
pushd "%~dp0"

echo ======================================================================
echo   ZiloX ERP ^& Cloud POS - Automated Windows Packaging Script
echo   Generates Single-File Setup.exe with Licensing ^& POS Hardware Bridge
echo ======================================================================
echo.

:: 1. Clean previous build artifacts
echo [1/5] Cleaning previous publish and installer directories...
if exist "publish" rd /s /q "publish"
if exist "dist-installer" rd /s /q "dist-installer"
mkdir "publish\wwwroot"
mkdir "publish\api"
mkdir "publish\desktop"
mkdir "dist-installer"

:: 2. Build Next.js / Vite Web Dashboard
echo.
echo [2/5] Checking Next.js / Vite Web Dashboard (dist)...
if exist "web-dashboard\dist\index.html" (
    echo Frontend is already built! Using existing web-dashboard\dist...
) else (
    echo Building frontend via npm...
    cd web-dashboard
    call npm run build
    if !ERRORLEVEL! neq 0 (
        echo [ERROR] Frontend build failed! Check if Node.js/npm is installed.
        pause
        exit /b !ERRORLEVEL!
    )
    cd ..
)

echo Copying web assets to publish\wwwroot...
xcopy /E /I /Y "web-dashboard\dist\*" "publish\wwwroot\"

:: 3. Publish .NET Core Backend API (Self-Contained Single-File)
echo.
echo [3/5] Publishing .NET Core Backend API (win-x64 self-contained)...
where dotnet >nul 2>&1
if !ERRORLEVEL! neq 0 (
    echo [ERROR] .NET SDK (dotnet command) is not installed on this PC!
    echo Please install .NET 8 SDK from: https://dotnet.microsoft.com/download
    echo.
    pause
    exit /b 1
)

dotnet publish backend\ERP.Warehouse.Api.csproj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -o publish\api
if !ERRORLEVEL! neq 0 (
    echo [ERROR] Backend publish failed!
    pause
    exit /b !ERRORLEVEL!
)

:: 4. Publish C# Desktop Host (WPF + WebView2 + Licensing)
echo.
echo [4/5] Publishing C# Desktop Host (win-x64)...
dotnet publish desktop-host\DesktopHost.csproj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=false -o publish\desktop
if !ERRORLEVEL! neq 0 (
    echo [ERROR] DesktopHost publish failed!
    pause
    exit /b !ERRORLEVEL!
)

:: 5. Compile Inno Setup Installer
echo.
echo [5/5] Compiling Inno Setup Package (Setup.exe)...
set "ISCC_PATH="
if exist "%ProgramFiles(x86)%\Inno Setup 6\ISCC.exe" set "ISCC_PATH=%ProgramFiles(x86)%\Inno Setup 6\ISCC.exe"
if exist "%ProgramFiles%\Inno Setup 6\ISCC.exe" set "ISCC_PATH=%ProgramFiles%\Inno Setup 6\ISCC.exe"

if "!ISCC_PATH!"=="" (
    echo [WARNING] Inno Setup 6 Compiler (ISCC.exe) was not found in Program Files.
    echo Please install Inno Setup 6 or run manually:
    echo ISCC.exe packaging\inno-setup\installer.iss
) else (
    echo Running "!ISCC_PATH!"...
    "!ISCC_PATH!" packaging\inno-setup\installer.iss
    if %ERRORLEVEL% equ 0 (
        echo.
        echo ======================================================================
        echo   BUILD SUCCESSFUL!
        echo   Output Installer: dist-installer\Setup.exe
        echo   Ready for USB deployment and client installation on Windows 10/11.
        echo ======================================================================
    )
)

echo.
pause

