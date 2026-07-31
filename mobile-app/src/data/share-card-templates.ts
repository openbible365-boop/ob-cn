export const SHARE_CARD_TEMPLATES = [
  { id: "warm", name: "暖金", colors: ["#fffaf0", "#ffd465", "#9f6fc1"] },
  { id: "paper", name: "书卷", colors: ["#f4ead2", "#8d6643", "#28342d"] },
  { id: "dawn", name: "晨光", colors: ["#f8d6ba", "#e9c6e8", "#6f4f92"] },
  { id: "night", name: "夜读", colors: ["#131a2b", "#d9b65d", "#f6f0df"] },
] as const;

export type ShareCardTemplateId = (typeof SHARE_CARD_TEMPLATES)[number]["id"];

export const DEFAULT_SHARE_CARD_TEMPLATE: ShareCardTemplateId = "warm";

export function isShareCardTemplateId(value: unknown): value is ShareCardTemplateId {
  return typeof value === "string" &&
    SHARE_CARD_TEMPLATES.some((template) => template.id === value);
}

export async function fetchShareCardTemplate(): Promise<ShareCardTemplateId> {
  try {
    const response = await fetch("/api/mobile/share-card-settings", {
      cache: "no-store",
    });
    if (!response.ok) return DEFAULT_SHARE_CARD_TEMPLATE;
    const payload = await response.json() as { activeTemplate?: unknown };
    return isShareCardTemplateId(payload.activeTemplate)
      ? payload.activeTemplate
      : DEFAULT_SHARE_CARD_TEMPLATE;
  } catch {
    return DEFAULT_SHARE_CARD_TEMPLATE;
  }
}
