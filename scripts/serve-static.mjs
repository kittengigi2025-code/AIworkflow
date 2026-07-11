import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize, resolve, sep } from "node:path";
import { createServer } from "node:http";

const root = resolve(process.argv[2] ?? ".");
const port = Number(process.argv[3] ?? 8766);
const host = process.argv[4] ?? "127.0.0.1";

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".zip": "application/zip",
};

function resolveRequestPath(url) {
  const decodedPath = decodeURIComponent(new URL(url, "http://localhost").pathname);
  const relativePath = normalize(decodedPath).replace(/^([/\\])+/, "");
  let target = resolve(join(root, relativePath));

  if (target !== root && !target.startsWith(root + sep)) {
    return null;
  }

  if (existsSync(target) && statSync(target).isDirectory()) {
    target = join(target, "index.html");
  }

  return target;
}

createServer((req, res) => {
  const target = resolveRequestPath(req.url ?? "/");

  if (!target || !existsSync(target) || !statSync(target).isFile()) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }

  res.writeHead(200, {
    "content-type": mimeTypes[extname(target).toLowerCase()] ?? "application/octet-stream",
    "cache-control": "no-store",
  });
  createReadStream(target).pipe(res);
}).listen(port, host, () => {
  console.log(`Serving ${root} at http://${host}:${port}/`);
});
