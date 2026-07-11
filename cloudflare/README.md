# Cloudflare Control Plane

This folder contains a Cloudflare-ready control plane for the local desktop
activity runner.

It has two parts:

- `pages/`: a static Cloudflare Pages dashboard.
- `worker/`: a Cloudflare Worker API that stores state in Workers KV.

The Windows machine still runs the local agent. Cloudflare only provides a
remote dashboard, config storage, and heartbeat/status API.

## API

All write/read API requests require:

```text
Authorization: Bearer <ACTIVITY_API_TOKEN>
```

Current deployment:

- Pages dashboard: `https://desktop-activity-control.pages.dev`
- Worker API: `https://desktop-activity-control.kittengigi2025.workers.dev`
- Local API token file: `.scratch/cloudflare/activity-api-token.txt`

Endpoints:

- `GET /api/state?device_id=main`
- `POST /api/heartbeat`
- `GET /api/config?device_id=main`
- `PUT /api/config?device_id=main`

## Deploy Worker

Install Wrangler and log in:

```powershell
npm install
npx wrangler login
```

Create KV namespace:

```powershell
npx wrangler kv namespace create ACTIVITY_KV --config cloudflare/worker/wrangler.toml
```

Copy the returned namespace id into `cloudflare/worker/wrangler.toml`.

Set the API token secret:

```powershell
npx wrangler secret put ACTIVITY_API_TOKEN --config cloudflare/worker/wrangler.toml
```

Deploy:

```powershell
npx wrangler deploy --config cloudflare/worker/wrangler.toml
```

Or run the helper after `npx wrangler login`:

```powershell
.\scripts\deploy_cloudflare_control.ps1
```

## Deploy Pages

The static dashboard is in `cloudflare/pages`.

In Cloudflare Pages:

- Build command: leave empty
- Build output directory: `cloudflare/pages`

After the Worker is deployed, edit `cloudflare/pages/app.js` and set
`API_BASE` to the Worker URL.

## Local Agent Integration

The current local runner can keep running without Cloudflare. To connect it to
Cloudflare, run the bridge that periodically:

1. sends heartbeat/status to `/api/heartbeat`;
2. reads `/api/config`;
3. writes the fetched config into `.scratch/cloudflare/remote-config.json`;
4. starts, stops, or restarts the local agent when config changes.

```powershell
node .\scripts\cloudflare_activity_bridge.mjs
```

The Windows scheduled task starts this bridge through
`scripts/start_desktop_activity_runner.ps1`.
