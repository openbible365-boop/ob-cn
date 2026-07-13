// Notification preference catalog (matches the mobile 5c design).
// Defaults follow the「最小打扰」principle; per-user overrides live in the
// NotificationSetting table.
export const NOTIFICATION_PREFS = [
  { key: "daily_verse", title: "每日金句推送", desc: "每天早上 7:30 推送一节经文", defaultEnabled: false },
  { key: "event_reminder", title: "社群活动提醒", desc: "已报名活动开始前 2 小时提醒", defaultEnabled: true },
  { key: "reply", title: "留言回复通知", desc: "我的帖子收到评论或回复时", defaultEnabled: true },
  { key: "ai_assistant", title: "AI 助理相关通知", desc: "社群 AI 助理的公开问答动态", defaultEnabled: false },
] as const;

export function defaultFor(key: string) {
  return NOTIFICATION_PREFS.find((p) => p.key === key)?.defaultEnabled ?? false;
}
