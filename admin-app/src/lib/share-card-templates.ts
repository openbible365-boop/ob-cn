export const SHARE_CARD_TEMPLATES = [
  {
    id: "warm",
    name: "暖金极简",
    description: "温暖、克制，适合每日金句与通用分享。",
    colors: ["#fffaf0", "#ffd465", "#9f6fc1"],
  },
  {
    id: "paper",
    name: "宣纸书卷",
    description: "纸张肌理与宋体排版，适合诗篇和智慧书。",
    colors: ["#f4ead2", "#8d6643", "#28342d"],
  },
  {
    id: "dawn",
    name: "晨光渐变",
    description: "柔和晨曦色彩，适合清晨推送和节期内容。",
    colors: ["#f8d6ba", "#e9c6e8", "#6f4f92"],
  },
  {
    id: "night",
    name: "深色夜读",
    description: "深蓝与金色高对比，适合晚间阅读分享。",
    colors: ["#131a2b", "#d9b65d", "#f6f0df"],
  },
] as const;

export type ShareCardTemplateId = (typeof SHARE_CARD_TEMPLATES)[number]["id"];

export const DEFAULT_SHARE_CARD_TEMPLATE: ShareCardTemplateId = "warm";

export function isShareCardTemplateId(value: string): value is ShareCardTemplateId {
  return SHARE_CARD_TEMPLATES.some((template) => template.id === value);
}

export function resolveShareCardTemplate(settings: {
  activeTemplate: string;
  autoRotate: boolean;
  rotationDays: number;
  updatedAt: Date;
}): ShareCardTemplateId {
  const active = isShareCardTemplateId(settings.activeTemplate)
    ? settings.activeTemplate
    : DEFAULT_SHARE_CARD_TEMPLATE;
  if (!settings.autoRotate) return active;

  const activeIndex = SHARE_CARD_TEMPLATES.findIndex((template) => template.id === active);
  const elapsedDays = Math.max(
    0,
    Math.floor((Date.now() - settings.updatedAt.getTime()) / 86_400_000),
  );
  const interval = Math.max(1, settings.rotationDays);
  return SHARE_CARD_TEMPLATES[
    (activeIndex + Math.floor(elapsedDays / interval)) % SHARE_CARD_TEMPLATES.length
  ].id;
}
