// Real account session backed by the OpenBible backend. The static site
// serves /api/* by proxying to the admin app (nginx in production, the vite
// dev proxy locally), so the httpOnly session cookie is first-party here.
import { load, save } from "./store";
import { clearHighlightsForLogout } from "./annotations";
import { apiRequest } from "./api";
import { clearGoogleCredentialState } from "./google-auth";

export type SessionUser = {
  id: string;
  name: string;
  email: string | null;
  avatarColor: string;
  avatarUrl: string | null;
};

type ApiResult = { ok: boolean; message: string; user?: SessionUser };

async function post(path: string, body?: unknown): Promise<ApiResult> {
  try {
    const response = await apiRequest<ApiResult>(path, {
      method: "POST",
      body,
    });
    return (
      response.data ?? {
        ok: false,
        message: `服务器返回异常（${response.status}）`,
      }
    );
  } catch {
    return { ok: false, message: "网络错误，请稍后重试" };
  }
}

export function sendLoginCode(email: string) {
  return post("/api/mobile/auth/send-code", { email });
}

export function verifyLoginCode(email: string, code: string) {
  return post("/api/mobile/auth/verify", { email, code });
}

export function verifyGoogleLogin(idToken: string) {
  return post("/api/mobile/auth/google", { idToken });
}

export async function logout() {
  const result = await post("/api/mobile/auth/logout");
  if (result.ok) {
    clearHighlightsForLogout();
    await clearGoogleCredentialState().catch(() => {});
  }
  return result;
}

export async function fetchMe(): Promise<SessionUser | null> {
  try {
    const response = await apiRequest<ApiResult>("/api/mobile/me");
    if (!response.ok) return null;
    return response.data?.user ?? null;
  } catch {
    return null;
  }
}

// ---------- notification preferences (still device-local) ----------

const PREFS_KEY = "ob.notificationPrefs";

export const NOTIFICATION_PREFS = [
  { key: "daily_verse", title: "每日金句推送", desc: "每天早上 7:30 推送一节经文", defaultEnabled: false },
  { key: "event_reminder", title: "社群活动提醒", desc: "已报名活动开始前 2 小时提醒", defaultEnabled: true },
  { key: "reply", title: "留言回复通知", desc: "我的帖子收到评论或回复时", defaultEnabled: true },
  { key: "ai_assistant", title: "AI 助理相关通知", desc: "社群 AI 助理的公开问答动态", defaultEnabled: false },
] as const;

export function getPrefs(): Record<string, boolean> {
  const overrides = load<Record<string, boolean>>(PREFS_KEY, {});
  const merged: Record<string, boolean> = {};
  for (const p of NOTIFICATION_PREFS) {
    merged[p.key] = overrides[p.key] ?? p.defaultEnabled;
  }
  return merged;
}

export function togglePref(key: string) {
  const current = getPrefs();
  save(PREFS_KEY, { ...load<Record<string, boolean>>(PREFS_KEY, {}), [key]: !current[key] });
}
