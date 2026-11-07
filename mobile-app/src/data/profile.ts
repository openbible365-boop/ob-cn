// Real account session backed by the OpenBible backend. The static site
// serves /api/* by proxying to the admin app (nginx in production, the vite
// dev proxy locally), so the httpOnly session cookie is first-party here.
import { load, save } from "./store";
import {
  clearAnnotationsForLogout,
  hasPendingAnnotationSync,
  syncHighlights,
  syncNotes,
} from "./annotations";
import {
  clearConversationsForLogout,
  hasPendingConversationSync,
  syncConversations,
} from "./huidu";
import { apiRequest } from "./api";
import { clearGoogleCredentialState } from "./google-auth";
import { fetchCommunityGroups } from "./community";
import { clearPrayersForLogout } from "./prayers";
import { clearStreakForLogout } from "./streak";
import {
  clearCommunityWorkspaceCache,
  fetchCommunityWorkspace,
} from "./community-workspace";

export type SessionUser = {
  id: string;
  name: string;
  email: string | null;
  avatarColor: string;
  avatarUrl: string | null;
  tier: "BASIC_FREE" | "MID" | "HIGH";
  tierPriceCents: number;
  accountType: "PERSONAL";
  authProviders: Array<"EMAIL" | "GOOGLE" | "APPLE">;
  entitlements: {
    label: string;
    savedItems: number | null;
    aiDailyTokenLimit: number | null;
  };
  counts: {
    highlights: number;
    notes: number;
    conversations: number;
    eventSignups: number;
  };
  groupAccounts: Array<{
    id: string;
    name: string;
    abbreviation: string;
    avatarColor: string;
    role: "OWNER" | "ADMIN";
    tier: "BASIC_FREE" | "MID" | "HIGH";
    entitlements: {
      label: string;
      priceMonthlyCents: number;
      memberLimit: number | null;
      groupLimit: number | null;
      resourceLimit: number | null;
      aiDailyTokenLimit: number | null;
    };
    usage: { members: number; groups: number; resources: number };
  }>;
};

type ApiResult = { ok: boolean; message: string; user?: SessionUser };

export const PROFILE_CHANGED_EVENT = "ob:profile-changed";

export function announceProfileChanged(user: SessionUser) {
  window.dispatchEvent(new CustomEvent<SessionUser>(PROFILE_CHANGED_EVENT, { detail: user }));
}

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

export async function verifyLoginCode(email: string, code: string) {
  const result = await post("/api/mobile/auth/verify", { email, code });
  if (result.ok) clearCommunityWorkspaceCache();
  return result;
}

/**
 * 账号密码登录（仅限后台开通了密码的账号）
 * @param account 用户名或邮箱
 * @param password 密码
 * @returns 登录结果
 */
export async function verifyPasswordLogin(account: string, password: string) {
  const result = await post("/api/mobile/auth/password", { account, password });
  if (result.ok) clearCommunityWorkspaceCache();
  return result;
}

export async function verifyGoogleLogin(idToken: string) {
  const result = await post("/api/mobile/auth/google", { idToken });
  if (result.ok) clearCommunityWorkspaceCache();
  return result;
}

export async function verifyAppleLogin(credential: {
  identityToken: string;
  authorizationCode: string;
  nonce: string;
  givenName?: string;
  familyName?: string;
}) {
  const result = await post("/api/mobile/auth/apple", credential);
  if (result.ok) clearCommunityWorkspaceCache();
  return result;
}

// 高亮、笔记、慧读记录与云端双向同步一次：把本机改动传上去，并取回账号里已有的记录。
// 登录后立刻调用——以前登录只同步了高亮，笔记和慧读记录要重启 App 才回来，
// 看起来就像「退出再登录，记录全没了」。
export async function syncPersonalData(): Promise<boolean> {
  const results = await Promise.all([syncHighlights(), syncNotes(), syncConversations()]);
  // 同步途中又产生的新改动（或排在进行中的那次同步之后）再补一轮
  if (hasPendingAnnotationSync() || hasPendingConversationSync()) {
    const retry = await Promise.all([syncHighlights(), syncNotes(), syncConversations()]);
    return retry.every(Boolean) && !hasPendingAnnotationSync() && !hasPendingConversationSync();
  }
  return results.every(Boolean);
}

