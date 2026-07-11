param(
    [string]$Config = ".\scripts\desktop_activity_runner.config.json",
    [switch]$Once,
    [switch]$DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Add-Type @"
using System;
using System.Runtime.InteropServices;

public static class DesktopActivityNative {
    [StructLayout(LayoutKind.Sequential)]
    public struct POINT {
        public int X;
        public int Y;
    }

    [DllImport("user32.dll")]
    public static extern bool GetCursorPos(out POINT lpPoint);

    [DllImport("user32.dll")]
    public static extern bool SetCursorPos(int X, int Y);

    [DllImport("user32.dll")]
    public static extern void mouse_event(uint dwFlags, uint dx, uint dy, int dwData, UIntPtr dwExtraInfo);

    [DllImport("user32.dll")]
    public static extern short GetAsyncKeyState(int vKey);
}
"@

$MOUSEEVENTF_LEFTDOWN = 0x0002
$MOUSEEVENTF_LEFTUP = 0x0004
$MOUSEEVENTF_RIGHTDOWN = 0x0008
$MOUSEEVENTF_RIGHTUP = 0x0010
$MOUSEEVENTF_WHEEL = 0x0800
$VK_CONTROL = 0x11
$VK_MENU = 0x12
$VK_ESCAPE = 0x1B

function Get-ConfigObject {
    param([string]$Path)
    if (!(Test-Path -LiteralPath $Path)) {
        throw "Config file not found: $Path"
    }
    Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
}

function Initialize-Log {
    param($Settings)
    $logPath = $Settings.log_file
    $logDir = Split-Path -Parent $logPath
    if ($logDir) {
        New-Item -ItemType Directory -Force -Path $logDir | Out-Null
    }
}

function Write-ActivityLog {
    param($Settings, [string]$Message)
    $line = "{0} {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Message
    Add-Content -LiteralPath $Settings.log_file -Value $line
    Write-Host $line
}

function Get-CursorPosition {
    $point = New-Object DesktopActivityNative+POINT
    [DesktopActivityNative]::GetCursorPos([ref]$point) | Out-Null
    [pscustomobject]@{ X = $point.X; Y = $point.Y }
}

function Test-KeyDown {
    param([int]$VirtualKey)
    return (([DesktopActivityNative]::GetAsyncKeyState($VirtualKey) -band 0x8000) -ne 0)
}

function Test-StopRequested {
    param($Settings)
    $pos = Get-CursorPosition
    $cornerStop = ($pos.X -le [int]$Settings.fail_safe_corner_px -and $pos.Y -le [int]$Settings.fail_safe_corner_px)
    $hotkeyStop = ((Test-KeyDown $VK_CONTROL) -and (Test-KeyDown $VK_MENU) -and (Test-KeyDown $VK_ESCAPE))
    return ($cornerStop -or $hotkeyStop)
}

function Get-RandomFloat {
    param([double]$Min, [double]$Max)
    return $Min + (Get-Random) / [double][int]::MaxValue * ($Max - $Min)
}

function Get-RandomFromRange {
    param($Range)
    Get-RandomFloat -Min ([double]$Range[0]) -Max ([double]$Range[1])
}

function Get-RandomPoint {
    param($Settings)
    $area = $Settings.safe_area
    [pscustomobject]@{
        X = Get-Random -Minimum ([int]$area.x_min) -Maximum ([int]$area.x_max + 1)
        Y = Get-Random -Minimum ([int]$area.y_min) -Maximum ([int]$area.y_max + 1)
    }
}

function Get-ClampedPoint {
    param($Settings, [int]$X, [int]$Y)
    $area = $Settings.safe_area
    [pscustomobject]@{
        X = [Math]::Min([Math]::Max($X, [int]$area.x_min), [int]$area.x_max)
        Y = [Math]::Min([Math]::Max($Y, [int]$area.y_min), [int]$area.y_max)
    }
}

function Get-SmoothStep {
    param([double]$Value)
    return $Value * $Value * (3 - 2 * $Value)
}

function Move-CursorSmoothly {
    param($Settings, $Target, [double]$DurationSeconds, [bool]$IsDryRun)

    $start = Get-CursorPosition
    $dx = $Target.X - $start.X
    $dy = $Target.Y - $start.Y
    $distance = [Math]::Sqrt($dx * $dx + $dy * $dy)
    $steps = [Math]::Max(12, [Math]::Min(140, [int][Math]::Round($distance / 12)))
    $bend = [Math]::Max(20, $distance * 0.18)

    $c1x = $start.X + $dx * 0.33 + (Get-RandomFloat -Min (-$bend) -Max $bend)
    $c1y = $start.Y + $dy * 0.33 + (Get-RandomFloat -Min (-$bend) -Max $bend)
    $c2x = $start.X + $dx * 0.66 + (Get-RandomFloat -Min (-$bend) -Max $bend)
    $c2y = $start.Y + $dy * 0.66 + (Get-RandomFloat -Min (-$bend) -Max $bend)

    Write-ActivityLog $Settings ("move from=({0},{1}) target=({2},{3}) duration={4:n2}s" -f $start.X, $start.Y, $Target.X, $Target.Y, $DurationSeconds)
    if ($IsDryRun) {
        return
    }

    for ($i = 1; $i -le $steps; $i++) {
        if (Test-StopRequested $Settings) {
            throw "Stopped by Ctrl+Alt+Esc or top-left fail-safe."
        }

        $t = Get-SmoothStep ([double]$i / [double]$steps)
        $inv = 1 - $t
        $x = [int][Math]::Round(($inv * $inv * $inv * $start.X) + (3 * $inv * $inv * $t * $c1x) + (3 * $inv * $t * $t * $c2x) + ($t * $t * $t * $Target.X))
        $y = [int][Math]::Round(($inv * $inv * $inv * $start.Y) + (3 * $inv * $inv * $t * $c1y) + (3 * $inv * $t * $t * $c2y) + ($t * $t * $t * $Target.Y))
        $point = Get-ClampedPoint $Settings $x $y
        [DesktopActivityNative]::SetCursorPos($point.X, $point.Y) | Out-Null
        Start-Sleep -Milliseconds ([int][Math]::Max(5, ($DurationSeconds * 1000 / $steps) * (Get-RandomFloat -Min 0.65 -Max 1.35)))
    }
}

function Invoke-MaybeScroll {
    param($Settings, [bool]$IsDryRun)
    if (!$Settings.enable_scroll) {
        return
    }
    if ((Get-RandomFloat -Min 0 -Max 1) -gt [double]$Settings.scroll_probability) {
        return
    }
    $clicks = Get-Random -InputObject @(-3, -2, -1, 1, 2, 3)
    Write-ActivityLog $Settings ("scroll wheel_clicks={0}" -f $clicks)
    if (!$IsDryRun) {
        [DesktopActivityNative]::mouse_event($MOUSEEVENTF_WHEEL, 0, 0, $clicks * 120, [UIntPtr]::Zero)
    }
}

function Invoke-MaybeClick {
    param($Settings, [bool]$IsDryRun)
    if (!$Settings.enable_clicks) {
        return
    }
    if ((Get-RandomFloat -Min 0 -Max 1) -gt [double]$Settings.click_probability) {
        return
    }

    $rightClick = ((Get-RandomFloat -Min 0 -Max 1) -lt [double]$Settings.right_click_probability)
    Write-ActivityLog $Settings ("click button={0}" -f $(if ($rightClick) { "right" } else { "left" }))
    if ($IsDryRun) {
        return
    }

    if ($rightClick) {
        [DesktopActivityNative]::mouse_event($MOUSEEVENTF_RIGHTDOWN, 0, 0, 0, [UIntPtr]::Zero)
        Start-Sleep -Milliseconds (Get-Random -Minimum 50 -Maximum 180)
        [DesktopActivityNative]::mouse_event($MOUSEEVENTF_RIGHTUP, 0, 0, 0, [UIntPtr]::Zero)
    }
    else {
        [DesktopActivityNative]::mouse_event($MOUSEEVENTF_LEFTDOWN, 0, 0, 0, [UIntPtr]::Zero)
        Start-Sleep -Milliseconds (Get-Random -Minimum 50 -Maximum 180)
        [DesktopActivityNative]::mouse_event($MOUSEEVENTF_LEFTUP, 0, 0, 0, [UIntPtr]::Zero)
    }
}

function Test-WithinActiveWindow {
    param($Settings)
    if ($Settings.run_24h -or !$Settings.active_windows -or $Settings.active_windows.Count -eq 0) {
        return $true
    }

    $now = Get-Date
    $nowText = $now.ToString("HH:mm")
    foreach ($window in $Settings.active_windows) {
        $start = [string]$window.start
        $end = [string]$window.end
        if ($start -le $end -and $nowText -ge $start -and $nowText -le $end) {
            return $true
        }
        if ($start -gt $end -and ($nowText -ge $start -or $nowText -le $end)) {
            return $true
        }
    }
    return $false
}

function Start-InterruptibleSleep {
    param($Settings, [double]$Seconds)
    $deadline = (Get-Date).AddSeconds($Seconds)
    while ((Get-Date) -lt $deadline) {
        if (Test-StopRequested $Settings) {
            throw "Stopped by Ctrl+Alt+Esc or top-left fail-safe."
        }
        Start-Sleep -Milliseconds 200
    }
}

$settings = Get-ConfigObject $Config
Initialize-Log $settings
Write-ActivityLog $settings ("starting desktop activity runner dry_run={0} once={1}" -f [bool]$DryRun, [bool]$Once)
Write-ActivityLog $settings "stop with Ctrl+Alt+Esc, or move the cursor to the top-left corner"

try {
    while ($true) {
        if (!(Test-WithinActiveWindow $settings)) {
            Write-ActivityLog $settings "outside active window; waiting"
            Start-InterruptibleSleep $settings 30
            continue
        }

        $target = Get-RandomPoint $settings
        $duration = Get-RandomFromRange $settings.move_duration_seconds
        Move-CursorSmoothly $settings $target $duration ([bool]$DryRun)
        Invoke-MaybeScroll $settings ([bool]$DryRun)
        Invoke-MaybeClick $settings ([bool]$DryRun)

        if ($Once) {
            break
        }

        $waitSeconds = Get-RandomFromRange $settings.action_interval_seconds
        Write-ActivityLog $settings ("waiting {0:n1}s before next action" -f $waitSeconds)
        Start-InterruptibleSleep $settings $waitSeconds
    }
}
catch {
    Write-ActivityLog $settings $_.Exception.Message
}
