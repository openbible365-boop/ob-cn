// 阅读主题：跟随系统 / 浅色 / 护眼（米黄）/ 深色。
// 主题只切 body 上的 class（dark / sepia），颜色全部由 index.css 里的令牌决定。
import { useEffect, useState } from "react";

export type ReadingTheme = "system" | "light" | "sepia" | "dark";

export const READING_THEMES: Array<{ value: ReadingTheme; label: string }> = [
  { value: "system", label: "跟随" },
  { value: "light", label: "浅色" },
  { value: "sepia", label: "护眼" },
  { value: "dark", label: "深色" },
];

const THEME_KEY = "ob.bible.theme";
const LEGACY_DARK_KEY = "ob.bible.isDarkMode";
const THEME_EVENT = "ob:reading-theme";

// 与 index.css 各主题的纸面底色一致，供浏览器地址栏 / 安卓状态栏使用
const THEME_COLORS = { light: "#FAF8F3", sepia: "#F4ECD8", dark: "#16171A" } as const;

function isReadingTheme(value: unknown): value is ReadingTheme {
  return value === "system" || value === "light" || value === "sepia" || value === "dark";
}

export function getSavedTheme(): ReadingTheme {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (isReadingTheme(saved)) return saved;
    // 旧版只有深色开关；页面每次挂载都会写入 "false"，所以 false 不代表用户选过浅色
    return localStorage.getItem(LEGACY_DARK_KEY) === "true" ? "dark" : "system";
  } catch {
    return "system";
  }
}

const systemDark = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches;

export function resolveTheme(theme: ReadingTheme): Exclude<ReadingTheme, "system"> {
  if (theme === "system") return systemDark() ? "dark" : "light";
  return theme;
}

export function applyTheme(theme: ReadingTheme) {
  const resolved = resolveTheme(theme);
  document.body.classList.toggle("dark", resolved === "dark");
  document.body.classList.toggle("sepia", resolved === "sepia");
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLORS[resolved]);
}

export function themeColor(): string {
  if (document.body.classList.contains("dark")) return THEME_COLORS.dark;
  if (document.body.classList.contains("sepia")) return THEME_COLORS.sepia;
  return THEME_COLORS.light;
}

export function setTheme(theme: ReadingTheme) {
  try { localStorage.setItem(THEME_KEY, theme); } catch { /* 存不了就只在本次生效 */ }
  applyTheme(theme);
  window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: theme }));
}

// 启动时调用一次：React 渲染前先套主题，避免闪白；「跟随」时响应系统切换
export function setupTheme() {
  applyTheme(getSavedTheme());
  window.matchMedia?.("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (getSavedTheme() === "system") applyTheme("system");
  });
}

export function useReadingTheme(): [ReadingTheme, (theme: ReadingTheme) => void] {
  const [theme, setState] = useState<ReadingTheme>(getSavedTheme);
  useEffect(() => {
    const sync = (event: Event) => setState((event as CustomEvent<ReadingTheme>).detail);
    window.addEventListener(THEME_EVENT, sync);
    return () => window.removeEventListener(THEME_EVENT, sync);
  }, []);
  return [theme, setTheme];
}
