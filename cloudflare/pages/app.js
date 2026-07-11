const DEFAULT_CONFIG = {
  enabled: true,
  run_24h: true,
  active_windows: [{ start: "09:00", end: "18:00" }],
  action_interval_seconds: [45, 180],
  move_duration_seconds: [0.6, 2.8],
  safe_area: {
    x_min: 200,
    y_min: 150,
    x_max: 1600,
    y_max: 900,
  },
  fail_safe_corner_px: 8,
  enable_scroll: true,
  scroll_probability: 0.25,
  enable_clicks: false,
  click_probability: 0,
  right_click_probability: 0,
  enable_drags: false,
  drag_probability: 0,
  log_file: ".scratch/activity-runner/activity.log",
};

const DEFAULT_API_BASE = "https://desktop-activity-control.kittengigi2025.workers.dev";

const elements = {
  apiBase: document.querySelector("#apiBase"),
  apiToken: document.querySelector("#apiToken"),
  deviceId: document.querySelector("#deviceId"),
  saveSettings: document.querySelector("#saveSettings"),
  refreshState: document.querySelector("#refreshState"),
  loadConfig: document.querySelector("#loadConfig"),
  saveConfig: document.querySelector("#saveConfig"),
  clearLog: document.querySelector("#clearLog"),
  configEditor: document.querySelector("#configEditor"),
  log: document.querySelector("#log"),
  connectionStatus: document.querySelector("#connectionStatus"),
  stateDevice: document.querySelector("#stateDevice"),
  stateHeartbeat: document.querySelector("#stateHeartbeat"),
  stateMode: document.querySelector("#stateMode"),
  stateAction: document.querySelector("#stateAction"),
};

function appendLog(message) {
  const line = `${new Date().toLocaleTimeString()} ${message}`;
  elements.log.textContent = `${line}\n${elements.log.textContent}`.slice(0, 6000);
}

function getSettings() {
  return {
    apiBase: elements.apiBase.value.trim().replace(/\/$/, ""),
    token: elements.apiToken.value.trim(),
    deviceId: elements.deviceId.value.trim() || "main",
  };
}

function saveSettings() {
  localStorage.setItem("activity-control-settings", JSON.stringify(getSettings()));
  appendLog("settings saved");
}

function loadSettings() {
  const raw = localStorage.getItem("activity-control-settings");
  if (!raw) {
    elements.apiBase.value = DEFAULT_API_BASE;
    elements.configEditor.value = JSON.stringify(DEFAULT_CONFIG, null, 2);
    return;
  }
  const settings = JSON.parse(raw);
  elements.apiBase.value = settings.apiBase || "";
  elements.apiToken.value = settings.token || "";
  elements.deviceId.value = settings.deviceId || "main";
  elements.configEditor.value = JSON.stringify(DEFAULT_CONFIG, null, 2);
}

async function api(path, options = {}) {
  const settings = getSettings();
  if (!settings.apiBase || !settings.token) {
    throw new Error("请先填写 Worker API 和 API Token");
  }

  const response = await fetch(`${settings.apiBase}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${settings.token}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `HTTP ${response.status}`);
  }
  return payload;
}

async function refreshState() {
  const settings = getSettings();
  const payload = await api(`/api/state?device_id=${encodeURIComponent(settings.deviceId)}`);
  const state = payload.state || {};
  elements.stateDevice.textContent = state.device_id || settings.deviceId;
  elements.stateHeartbeat.textContent = state.last_seen || "-";
  elements.stateMode.textContent = state.status || "-";
  elements.stateAction.textContent = state.last_action || "-";
  elements.connectionStatus.textContent = state.last_seen ? "已连接" : "未连接";
  elements.connectionStatus.classList.toggle("online", Boolean(state.last_seen));
  appendLog("state refreshed");
}

async function loadConfig() {
  const settings = getSettings();
  const payload = await api(`/api/config?device_id=${encodeURIComponent(settings.deviceId)}`);
  elements.configEditor.value = JSON.stringify(payload.config || DEFAULT_CONFIG, null, 2);
  appendLog("config loaded");
}

async function saveConfig() {
  const settings = getSettings();
  const config = JSON.parse(elements.configEditor.value);
  await api(`/api/config?device_id=${encodeURIComponent(settings.deviceId)}`, {
    method: "PUT",
    body: JSON.stringify({ config }),
  });
  appendLog("config saved");
}

function bind(id, fn) {
  elements[id].addEventListener("click", async () => {
    try {
      await fn();
    } catch (error) {
      appendLog(`error: ${error.message}`);
    }
  });
}

loadSettings();
bind("saveSettings", saveSettings);
bind("refreshState", refreshState);
bind("loadConfig", loadConfig);
bind("saveConfig", saveConfig);
bind("clearLog", () => {
  elements.log.textContent = "";
});
