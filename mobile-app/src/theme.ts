// 阅读主题：浅色 / 护眼（米黄）/ 深色。
// 主题只切 body 上的 class（dark / sepia），颜色全部由 index.css 里的令牌决定。
import { useEffect, useState } from "react";

export type ReadingTheme = "system" | "light" | "sepia" | "dark";

// 「跟随系统」不再作为可选项：用户要的是确定的三档。
// 旧存量里的 "system" 在 setupTheme 里按当时的系统外观落成具体主题。
export const READING_THEMES: Array<{ value: ReadingTheme; label: string }> = [
  { value: "light", label: "浅色" },
  { value: "sepia", label: "护眼" },
  { value: "dark", label: "深色" },
];

const THEME_KEY = "ob.bible.theme";
const LEGACY_DARK_KEY = "ob.bible.isDarkMode";
const THEME_EVENT = "ob:reading-theme";

// 与 index.css 各主题的纸面底色一致，供浏览器地址栏 / 安卓状态栏使用
const THEME_COLORS = { light: "#FFFFFF", sepia: "#F4ECD8", dark: "#16171A" } as const;

function isReadingTheme(value: unknown): value is ReadingTheme {
  return value === "system" || value === "light" || value === "sepia" || value === "dark";
}

export function getSavedTheme(): ReadingTheme {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (isReadingTheme(saved)) return saved;
    // 旧版只有深色开关；页面每次挂载都会写入 "false"，所以 false 不代表用户选过浅色
    return localStorage.getItem(LEGACY_DARK_KEY) === "true" ? "dark" : "light";
  } catch {
    return "light";
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

// 启动时调用一次：React 渲染前先套主题，避免闪白。
// 历史存量 "system" 迁移：按当时的系统外观落成具体主题并写回。
export function setupTheme() {
  const saved = getSavedTheme();
  if (saved === "system") {
    setTheme(resolveTheme(saved));
    return;
  }
  applyTheme(saved);
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
