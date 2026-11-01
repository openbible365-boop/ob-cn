import { apiRequest } from "./api";
import { getReading, getReadingUpdatedAt, setReading } from "./scripture";

// 阅读位置跨设备同步：
// - 翻章/滚动记书签时防抖上报（未登录 401 静默忽略，不打扰阅读）；
// - 启动与登录后拉取一次，服务器版本更新时静默覆盖本地，
//   下次打开圣经页就续上在另一台设备读到的地方。

type ServerPosition = { version: string; book: string; chapter: number; verse?: number };
type PullResponse = { ok: boolean; position: ServerPosition | null; updatedAt: string | null };

const PUSH_DEBOUNCE_MS = 4000;
let pushTimer: number | null = null;

export function schedulePushReadingPosition() {
  if (pushTimer) window.clearTimeout(pushTimer);
  pushTimer = window.setTimeout(() => {
    pushTimer = null;
    const reading = getReading();
    void apiRequest("/api/mobile/reading-position", {
      method: "PUT",
      body: reading,
    }).catch(() => { /* 离线或未登录都静默，书签永远先保本机 */ });
  }, PUSH_DEBOUNCE_MS);
}

export async function pullReadingPosition(): Promise<void> {
  try {
    const response = await apiRequest<PullResponse>("/api/mobile/reading-position", { method: "GET" });
    if (!response.ok || !response.data?.ok) return;
    const { position, updatedAt } = response.data;
    if (!position || !updatedAt) return;
    const serverAt = new Date(updatedAt).getTime();
    if (!Number.isFinite(serverAt) || serverAt <= getReadingUpdatedAt()) return;
    setReading(position);
  } catch {
    /* 拉不到就用本机书签 */
  }
}
