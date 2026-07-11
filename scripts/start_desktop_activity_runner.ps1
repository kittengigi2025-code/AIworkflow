$ErrorActionPreference = "Stop"

$repoRoot = "D:\gaming-platform-qa"
$bridge = Join-Path $repoRoot "scripts\cloudflare_activity_bridge.mjs"
$node = "node.exe"

Set-Location $repoRoot
Start-Process -FilePath $node -ArgumentList @($bridge) -WindowStyle Hidden
