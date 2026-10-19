// 原生状态栏跟随阅读主题：深色模式下状态栏也转深色。
// 用 MutationObserver 盯 body.dark，主题切换逻辑不需要知道状态栏的存在。
import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";
import { themeColor } from "../theme";

async function applyStatusBarTheme(dark: boolean) {
  try {
    await StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light });
    if (Capacitor.getPlatform() === "android") {
      await StatusBar.setBackgroundColor({ color: themeColor() });
    }
  } catch {
    /* 个别机型不支持时静默跳过，不影响使用 */
  }
}

export function setupStatusBarThemeSync() {
  if (!Capacitor.isNativePlatform()) return;

  void applyStatusBarTheme(document.body.classList.contains("dark"));
  const observer = new MutationObserver(() => {
    void applyStatusBarTheme(document.body.classList.contains("dark"));
  });
  observer.observe(document.body, { attributes: true, attributeFilter: ["class"] });
}
