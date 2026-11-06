import type { AuthProvider, CommunityTier, UserTier } from "@/generated/prisma/client";

const PROVIDER_LABELS: Record<AuthProvider, string> = {
  EMAIL: "email",
  APPLE: "Apple",
  GOOGLE: "Google",
};

export function formatLoginMethods(providers: AuthProvider[]) {
  if (providers.length === 0) return "—";
  return providers.map((p) => PROVIDER_LABELS[p]).join(" + ");
}

export function formatUserTier(tier: UserTier, priceCents: number) {
  if (tier === "BASIC_FREE") return "初阶 免费";
  const price = (priceCents / 100).toFixed(priceCents % 100 === 0 ? 0 : 2);
  return `${tier === "MID" ? "中阶" : "高阶"} ¥${price}/月`;
}

export function formatTier(tier: CommunityTier, priceCents: number) {
  if (tier === "OFFICIAL_FREE") return "官方免费";
  if (tier === "BASIC_FREE") return "初阶 免费";
  const price = (priceCents / 100).toFixed(priceCents % 100 === 0 ? 0 : 2);
  const label = tier === "MID" ? "中阶" : "高阶";
  return `${label} ¥${price}/月`;
}

export function formatCompactNumber(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function formatTokensPerDay(n: number) {
  return `${Math.round(n / 1000)}K/日`;
}

export function formatCents(cents: number) {
  return `¥${(cents / 100).toLocaleString("zh-CN", { maximumFractionDigits: 0 })}`;
}

// 后台时间统一按运营时区显示（服务器在 UTC，直接截 ISO 字符串会差出 8–16 小时）。
// 默认与站内通知一致用北京时间；运营在其他时区时设 ADMIN_TIMEZONE（如 America/Los_Angeles）。
export const ADMIN_TIMEZONE = process.env.ADMIN_TIMEZONE || "Asia/Shanghai";

const dateParts = new Intl.DateTimeFormat("en-CA", {
  timeZone: ADMIN_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function zonedParts(d: Date) {
  const parts = Object.fromEntries(dateParts.formatToParts(d).map((p) => [p.type, p.value]));
  return parts as Record<"year" | "month" | "day" | "hour" | "minute", string>;
}

/** YYYY-MM-DD（运营时区） */
export function formatDate(d: Date) {
  const p = zonedParts(d);
  return `${p.year}-${p.month}-${p.day}`;
}

/** YYYY-MM-DD HH:mm（运营时区） */
export function formatDateTime(d: Date) {
  const p = zonedParts(d);
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
}

/** MM-DD HH:mm（运营时区，列表里的紧凑时间） */
export function formatShortDateTime(d: Date) {
  const p = zonedParts(d);
  return `${p.month}-${p.day} ${p.hour}:${p.minute}`;
}
