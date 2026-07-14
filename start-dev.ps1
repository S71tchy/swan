#!/usr/bin/env pwsh
# SWAN dev launcher — starts the FastAPI backend and the Vite frontend together
# and streams both logs to this terminal, tagged [api] (blue) and [web] (magenta).
#
#   ./start-dev.ps1            # start both services
#   ./start-dev.ps1 -Seed      # reseed the database first
#   ./start-dev.ps1 -ApiPort 8001 -WebPort 5174
#
# Ctrl+C stops both and releases the ports.
param(
    [switch]$Seed,
    [int]$ApiPort = 8000,
    [int]$WebPort = 5173
)

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot

function Free-Port([int]$port) {
    Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
        ForEach-Object {
            try {
                Stop-Process -Id $_.OwningProcess -Force -ErrorAction Stop
                Write-Host "  freed port $port (pid $($_.OwningProcess))" -ForegroundColor DarkGray
            } catch {}
        }
}

Write-Host "SWAN dev launcher" -ForegroundColor Cyan
Write-Host "clearing stale listeners..." -ForegroundColor DarkGray
Free-Port $ApiPort
Free-Port $WebPort

if ($Seed) {
    Write-Host "seeding database..." -ForegroundColor Yellow
    Push-Location "$root/server"
    try { uv run python -m app.seed } finally { Pop-Location }
}

# Each service runs as a background job; uvicorn's --reload and vite spawn child
# processes, so we also free the ports in the cleanup block to avoid orphans.
$api = Start-Job -Name swan-api -ScriptBlock {
    param($dir, $port)
    Set-Location "$dir/server"
    uv run uvicorn app.main:app --reload --port $port 2>&1
} -ArgumentList $root, $ApiPort

$web = Start-Job -Name swan-web -ScriptBlock {
    param($dir)
    Set-Location "$dir/web"
    npm run dev 2>&1
} -ArgumentList $root

Write-Host ""
Write-Host "  api  -> http://localhost:$ApiPort   (docs at /docs)" -ForegroundColor Blue
Write-Host "  web  -> http://localhost:$WebPort   <- open this" -ForegroundColor Magenta
Write-Host "  Ctrl+C to stop both." -ForegroundColor DarkGray
Write-Host ""

function Pump {
    Receive-Job $api | ForEach-Object { Write-Host "[api] $_" -ForegroundColor Blue }
    Receive-Job $web | ForEach-Object { Write-Host "[web] $_" -ForegroundColor Magenta }
}

try {
    while ($true) {
        Pump
        $dead = @($api, $web) | Where-Object { $_.State -in 'Completed', 'Failed', 'Stopped' }
        if ($dead) {
            Start-Sleep -Milliseconds 300
            Pump  # flush the exiting service's final lines
            Write-Host "`na service exited ($($dead.Name -join ', ')) — shutting down." -ForegroundColor Yellow
            break
        }
        Start-Sleep -Milliseconds 400
    }
}
finally {
    Write-Host "stopping services..." -ForegroundColor Yellow
    Stop-Job $api, $web -ErrorAction SilentlyContinue
    Remove-Job $api, $web -Force -ErrorAction SilentlyContinue
    Free-Port $ApiPort
    Free-Port $WebPort
    Write-Host "done." -ForegroundColor DarkGray
}