export async function logout() {
  // 退出会清空本机记录：先把还没传到云端的改动传完。传不上去（离线等）就不退出，
  // 否则这部分记录会永久丢失
  if (hasPendingAnnotationSync() || hasPendingConversationSync()) {
    await syncPersonalData();
    if (hasPendingAnnotationSync() || hasPendingConversationSync()) {
      return { ok: false, message: "还有记录没同步到云端，请联网后再退出登录" };
    }
  }
  const result = await post("/api/mobile/auth/logout");
  if (result.ok) {
    await clearSessionLocalData();
  }
  return result;
}

async function clearSessionLocalData() {
  clearAnnotationsForLogout();
  clearConversationsForLogout();
  clearCommunityWorkspaceCache();
  await clearGoogleCredentialState().catch(() => {});
}

async function clearAccountLocalData() {
  await clearSessionLocalData();
  clearPrayersForLogout();
  clearStreakForLogout();
}

export async function deleteAccount(appleAuthorizationCode?: string) {
  try {
    const response = await apiRequest<ApiResult>("/api/mobile/me", {
      method: "DELETE",
      body: {
        confirmation: "DELETE",
        ...(appleAuthorizationCode ? { appleAuthorizationCode } : {}),
      },
      readTimeout: 60_000,
    });
    const result = response.data ?? {
      ok: false,
      message: `服务器返回异常（${response.status}）`,
    };
    if (response.ok && result.ok) await clearAccountLocalData();
    return result;
  } catch {
    return { ok: false, message: "网络错误，请稍后重试" };
  }
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

export type LoginState = "signed-in" | "signed-out" | "unknown";

/**
 * 检查当前是否已登录
 * NOTE: 与 fetchMe 不同，这里区分「服务端明确返回 401」与「网络异常」：
 * 网络不通时返回 unknown，调用方不应据此误判为未登录而弹出登录提示。
 * @returns 登录状态
 */
export async function checkLoginState(): Promise<LoginState> {
  try {
    const response = await apiRequest<ApiResult>("/api/mobile/me");
    if (response.status === 401) return "signed-out";
    if (response.ok && response.data?.user) return "signed-in";
    return "unknown";
  } catch {
    return "unknown";
  }
}

export async function updateAvatar(avatarUrl: string) {
  try {
    const response = await apiRequest<{
      ok: boolean;
      message?: string;
      avatarUrl?: string;
    }>("/api/mobile/me", {
      method: "PATCH",
      body: { avatarUrl },
      readTimeout: 30_000,
    });
    if (!response.ok || !response.data?.ok) {
      return {
        ok: false as const,
        message: response.data?.message ?? `服务器返回异常（${response.status}）`,
      };
    }
    return {
      ok: true as const,
      message: response.data.message ?? "头像已更新",
      avatarUrl: response.data.avatarUrl ?? avatarUrl,
    };
  } catch {
    return { ok: false as const, message: "网络错误，请稍后重试" };
  }
}

export type MyActivity = {
  signupId: string;
  signedUpAt: string;
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  startAt: string;
  endAt: string | null;
  community: {
    id: string;
    name: string;
    abbreviation: string;
    avatarColor: string;
  };
};

export async function fetchMyActivities(): Promise<
  | { ok: true; activities: MyActivity[] }
  | { ok: false; message: string }
> {
  try {
    const response = await apiRequest<{
      ok: boolean;
      message?: string;
      activities?: MyActivity[];
    }>("/api/mobile/me/events");
    if (!response.ok || !response.data?.ok || !response.data.activities) {
      const directory = await fetchCommunityGroups();
      if (!directory.ok) {
        return {
          ok: false,
          message:
            response.data?.message ?? `服务器返回异常（${response.status}）`,
        };
      }
      const joinedGroups = directory.groups.filter(
        (group) => group.id === "official" || Boolean(group.membershipRole),
      );
      const workspaces = await Promise.all(
        joinedGroups.map((group) => fetchCommunityWorkspace(group.id)),
      );
      const activities = workspaces.flatMap((result): MyActivity[] => {
        if (!result.ok) return [];
        return result.workspace.events
          .filter((event) => event.signedUpByMe)
          .map((event) => ({
            signupId: `${result.workspace.community.id}:${event.id}`,
            signedUpAt: event.createdAt,
            id: event.id,
            title: event.title,
            description: event.description,
            location: event.location,
            startAt: event.startAt,
            endAt: event.endAt,
            community: {
              id: result.workspace.community.id,
              name: result.workspace.community.name,
              abbreviation: result.workspace.community.abbreviation,
              avatarColor: result.workspace.community.avatarColor,
            },
          }));
      });
      activities.sort((a, b) => a.startAt.localeCompare(b.startAt));
      return { ok: true, activities };
    }
    return { ok: true, activities: response.data.activities };
  } catch {
    return { ok: false, message: "网络错误，请稍后重试" };
  }
}

// ---------- notification preferences and account notification center ----------

const PREFS_KEY = "ob.notificationPrefs";

// community: true 的项属于社群功能，社群隐藏（SHOW_COMMUNITY=false）时不在设置页展示
export const NOTIFICATION_PREFS = [
  { key: "daily_verse", title: "每日金句推送", desc: "每天早上 7:30 推送一节经文", defaultEnabled: false, community: false },
  { key: "event_reminder", title: "社群活动提醒", desc: "已报名活动开始前 2 小时提醒", defaultEnabled: true, community: true },
  { key: "reply", title: "留言回复通知", desc: "我的帖子收到评论或回复时", defaultEnabled: true, community: true },
  { key: "join_updates", title: "入群申请与审核", desc: "收到加入申请或审核结果时", defaultEnabled: true, community: true },
  { key: "ai_assistant", title: "AI 助理相关通知", desc: "AI 后台任务完成时", defaultEnabled: false, community: false },
  { key: "prayer_amen", title: "代祷阿们提醒", desc: "有弟兄姊妹为你的代祷按下阿们时", defaultEnabled: true, community: false },
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

export type AccountNotification = {
  id: string;
  type: "EVENT_REMINDER" | "COMMENT_REPLY" | "JOIN_REQUEST" | "JOIN_REVIEW" | "AI_TASK" | "DAILY_VERSE" | "PRAYER_AMEN";
  title: string;
  body: string;
  href: string | null;
  readAt: string | null;
  createdAt: string;
};

export type NotificationCenter = {
  preferences: Record<string, boolean>;
  notifications: AccountNotification[];
  unreadCount: number;
};

export async function fetchNotificationCenter(): Promise<
  | ({ ok: true } & NotificationCenter)
  | { ok: false; message: string }
> {
  try {
    const response = await apiRequest<{
      ok: boolean;
      message?: string;
      preferences?: Record<string, boolean>;
      notifications?: AccountNotification[];
      unreadCount?: number;
    }>("/api/mobile/me/notifications");
    if (!response.ok || !response.data?.ok) {
      return { ok: false, message: response.data?.message ?? `服务器返回异常（${response.status}）` };
    }
    return {
      ok: true,
      preferences: response.data.preferences ?? getPrefs(),
      notifications: response.data.notifications ?? [],
      unreadCount: response.data.unreadCount ?? 0,
    };
  } catch {
    return { ok: false, message: "网络错误，请稍后重试" };
  }
}

export async function updateAccountNotificationPreference(key: string, enabled: boolean) {
  try {
    const response = await apiRequest<{ ok: boolean; message?: string }>("/api/mobile/me/notifications", {
      method: "POST",
      body: { action: "UPDATE_PREFERENCE", key, enabled },
    });
    return response.ok && response.data?.ok
      ? { ok: true as const }
      : { ok: false as const, message: response.data?.message ?? `服务器返回异常（${response.status}）` };
  } catch {
    return { ok: false as const, message: "网络错误，请稍后重试" };
  }
}

export async function markAccountNotificationRead(notificationId?: string) {
  try {
    const response = await apiRequest<{ ok: boolean }>("/api/mobile/me/notifications", {
      method: "POST",
      body: notificationId
        ? { action: "MARK_READ", notificationId }
        : { action: "MARK_ALL_READ" },
    });
    return response.ok && Boolean(response.data?.ok);
  } catch {
    return false;
  }
}
