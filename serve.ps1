param(
    [string]$WebDir = "",
    [int]$Port = 5174,
    [switch]$LaunchBrowser
)

$ErrorActionPreference = "Continue"

# Resolve absolute path for WebDir relative to script location
$scriptDir = $PSScriptRoot
if (-not $scriptDir) { $scriptDir = (Get-Location).Path }

$resolvedDir = if ($WebDir -and (Test-Path $WebDir)) {
    (Resolve-Path $WebDir).Path
} elseif (Test-Path (Join-Path $scriptDir "web-dashboard\dist")) {
    (Resolve-Path (Join-Path $scriptDir "web-dashboard\dist")).Path
} elseif (Test-Path (Join-Path $scriptDir "publish\wwwroot")) {
    (Resolve-Path (Join-Path $scriptDir "publish\wwwroot")).Path
} elseif (Test-Path (Join-Path $scriptDir "dist")) {
    (Resolve-Path (Join-Path $scriptDir "dist")).Path
} elseif (Test-Path "web-dashboard\dist") {
    (Resolve-Path "web-dashboard\dist").Path
} else {
    $scriptDir
}

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   ZiloX ERP & Cloud POS - Standalone Windows Server      " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Web Root Directory: $resolvedDir" -ForegroundColor Gray
Write-Host "Local URL:          http://127.0.0.1:$Port/" -ForegroundColor Yellow
Write-Host "----------------------------------------------------------" -ForegroundColor DarkGray

try {
    $listener = New-Object System.Net.Sockets.TcpListener ([System.Net.IPAddress]::Loopback), $Port
    $listener.Start()
    Write-Host "[OK] Server is actively listening on http://127.0.0.1:$Port" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Failed to start listener on port $Port : $_" -ForegroundColor Red
    Write-Host "Port $Port may already be in use. Trying port 5175..." -ForegroundColor Yellow
    $Port = 5175
    try {
        $listener = New-Object System.Net.Sockets.TcpListener ([System.Net.IPAddress]::Loopback), $Port
        $listener.Start()
        Write-Host "[OK] Server listening on http://127.0.0.1:$Port" -ForegroundColor Green
    } catch {
        Write-Host "[FATAL] Cannot bind port. Exiting." -ForegroundColor Red
        exit 1
    }
}

if ($LaunchBrowser) {
    Write-Host "[INFO] Opening standalone application window..." -ForegroundColor Cyan
    $appUrl = "http://127.0.0.1:$Port/"
    Start-Process powershell -ArgumentList "-NoProfile -Command `"Start-Sleep -Milliseconds 700; if (Get-Command msedge -ErrorAction SilentlyContinue) { Start-Process msedge '--app=$appUrl --window-size=1366,768' } elseif (Get-Command chrome -ErrorAction SilentlyContinue) { Start-Process chrome '--app=$appUrl --window-size=1366,768' } else { Start-Process '$appUrl' }`"" -WindowStyle Hidden
}

Write-Host "Press Ctrl+C to stop the server." -ForegroundColor DarkGray

while ($true) {
    try {
        $client = $listener.AcceptTcpClient()
        $stream = $client.GetStream()
        $reader = New-Object System.IO.StreamReader($stream)

        $requestLine = $reader.ReadLine()
        if ([string]::IsNullOrWhiteSpace($requestLine)) {
            $client.Close()
            continue
        }

        # Parse HTTP request: GET /path HTTP/1.1
        $parts = $requestLine.Split(' ')
        $rawPath = if ($parts.Length -ge 2) { $parts[1].Split('?')[0].TrimStart('/') } else { '' }
        $urlPath = [System.Uri]::UnescapeDataString($rawPath)
        
        if ([string]::IsNullOrEmpty($urlPath) -or $urlPath -eq "/") {
            $urlPath = "index.html"
        }

        # Sanitize slashes for Windows path resolution
        $normalizedPath = $urlPath.Replace('/', [System.IO.Path]::DirectorySeparatorChar)
        $filePath = Join-Path $resolvedDir $normalizedPath

        # SPA routing: if file does not exist or is a directory, fallback to index.html
        if (-not (Test-Path $filePath -PathType Leaf)) {
            $filePath = Join-Path $resolvedDir "index.html"
        }

        if (Test-Path $filePath -PathType Leaf) {
            $bytes = [System.IO.File]::ReadAllBytes($filePath)
            $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
            $mime = switch ($ext) {
                ".html" { "text/html; charset=utf-8" }
                ".htm"  { "text/html; charset=utf-8" }
                ".js"   { "application/javascript; charset=utf-8" }
                ".mjs"  { "application/javascript; charset=utf-8" }
                ".css"  { "text/css; charset=utf-8" }
                ".svg"  { "image/svg+xml" }
                ".png"  { "image/png" }
                ".jpg"  { "image/jpeg" }
                ".jpeg" { "image/jpeg" }
                ".ico"  { "image/x-icon" }
                ".woff2"{ "font/woff2" }
                ".woff" { "font/woff" }
                ".ttf"  { "font/ttf" }
                default { "application/octet-stream" }
            }

            $header = "HTTP/1.1 200 OK`r`nContent-Type: $mime`r`nContent-Length: $($bytes.Length)`r`nAccess-Control-Allow-Origin: *`r`nCache-Control: no-cache`r`nConnection: close`r`n`r`n"
            $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
            $stream.Write($headerBytes, 0, $headerBytes.Length)
            $stream.Write($bytes, 0, $bytes.Length)
        } else {
            $header = "HTTP/1.1 404 Not Found`r`nContent-Length: 0`r`nConnection: close`r`n`r`n"
            $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
            $stream.Write($headerBytes, 0, $headerBytes.Length)
        }

        $stream.Flush()
        $client.Close()
    } catch {
        # Continue loop on any individual client disconnect
    }
}
