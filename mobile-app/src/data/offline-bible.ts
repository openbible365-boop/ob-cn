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
  const folder = version === "pinyin" ? "pinyin2" : version;
  return `/data/bible/${folder}/${book}.json`;
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
    // reload：绕过 HTTP 缓存，数据修订后重新下载拿到的一定是新文件
    const res = await fetch(urls[i], { cache: "reload" });
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

// 注释随应用内置（App 内 /data/ 读的是安装包资产），没有"下载/删除"概念；
// 版本记录独立存储：首次见到远端版本时记为基线，之后远端变化才提醒更新。
const COMMENTARY_VERSION_KEY = "ob.commentary.version";

/** 注释内容是否有新版。离线/取不到版本文件返回 false，不打扰。 */
export async function commentaryHasUpdate(): Promise<boolean> {
  const remote = await fetchCommentaryVersion();
  if (remote === null) return false;
  const local = load<string | null>(COMMENTARY_VERSION_KEY, null);
  if (local === null) {
    save(COMMENTARY_VERSION_KEY, remote); // 首次：记基线，不提醒
    return false;
  }
  return local !== remote;
}

/** 更新完成后记录新版本，消除提醒 */
export async function markCommentaryUpdated() {
  const remote = await fetchCommentaryVersion();
  if (remote) save(COMMENTARY_VERSION_KEY, remote);
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

// 经文数据修订记录：译本代码 → 修订日期。本机离线包早于这个日期就在后台静默重新下载，
// 否则已下载的用户会一直读到缓存里的旧数据。
//   kjv 2026-11-07：修复约 6,700 处粘连空格（"theLordis" → "the LORD is"），LORD/GOD 还原大写
const DATA_REVISIONS: Record<string, string> = {
  kjv: "2026-11-07T00:00:00.000Z",
  //   cnvs：按和合本补齐小标题 / 诗体 / 段落结构，修复合并节编号，清理残留空格
  cnvs: "2026-11-07T02:59:00.000Z",
};

/** App 启动时调用：有修订且本机离线包过旧的译本，在后台重新下载（失败下次再试） */
export async function refreshStaleOfflinePacks() {
  if (!offlineSupported()) return;
  const meta = getOfflineMeta();
  for (const [key, revisedAt] of Object.entries(DATA_REVISIONS)) {
    const pack = meta[key];
    if (!pack || pack.at >= revisedAt) continue;
    try {
      await downloadPack(key, () => {});
    } catch {
      // 离线或下载中断：保留旧包可读，下次启动再试
    }
  }
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
