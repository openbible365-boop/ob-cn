// 圣经译本离线下载：把整本译本（66 卷 JSON）存进 Cache Storage，
// loadBook 优先读缓存——下载后弱网/离线也能读经。
//
// 为什么是 Cache Storage 而不是 localStorage：拼音和合本一个译本就 50MB 上下，
// localStorage 的 5MB 配额装不下；Cache Storage 在浏览器和 Capacitor WebView
// 里都可用，且按 URL 存取，loadBook 不需要改数据格式。
//
// 直接 import manifest 而不是从 scripture.ts 取 BOOKS，避免两个模块互相引用。
import manifest from "./manifest.json";
import { load, save } from "./store";

const CACHE_NAME = "ob-bible-v1";
const META_KEY = "ob.offline-bible";

const BOOK_CODES = (manifest.books as { code: string }[]).map((b) => b.code);

export type OfflineVersionMeta = { books: number; bytes: number; at: string; version?: string };
type Meta = Record<string, OfflineVersionMeta>;

export function offlineSupported() {
  return typeof caches !== "undefined";
}

export function getOfflineMeta(): Meta {
  return load<Meta>(META_KEY, {});
}

function bookUrl(version: string, book: string) {
  return `/data/bible/${version}/${book}.json`;
}

export function readableBytes(value: number) {
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

// ---------- 资源包：译本与注释共用同一套下载/删除 ----------

// 精读本注释按书卷序号存文件（1.json…66.json），与译本的 66 卷一一对应
export const JINGDU_KEY = "jingdu";

function packUrls(key: string): string[] {
  if (key === JINGDU_KEY) {
    return BOOK_CODES.map((_, index) => `/data/commentary/jingdu/${index + 1}.json`);
  }
  return BOOK_CODES.map((code) => bookUrl(key, code));
}

async function downloadPack(
  key: string,
  onProgress: (done: number, total: number) => void,
) {
  const urls = packUrls(key);
  const cache = await caches.open(CACHE_NAME);
  let bytes = 0;
  for (let i = 0; i < urls.length; i++) {
    const res = await fetch(urls[i]);
    if (!res.ok) throw new Error(`下载失败（第 ${i + 1} 卷：HTTP ${res.status}）`);
    // 读成字节再手工构造 Response 存入：既能统计体积，也不依赖原响应流的可重用性
    const buf = await res.arrayBuffer();
    bytes += buf.byteLength;
    await cache.put(urls[i], new Response(buf, { headers: { "Content-Type": "application/json" } }));
    onProgress(i + 1, urls.length);
  }
  const meta = getOfflineMeta();
  meta[key] = { books: urls.length, bytes, at: new Date().toISOString() };
  if (key === JINGDU_KEY) {
    // 记录内容版本：资源管理页据此提示"注释有更新"
    const version = await fetchCommentaryVersion();
    if (version) meta[key].version = version;
  }
  save(META_KEY, meta);
}

/** 服务器上注释数据的当前版本指纹（由 scripts/gen-commentary-version.py 生成）。
    加时间戳查询参数绕开 HTTP 缓存；取不到（离线/旧服务器）返回 null，不提示更新。 */
export async function fetchCommentaryVersion(): Promise<string | null> {
  try {
    const res = await fetch(`/data/commentary/jingdu/version.json?t=${Date.now()}`);
    if (!res.ok) return null;
    const data = (await res.json()) as { version?: unknown };
    return typeof data.version === "string" ? data.version : null;
  } catch {
    return null;
  }
}

/** 已下载的注释是否落后于服务器版本（未下载、离线或无版本记录都返回 false） */
export async function commentaryHasUpdate(): Promise<boolean> {
  const local = getOfflineMeta()[JINGDU_KEY];
  if (!local) return false;
  const remote = await fetchCommentaryVersion();
  // 旧版下载的缓存没有版本记录：有了远端版本就视为可更新一次，补齐记录
  return remote !== null && local.version !== remote;
}

async function removePack(key: string) {
  const cache = await caches.open(CACHE_NAME);
  for (const url of packUrls(key)) {
    await cache.delete(url);
  }
  const meta = getOfflineMeta();
  delete meta[key];
  save(META_KEY, meta);
}

export function downloadVersion(version: string, onProgress: (done: number, total: number) => void) {
  return downloadPack(version, onProgress);
}

export function removeVersion(version: string) {
  return removePack(version);
}

export function downloadCommentary(onProgress: (done: number, total: number) => void) {
  return downloadPack(JINGDU_KEY, onProgress);
}

export function removeCommentary() {
  return removePack(JINGDU_KEY);
}

/** loadBook / loadJingdu 的离线优先入口：命中缓存返回 Response，未命中或不支持返回 null */
export async function cachedResponse(url: string): Promise<Response | null> {
  if (!offlineSupported()) return null;
  try {
    return (await caches.match(url)) ?? null;
  } catch {
    return null;
  }
}
