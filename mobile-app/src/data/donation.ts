// 奉献 / 支持计划（与网页端支持弹窗同一设计与价目）。
// App 内不接支付 SDK：按钮跳转网页端完成，避开应用商店 IAP 抽成与审核限制；
// 价格调整时同步修改网页端 js/app.js 的 togglePlanPeriod 数值。

export type SupportPlan = {
  id: "free" | "basic" | "pro" | "supporter";
  title: string;
  /** 月付价（美元）；null = 免费 */
  monthly: number | null;
  /** 单月支持价（美元）；null = 免费 */
  once: number | null;
  popular?: boolean;
  features: string[];
  /** 对应后端 tier，用于标记「当前支持」 */
  tier?: "BASIC_FREE" | "MID" | "HIGH";
};

/** 网页端支付入口：App 内点「立即支持」跳转到这里完成 */
export const SUPPORT_WEB_URL = "https://openbible.live";

export const SUPPORT_CONTACT_EMAIL = "info@openbible.live";

export const SUPPORT_PLANS: SupportPlan[] = [
  {
    id: "free",
    title: "免费计划",
    monthly: null,
    once: null,
    tier: "BASIC_FREE",
    features: [
      "感谢众多支持者的支持，使我们能向所有人开放这份免费资源",
      "每月 20 次体验对话",
    ],
  },
  {
    id: "basic",
    title: "基础计划",
    monthly: 4.99,
    once: 5.99,
    features: ["以简单方式托住事工", "每月 100 次对话", "适合轻量级每周使用"],
  },
  {
    id: "pro",
    title: "进阶计划",
    monthly: 9.99,
    once: 11.99,
    popular: true,
    tier: "MID",
    features: [
      "您的支持帮助我们持续提升工具的质量与深度",
      "每月 300 次对话",
      "适合经常研经的读者",
    ],
  },
  {
    id: "supporter",
    title: "支持者计划",
    monthly: 14.99,
    once: 17.99,
    tier: "HIGH",
    features: [
      "适合牧师、小组带领人或每天使用",
      "您的支持将代赠一份给有需要的人 — 既滋养自己，也祝福他人",
      "每月 400 次对话",
    ],
  },
];

export const SUPPORT_FOOTER_NOTE =
  "您的支持将全部用于维持服务器、技术、安全与经文资料品质，若你正面临经济压力，我们亦提供资助选项。";
