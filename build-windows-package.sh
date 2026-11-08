#!/usr/bin/env bash
set -e

echo "======================================================================"
echo "  ZiloX ERP & Cloud POS - Automated Cross-Platform Build Script       "
echo "  Prepares Publish Directories & Generates Windows Packages           "
echo "======================================================================"

# 1. Clean previous build artifacts
echo "[1/4] Cleaning previous publish and installer directories..."
rm -rf publish dist-installer
mkdir -p publish/wwwroot publish/api publish/desktop dist-installer

# 2. Build Web Dashboard (Vite / Next.js SPA)
echo "[2/4] Building Web Dashboard frontend (dist)..."
cd web-dashboard
if command -v npm >/dev/null 2>&1; then
    npm run build || /usr/local/bin/node node_modules/vite/bin/vite.js build
else
    /usr/local/bin/node node_modules/typescript/bin/tsc -b
    /usr/local/bin/node node_modules/vite/bin/vite.js build
fi
cd ..

echo "Copying web assets to publish/wwwroot..."
cp -R web-dashboard/dist/* publish/wwwroot/

# 3. Check for dotnet SDK
if command -v dotnet >/dev/null 2>&1; then
    echo "[3/4] Publishing .NET Core Backend API (win-x64)..."
    dotnet publish backend/ERP.Warehouse.Api.csproj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -o publish/api

    echo "[4/4] Publishing C# Desktop Host (win-x64)..."
    dotnet publish desktop-host/DesktopHost.csproj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=false -o publish/desktop
else
    echo "[INFO] dotnet command not detected on this host. Skipping binary publish on macOS."
    echo "Files in publish/wwwroot prepared. On Windows machine, run build-windows-package.bat."
fi

# 4. Check for iscc (Inno Setup)
if command -v iscc >/dev/null 2>&1; then
    echo "Running Inno Setup compiler..."
    iscc packaging/inno-setup/installer.iss
    echo "Setup.exe created in dist-installer/Setup.exe"
fi

echo "======================================================================"
echo "  Build step completed successfully!                                  "
echo "======================================================================"
