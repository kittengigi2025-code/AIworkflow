# Desktop Activity Runner

本工具用于本机防休眠、演示巡检或内部 UI 自测辅助。默认只做安全区域内的鼠标移动和少量滚动，不点击、不拖拽。

## 运行

推荐使用 PowerShell 版本，不需要 Python 环境。先做一次不实际移动鼠标的检查：

```powershell
.\scripts\desktop_activity_runner.ps1 -DryRun -Once
```

执行一次动作：

```powershell
.\scripts\desktop_activity_runner.ps1 -Once
```

持续运行：

```powershell
.\scripts\desktop_activity_runner.ps1
```

更明显的演示模式，每 `2-5` 秒动作一次：

```powershell
.\scripts\desktop_activity_runner.ps1 -Config .\scripts\desktop_activity_runner.demo.json
```

## 安全停止

- 按 `Ctrl+Alt+Esc` 停止。
- 把鼠标移动到屏幕左上角也会停止。
- 运行前请先调整 `scripts/desktop_activity_runner.config.json` 的 `safe_area`，确保不会点到支付、删除、提交、生产后台等敏感位置。

## 配置说明

- `run_24h`: `true` 表示全天允许运行；`false` 时按 `active_windows` 控制时间段。
- `action_interval_seconds`: 每次动作之间的随机等待区间。
- `move_duration_seconds`: 每次移动耗时区间。
- `safe_area`: 鼠标允许活动的屏幕区域。
- `enable_clicks`: 默认关闭；只有内部演示或测试需要时才打开。
- `enable_drags`: 默认关闭；只有明确需要拖拽测试时才打开。
- `log_file`: 运行日志位置。

默认每次动作后会等待 `45-180` 秒。持续运行时如果窗口没有新输出，通常是在等待下一次动作。
