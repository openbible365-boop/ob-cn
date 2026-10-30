// 每日读经提醒：Capacitor 本地通知，设备端定时、无需服务器推送。
// 仅原生 App 生效（浏览器里页面一关定时就没了，不做不可靠的假提醒）。
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { load, save } from "./store";

const KEY = "ob.reading-reminder";
const NOTIFICATION_ID = 1001;

export type ReminderSettings = { enabled: boolean; time: string };

export function reminderSupported() {
  return Capacitor.isNativePlatform();
}

export function getReminder(): ReminderSettings {
  return load<ReminderSettings>(KEY, { enabled: false, time: "08:00" });
}

export async function enableReminder(time: string): Promise<{ ok: boolean; message: string }> {
  const [hour, minute] = time.split(":").map(Number);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) {
    return { ok: false, message: "时间格式不正确" };
  }
  try {
    const permission = await LocalNotifications.requestPermissions();
    if (permission.display !== "granted") {
      return { ok: false, message: "通知权限未开启，请到系统设置里允许通知" };
    }
    await LocalNotifications.cancel({ notifications: [{ id: NOTIFICATION_ID }] });
    await LocalNotifications.schedule({
      notifications: [
        {
          id: NOTIFICATION_ID,
          title: "今天的读经时间到了",
          body: "花几分钟安静读一段经文，继续你的连续记录。",
          schedule: { on: { hour, minute }, allowWhileIdle: true },
        },
      ],
    });
    save(KEY, { enabled: true, time });
    return { ok: true, message: `每天 ${time} 提醒已开启` };
  } catch {
    return { ok: false, message: "提醒设置失败，请稍后重试" };
  }
}

export async function disableReminder(): Promise<void> {
  try {
    await LocalNotifications.cancel({ notifications: [{ id: NOTIFICATION_ID }] });
  } catch {
    /* 取消失败也照常关掉开关 */
  }
  save(KEY, { ...getReminder(), enabled: false });
}
