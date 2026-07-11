import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const repoRoot = resolve(new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const defaults = {
  apiBase: "https://desktop-activity-control.kittengigi2025.workers.dev",
  deviceId: "main",
  tokenFile: join(repoRoot, ".scratch", "cloudflare", "activity-api-token.txt"),
  remoteConfigFile: join(repoRoot, ".scratch", "cloudflare", "remote-config.json"),
  localConfigFile: join(repoRoot, "scripts", "desktop_activity_runner.config.json"),
  runnerScript: join(repoRoot, "scripts", "desktop_activity_runner.ps1"),
  logFile: join(repoRoot, ".scratch", "activity-runner", "activity.log"),
  pollSeconds: 30,
};

function argValue(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const options = {
  apiBase: argValue("api-base", defaults.apiBase).replace(/\/$/, ""),
  deviceId: argValue("device-id", defaults.deviceId),
  tokenFile: resolve(argValue("token-file", defaults.tokenFile)),
  remoteConfigFile: resolve(argValue("config-out", defaults.remoteConfigFile)),
  localConfigFile: resolve(argValue("local-config", defaults.localConfigFile)),
  runnerScript: resolve(argValue("runner", defaults.runnerScript)),
  logFile: resolve(argValue("log-file", defaults.logFile)),
  pollSeconds: Number(argValue("poll-seconds", defaults.pollSeconds)),
  once: process.argv.includes("--once"),
  noStart: process.argv.includes("--no-start"),
};

const stateDir = dirname(options.remoteConfigFile);
mkdirSync(stateDir, { recursive: true });

let child = null;
let lastConfigText = "";
let lastAction = "";
let lastStatus = "starting";

function readToken() {
  return readFileSync(options.tokenFile, "utf8").trim();
}

function authHeaders() {
  return {
    authorization: `Bearer ${readToken()}`,
    "content-type": "application/json",
  };
}

async function api(path, init = {}) {
  const response = await fetch(`${options.apiBase}${path}`, {
    ...init,
    headers: {
      ...authHeaders(),
      ...(init.headers || {}),
    },
  });
  const text = await response.text();
  let body = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }
  if (!response.ok) {
    throw new Error(body.error || `HTTP ${response.status}`);
  }
  return body;
}

function normalizeConfig(config) {
  return {
    enabled: true,
    ...config,
  };
}

function isEnabled(config) {
  return config.enabled !== false;
}

function latestLogLine() {
  if (!existsSync(options.logFile)) return "";
  const text = readFileSync(options.logFile, "utf8");
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  return lines.at(-1) || "";
}

function writeConfig(config) {
  const text = `${JSON.stringify(config, null, 2)}\n`;
  writeFileSync(options.remoteConfigFile, text, "utf8");
  return text;
}

function stopRunner() {
  if (!child) return;
  const pid = child.pid;
  child = null;
  spawn("powershell.exe", ["-NoProfile", "-Command", `Stop-Process -Id ${pid} -Force -ErrorAction SilentlyContinue`], {
    windowsHide: true,
    stdio: "ignore",
  });
}

function startRunner() {
  if (child || options.noStart) return;
  child = spawn(
    "powershell.exe",
    [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      options.runnerScript,
      "-Config",
      options.remoteConfigFile,
    ],
    {
      cwd: repoRoot,
      windowsHide: true,
      stdio: "ignore",
    },
  );

  child.on("exit", (code, signal) => {
    if (child) {
      child = null;
      lastStatus = `runner exited code=${code ?? ""} signal=${signal ?? ""}`.trim();
    }
  });
}

async function syncOnce() {
  const payload = await api(`/api/config?device_id=${encodeURIComponent(options.deviceId)}`);
  const config = normalizeConfig(payload.config || {});
  const configText = writeConfig(config);

  if (configText !== lastConfigText) {
    lastConfigText = configText;
    if (child) stopRunner();
  }

  if (isEnabled(config)) {
    lastStatus = child ? "online" : "starting runner";
    startRunner();
  } else {
    lastStatus = "paused";
    stopRunner();
  }

  lastAction = latestLogLine() || lastAction;
  await api("/api/heartbeat", {
    method: "POST",
    body: JSON.stringify({
      device_id: options.deviceId,
      status: lastStatus,
      last_action: lastAction,
      runner_pid: child?.pid || null,
      config_mtime: existsSync(options.remoteConfigFile)
        ? statSync(options.remoteConfigFile).mtime.toISOString()
        : null,
    }),
  });

  return { status: lastStatus, runner_pid: child?.pid || null, enabled: isEnabled(config) };
}

async function main() {
  process.chdir(repoRoot);
  console.log(`Cloudflare bridge started for ${options.deviceId}`);
  console.log(`API: ${options.apiBase}`);
  console.log(`Config: ${options.remoteConfigFile}`);

  while (true) {
    try {
      const result = await syncOnce();
      console.log(`${new Date().toISOString()} ${JSON.stringify(result)}`);
    } catch (error) {
      lastStatus = `bridge error: ${error.message}`;
      console.error(`${new Date().toISOString()} ${lastStatus}`);
    }

    if (options.once) {
      if (options.noStart) stopRunner();
      break;
    }
    await sleep(Math.max(5, options.pollSeconds) * 1000);
  }
}

process.on("SIGINT", () => {
  stopRunner();
  process.exit(0);
});
process.on("SIGTERM", () => {
  stopRunner();
  process.exit(0);
});

main().catch((error) => {
  console.error(error);
  stopRunner();
  process.exit(1);
});
