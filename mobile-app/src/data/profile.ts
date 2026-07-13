// Local session + notification preferences. Real email-code / Apple login
// arrives when the app is wired to the backend API; until then login state
// is device-local and the login screen says so.
import { load, save } from "./store";

const SESSION_KEY = "ob.loggedIn";
const PREFS_KEY = "ob.notificationPrefs";

export const USER = { name: "王弟兄", avatarColor: "#FFD465", uid: 2 };

export function isLoggedIn(): boolean {
  return load<boolean>(SESSION_KEY, true);
}

export function setLoggedIn(v: boolean) {
  save(SESSION_KEY, v);
}

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
