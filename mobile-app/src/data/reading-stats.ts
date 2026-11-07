// 阅读统计：读经、读注释各自按「章」计数，上报给后台「阅读统计」页。
// - 停留满 8 秒才算读过这一章（快速翻页不计）；
// - 同一章每天只记一次（本机去重，服务器再兜底）；
// - 先进本机队列，空闲时批量上传；离线读的联网后补传，时间按实际阅读时间。
// 只记「哪一章被读了」，不记任何阅读内容。未登录用随机设备 id 计人数。
import { Capacitor } from "@capacitor/core";
import { apiRequest } from "./api";
import { load, save, uid } from "./store";

export type ReadKind = "bible" | "commentary";
type QueuedEvent = { kind: ReadKind; version?: string; book: string; chapter: number; at: string };

const DEVICE_KEY = "ob.deviceId";
const QUEUE_KEY = "ob.readStats.queue";
const SEEN_KEY = "ob.readStats.seen";
const MIN_READ_MS = 8000;
const FLUSH_DELAY_MS = 15000;
const MAX_QUEUE = 300;

let flushTimer: number | null = null;
let flushing = false;

function deviceId(): string {
  let id = load<string>(DEVICE_KEY, "");
  if (!/^[a-zA-Z0-9_-]{8,64}$/.test(id)) {
    id = `${uid()}${uid()}`.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32).padEnd(12, "0");
    save(DEVICE_KEY, id);
  }
  return id;
}

function localDay(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function record(event: Omit<QueuedEvent, "at">) {
  const today = localDay();
  const key = `${event.kind}|${event.version ?? ""}|${event.book}|${event.chapter}`;
  const seen = load<{ day: string; keys: string[] }>(SEEN_KEY, { day: today, keys: [] });
  const keys = seen.day === today ? seen.keys : [];
  if (keys.includes(key)) return;
  save(SEEN_KEY, { day: today, keys: [...keys, key].slice(-500) });
  const queue = load<QueuedEvent[]>(QUEUE_KEY, []);
  save(QUEUE_KEY, [...queue, { ...event, at: new Date().toISOString() }].slice(-MAX_QUEUE));
  scheduleReadStatsFlush();
}

/**
 * 开始计时：停留满 8 秒（且页面在前台）记一次。返回取消函数，翻章/离开页面时调用。
 * 用法：在章节内容加载完成的 effect 里调用，并把返回值作为 cleanup。
 */
export function startReadTimer(event: Omit<QueuedEvent, "at">): () => void {
  if (typeof window === "undefined") return () => {};
  const timer = window.setTimeout(() => {
    if (document.visibilityState === "visible") record(event);
  }, MIN_READ_MS);
  return () => window.clearTimeout(timer);
}

export function scheduleReadStatsFlush(delay = FLUSH_DELAY_MS) {
  if (typeof window === "undefined") return;
  if (flushTimer) window.clearTimeout(flushTimer);
  flushTimer = window.setTimeout(() => {
    flushTimer = null;
    void flushReadStats();
  }, delay);
}

export async function flushReadStats(): Promise<void> {
  if (flushing) return;
  const queue = load<QueuedEvent[]>(QUEUE_KEY, []);
  if (queue.length === 0) return;
  flushing = true;
  const batch = queue.slice(0, 100);
  try {
    const native = Capacitor.getPlatform();
    const response = await apiRequest<{ ok?: boolean }>("/api/mobile/reading-stats", {
      method: "POST",
      body: { deviceId: deviceId(), platform: native === "ios" || native === "android" ? native : "web", events: batch },
    });
    // 成功或数据被判无效（4xx）都出队，避免坏数据卡住队列；网络失败（抛错）则保留下次再传
    if (response.ok || (response.status >= 400 && response.status < 500)) {
      const sent = new Set(batch.map((event) => `${event.at}|${event.kind}|${event.book}|${event.chapter}`));
      const rest = load<QueuedEvent[]>(QUEUE_KEY, []).filter(
        (event) => !sent.has(`${event.at}|${event.kind}|${event.book}|${event.chapter}`),
      );
      save(QUEUE_KEY, rest);
      if (rest.length) scheduleReadStatsFlush(2000);
    }
  } catch {
    // 离线：留在队列里，下次启动或下次阅读时再传
  } finally {
    flushing = false;
  }
}

/** App 启动时调用：补传上次没传完的，并在切到后台时顺手上传 */
export function initReadStats() {
  void flushReadStats();
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") void flushReadStats();
    });
  }
}
