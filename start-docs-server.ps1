param(
  [int]$Port = 8765,
  [switch]$Lan
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$docs = Join-Path $root ".scratch"
$hostName = if ($Lan) { "0.0.0.0" } else { "127.0.0.1" }
$displayHost = if ($Lan) { "your-lan-ip" } else { "127.0.0.1" }
$serverScript = Join-Path $root "scripts\serve-static.mjs"

if (-not (Test-Path -LiteralPath $docs)) {
  throw "Docs directory not found: $docs"
}

$existing = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
if ($existing) {
  Write-Host "Docs server is already running on port $Port."
  Write-Host "Open: http://127.0.0.1:$Port/qa-home.html"
  if ($Lan) {
    Write-Host "LAN:  http://${displayHost}:$Port/qa-home.html"
  }
  exit 0
}

if (-not (Test-Path -LiteralPath $serverScript)) {
  throw "Server script not found: $serverScript"
}

Start-Process -FilePath "node" `
  -ArgumentList @($serverScript, $docs, "$Port", $hostName) `
  -WorkingDirectory $root `
  -WindowStyle Hidden

Start-Sleep -Milliseconds 800
Write-Host "Docs server started."
Write-Host "Open: http://127.0.0.1:$Port/qa-home.html"
if ($Lan) {
  Write-Host "LAN:  http://${displayHost}:$Port/qa-home.html"
  Write-Host "Replace your-lan-ip with this computer's IPv4 address from ipconfig."
}
