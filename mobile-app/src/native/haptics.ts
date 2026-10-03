// 轻触感反馈：选节、高亮、翻章三类确认动作。
// 仅原生平台生效；插件按需加载，个别机型不支持时静默跳过。
import { Capacitor } from "@capacitor/core";

export function hapticLight() {
  if (!Capacitor.isNativePlatform()) return;
  void import("@capacitor/haptics")
    .then(({ Haptics, ImpactStyle }) => Haptics.impact({ style: ImpactStyle.Light }))
    .catch(() => {});
}
