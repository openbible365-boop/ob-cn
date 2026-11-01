import { useEffect, useRef, useState } from "react";

// 轻量页内二次确认：第一次点击进入「确认？」待命态，几秒内不再点自动撤销；
// 第二次点击才执行。替代 window.confirm——原生弹窗在 WebView 里是英文按钮
// （OK/Cancel）且无法跟随应用主题。armedKey 区分同页多个删除目标。
export function useArmedConfirm(timeoutMs = 3200) {
  const [armedKey, setArmedKey] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
  }, []);

  const confirm = (key: string, action: () => void) => {
    if (armedKey === key) {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      setArmedKey(null);
      action();
      return;
    }
    setArmedKey(key);
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setArmedKey(null), timeoutMs);
  };

  return { armedKey, confirm };
}
