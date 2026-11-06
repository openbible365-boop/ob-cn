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
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ROOT = path.join(REPO, "web-app");
// 线上网页版容器把仓库根目录 data/ 挂在 /data（docker-compose: ../data:/data），
// 注释（data/commentary/jingdu/*.json）等静态数据从这里取
const DATA_ROOT = path.join(REPO, "data");

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
  ".apk": "application/vnd.android.package-archive",
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
  const isData = urlPath.startsWith("/data/");
  // 安装包目录（线上由 App 端 nginx 提供 /downloads/）
  const isDownload = urlPath.startsWith("/downloads/");
  const base = isData ? DATA_ROOT : isDownload ? path.join(REPO, "downloads") : ROOT;
  const rel = isData ? urlPath.slice("/data".length) : isDownload ? urlPath.slice("/downloads".length) : urlPath;
  let filePath = path.normalize(path.join(base, rel));
  if (!filePath.startsWith(base)) {
    res.writeHead(403).end();
    return;
  }
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, "index.html");
  }
  if (!fs.existsSync(filePath)) {
    // 带扩展名的资源（json/js/图片…）找不到就是 404——不能回退成 index.html，
    // 否则调用方拿到 200 + 网页，JSON 解析失败却查不出原因
    if (isData || isDownload || path.extname(urlPath)) {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" }).end("Not found");
      return;
    }
    // 网页版是单页应用：无扩展名的未知路径回退 index.html（与线上一致）
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
