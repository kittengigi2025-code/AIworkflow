$ErrorActionPreference = "Stop"

$targetScript = "D:\gaming-platform-qa\scripts\desktop_activity_runner.ps1"
$targetPythonScript = "D:\gaming-platform-qa\scripts\desktop_activity_runner.py"
$targetBridge = "D:\gaming-platform-qa\scripts\cloudflare_activity_bridge.mjs"

Get-CimInstance Win32_Process |
    Where-Object {
        $_.CommandLine -and
        (
            $_.CommandLine.Contains($targetScript) -or
            $_.CommandLine.Contains($targetPythonScript) -or
            $_.CommandLine.Contains($targetBridge)
        )
    } |
    ForEach-Object {
        Stop-Process -Id $_.ProcessId -Force
    }
