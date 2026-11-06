#!/usr/bin/env node
// 网页版本地开发服务器：与线上 deploy/app-nginx.conf 行为一致——
//   · 静态托管 web-app/
//   · /api/* 原样转发到 admin-app（默认 http://127.0.0.1:3000），保持同源，
//     会话 Cookie、登录、慧读流式输出（NDJSON）都能正常工作
// 用法：node scripts/web-dev-server.mjs [端口，默认 5300]
// 背景：网页版大量接口用相对路径（/api/mobile/*、/api/web/*），用普通静态服务器
//       预览时端口不同、请求被跨域拦截，经文、登录、同步等全部失败。
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PORT = Number(process.argv[2] || process.env.PORT || 5300);
const API_ORIGIN = new URL(process.env.API_ORIGIN || "http://127.0.0.1:3000");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../web-app");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".pdf": "application/pdf",
};

function proxyApi(req, res) {
  const upstream = http.request(
    {
      hostname: API_ORIGIN.hostname,
      port: API_ORIGIN.port,
      path: req.url,
      method: req.method,
      headers: {
        ...req.headers,
        host: `${API_ORIGIN.hostname}:${API_ORIGIN.port}`,
        "x-forwarded-for": req.socket.remoteAddress || "",
        "x-forwarded-host": req.headers.host || "",
      },
    },
    (upstreamRes) => {
      res.writeHead(upstreamRes.statusCode || 502, upstreamRes.headers);
      upstreamRes.pipe(res); // 逐块转发，不缓冲（慧读 NDJSON 流式）
    },
  );
  upstream.on("error", () => {
    if (!res.headersSent) {
      res.writeHead(502, { "content-type": "application/json; charset=utf-8" });
    }
    res.end(JSON.stringify({ ok: false, message: `后台服务未启动（${API_ORIGIN.origin}）` }));
  });
  req.pipe(upstream);
}

function serveStatic(req, res) {
  const urlPath = decodeURIComponent(new URL(req.url, "http://x").pathname);
  let filePath = path.normalize(path.join(ROOT, urlPath));
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403).end();
    return;
  }
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, "index.html");
  }
  if (!fs.existsSync(filePath)) {
    // 网页版是单页应用：未知路径回退 index.html（与线上 try_files 一致）
    filePath = path.join(ROOT, "index.html");
  }
  res.writeHead(200, {
    "content-type": MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream",
    "cache-control": "no-cache",
  });
  fs.createReadStream(filePath).pipe(res);
}

http
  .createServer((req, res) => {
    if (req.url?.startsWith("/api/")) proxyApi(req, res);
    else serveStatic(req, res);
  })
  .listen(PORT, () => {
    console.log(`网页版开发服务器：http://localhost:${PORT}  （/api → ${API_ORIGIN.origin}）`);
  });
