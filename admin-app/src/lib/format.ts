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
  return `${tier === "MID" ? "中阶" : "高阶"} $${price}/月`;
}

export function formatTier(tier: CommunityTier, priceCents: number) {
  if (tier === "OFFICIAL_FREE") return "官方免费";
  if (tier === "BASIC_FREE") return "初阶 免费";
  const price = (priceCents / 100).toFixed(priceCents % 100 === 0 ? 0 : 2);
  const label = tier === "MID" ? "中阶" : "高阶";
  return `${label} $${price}/月`;
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
  return `$${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

export function formatDate(d: Date) {
  return d.toISOString().slice(0, 10);
}
