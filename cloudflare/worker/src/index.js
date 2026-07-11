const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,PUT,OPTIONS",
  "access-control-allow-headers": "authorization,content-type",
};

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

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: JSON_HEADERS,
  });
}

function getDeviceId(url) {
  return url.searchParams.get("device_id") || "main";
}

function requireAuth(request, env) {
  const expected = env.ACTIVITY_API_TOKEN;
  const header = request.headers.get("authorization") || "";
  if (!expected) return false;
  return header === `Bearer ${expected}`;
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

async function handleState(request, env, url) {
  const deviceId = getDeviceId(url);
  const state = await env.ACTIVITY_KV.get(`state:${deviceId}`, "json");
  return json({ ok: true, state: state || { device_id: deviceId, status: "unknown" } });
}

async function handleHeartbeat(request, env) {
  const body = await readJson(request);
  const deviceId = body.device_id || "main";
  const previous = await env.ACTIVITY_KV.get(`state:${deviceId}`, "json");
  const state = {
    ...(previous || {}),
    ...body,
    device_id: deviceId,
    status: body.status || "online",
    last_seen: new Date().toISOString(),
  };
  await env.ACTIVITY_KV.put(`state:${deviceId}`, JSON.stringify(state));
  return json({ ok: true, state });
}

async function handleGetConfig(env, url) {
  const deviceId = getDeviceId(url);
  const config = await env.ACTIVITY_KV.get(`config:${deviceId}`, "json");
  return json({ ok: true, device_id: deviceId, config: config || DEFAULT_CONFIG });
}

async function handlePutConfig(request, env, url) {
  const deviceId = getDeviceId(url);
  const body = await readJson(request);
  if (!body.config || typeof body.config !== "object") {
    return json({ ok: false, error: "config object is required" }, 400);
  }
  await env.ACTIVITY_KV.put(`config:${deviceId}`, JSON.stringify(body.config));
  return json({ ok: true, device_id: deviceId, config: body.config });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: JSON_HEADERS });
    if (!requireAuth(request, env)) return json({ ok: false, error: "unauthorized" }, 401);

    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/api/state") {
      return handleState(request, env, url);
    }
    if (request.method === "POST" && url.pathname === "/api/heartbeat") {
      return handleHeartbeat(request, env);
    }
    if (request.method === "GET" && url.pathname === "/api/config") {
      return handleGetConfig(env, url);
    }
    if (request.method === "PUT" && url.pathname === "/api/config") {
      return handlePutConfig(request, env, url);
    }

    return json({ ok: false, error: "not found" }, 404);
  },
};
