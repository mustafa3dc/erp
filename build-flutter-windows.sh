#!/usr/bin/env bash
set -e

echo "======================================================================"
echo "  ZiloX ERP & Cloud POS - Flutter Native Windows Build Helper         "
echo "======================================================================"

mkdir -p publish/flutter-desktop publish/api dist-installer

if command -v flutter >/dev/null 2>&1; then
    echo "Running flutter pub get in mobile-app..."
    cd mobile-app
    flutter pub get
    cd ..
else
    echo "[INFO] flutter command not installed on this machine."
    echo "Files and Windows C++ runners are prepared. Run build-flutter-windows.bat on Windows."
fi

