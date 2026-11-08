@echo off
setlocal enabledelayedexpansion

echo ======================================================================
echo   ZiloX ERP & Cloud POS - 100% Native Flutter Desktop Packaging
echo   Compiles Flutter C++ Windows Release & Generates Setup.exe
echo ======================================================================
echo.

:: 1. Clean previous build artifacts
echo [1/5] Cleaning previous directories...
if exist "publish\flutter-desktop" rd /s /q "publish\flutter-desktop"
if exist "dist-installer" rd /s /q "dist-installer"
mkdir "publish\flutter-desktop"
mkdir "publish\api"
mkdir "dist-installer"

:: 2. Build Flutter Windows Release
echo.
echo [2/5] Compiling Flutter Native Windows App (Release)...
where flutter >nul 2>&1
if !ERRORLEVEL! neq 0 (
    echo [ERROR] Flutter SDK is not installed on this PC!
    echo Please install Flutter from: https://docs.flutter.dev/get-started/install/windows
    pause
    exit /b 1
)

cd mobile-app
call flutter pub get
if !ERRORLEVEL! neq 0 (
    echo [ERROR] Flutter pub get failed!
    pause
    exit /b !ERRORLEVEL!
)

call flutter build windows --release
if !ERRORLEVEL! neq 0 (
    echo [ERROR] Flutter Windows build failed!
    pause
    exit /b !ERRORLEVEL!
)
cd ..

:: 3. Collect compiled Windows binary files
echo.
echo [3/5] Collecting compiled Windows binaries...
set "FLUTTER_RELEASE_DIR="
if exist "mobile-app\build\windows\runner\Release" set "FLUTTER_RELEASE_DIR=mobile-app\build\windows\runner\Release"
if exist "mobile-app\build\windows\x64\runner\Release" set "FLUTTER_RELEASE_DIR=mobile-app\build\windows\x64\runner\Release"

if "!FLUTTER_RELEASE_DIR!"=="" (
    echo [ERROR] Flutter release folder not found!
    exit /b 1
)

echo Copying from !FLUTTER_RELEASE_DIR! to publish\flutter-desktop...
xcopy /E /I /Y "!FLUTTER_RELEASE_DIR!\*" "publish\flutter-desktop\"

:: 4. Publish .NET Core Backend API (Optional local host)
echo.
echo [4/5] Publishing .NET Core API Backend (win-x64)...
dotnet publish backend\ERP.Warehouse.Api.csproj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -o publish\api

:: 5. Compile Inno Setup Installer
echo.
echo [5/5] Compiling Single-File Setup.exe with Inno Setup...
set "ISCC_PATH="
if exist "%ProgramFiles(x86)%\Inno Setup 6\ISCC.exe" set "ISCC_PATH=%ProgramFiles(x86)%\Inno Setup 6\ISCC.exe"
if exist "%ProgramFiles%\Inno Setup 6\ISCC.exe" set "ISCC_PATH=%ProgramFiles%\Inno Setup 6\ISCC.exe"

if "!ISCC_PATH!"=="" (
    echo [WARNING] Inno Setup 6 Compiler (ISCC.exe) not found in Program Files.
    echo Please install Inno Setup 6 or run manually:
    echo ISCC.exe packaging\inno-setup\flutter_installer.iss
) else (
    echo Running "!ISCC_PATH!"...
    "!ISCC_PATH!" packaging\inno-setup\flutter_installer.iss
    if %ERRORLEVEL% equ 0 (
        echo.
        echo ======================================================================
        echo   100% NATIVE WINDOWS BUILD SUCCESSFUL!
        echo   Output Installer: dist-installer\Setup.exe
        echo   Ready for USB deployment and client installation.
        echo ======================================================================
    )
)

echo.
pause

