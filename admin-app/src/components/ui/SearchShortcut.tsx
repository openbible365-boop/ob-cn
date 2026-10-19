"use client";

import { useEffect } from "react";

/**
 * 后台搜索框的键盘快捷键：按 `/` 聚焦，按 Esc 失焦。
 *
 * 后台最高频的操作就是"搜一下某个用户/社群"，每次都要摸鼠标点输入框很慢。
 * `/` 是列表型后台的通行约定（GitHub、Linear 等都用它）。
 *
 * 边界处理：
 *   - 焦点已在输入框/文本域内时不拦截，否则用户没法输入 "/" 这个字符
 *   - 组合键（Cmd/Ctrl + /）不拦截，留给浏览器与系统
 */
export function SearchShortcut({ targetName = "q" }: { targetName?: string }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;

      const active = document.activeElement as HTMLElement | null;
      const typing =
        active &&
        (active.tagName === "INPUT" ||
          active.tagName === "TEXTAREA" ||
          active.tagName === "SELECT" ||
          active.isContentEditable);
      if (typing) return;

      const input = document.querySelector<HTMLInputElement>(`input[name="${targetName}"]`);
      if (!input) return;
      e.preventDefault();
      input.focus();
      input.select();
    }

    function onEsc(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      const active = document.activeElement as HTMLElement | null;
      if (active?.tagName === "INPUT") active.blur();
    }

    window.addEventListener("keydown", onKey);
    window.addEventListener("keydown", onEsc);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keydown", onEsc);
    };
  }, [targetName]);

  return null;
}

/** 搜索框旁的快捷键提示，让用户知道有这个快捷键 */
export function ShortcutHint() {
  return (
    <kbd className="kbd-hint" aria-hidden="true">
      /
    </kbd>
  );
}
