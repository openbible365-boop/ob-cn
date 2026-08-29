// 安卓实体返回键：弹层优先关闭 → 页面回退 → 首页两次确认退出。
// 网页端和 iOS 没有实体返回键，本模块在非安卓原生环境下不做任何事。
import { Capacitor } from "@capacitor/core";
import { App as CapacitorApp } from "@capacitor/app";

/** 页面里有可关闭的弹层时：监听此事件并 preventDefault()，同时把弹层关掉。 */
export const ANDROID_BACK_EVENT = "ob:android-back";

const EXIT_WINDOW_MS = 2000;
let lastBackAt = 0;

function showExitToast() {
  const existing = document.getElementById("ob-exit-toast");
  existing?.remove();
  const toast = document.createElement("div");
  toast.id = "ob-exit-toast";
  toast.className = "app-exit-toast";
  toast.setAttribute("role", "status");
  toast.textContent = "再按一次返回键退出";
  document.body.appendChild(toast);
  window.setTimeout(() => toast.remove(), EXIT_WINDOW_MS);
}

export function setupAndroidBackButton(options: {
  /** 当前是否在一级标签页（返回应退出而不是回退历史） */
  isAtTabRoot: () => boolean;
  goBack: () => void;
}) {
  if (Capacitor.getPlatform() !== "android") return;

  void CapacitorApp.addListener("backButton", () => {
    // 先给打开着弹层/抽屉的页面一次接管机会
    const event = new CustomEvent(ANDROID_BACK_EVENT, { cancelable: true });
    window.dispatchEvent(event);
    if (event.defaultPrevented) return;

    if (!options.isAtTabRoot()) {
      options.goBack();
      return;
    }

    const now = Date.now();
    if (now - lastBackAt < EXIT_WINDOW_MS) {
      void CapacitorApp.exitApp();
      return;
    }
    lastBackAt = now;
    showExitToast();
  });
}
