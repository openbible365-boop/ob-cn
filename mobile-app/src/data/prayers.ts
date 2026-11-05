// 个人祷告清单：本机保存（与笔记/慧读同一哲学——先私密、后同步）。
// 事项可标记「已应允」——记录神的回应是这个清单和备忘录的本质区别。
import { load, save, uid } from "./store";

export type PrayerItem = {
  id: string;
  text: string;
  createdAt: string;
  answeredAt: string | null;
  /** 来源：自己添加，或从社群代祷贴收进来 */
  source: "mine" | "community";
  /** 社群来源时的补充说明（群名/请求人），仅展示用 */
  sourceLabel?: string;
};

const KEY = "ob.prayers";

export function getPrayers(): PrayerItem[] {
  return load<PrayerItem[]>(KEY, []);
}

export function addPrayer(text: string, source: PrayerItem["source"] = "mine", sourceLabel?: string): PrayerItem[] {
  const items = getPrayers();
  const item: PrayerItem = {
    id: uid(),
    text: text.trim(),
    createdAt: new Date().toISOString(),
    answeredAt: null,
    source,
    sourceLabel,
  };
  const next = [item, ...items];
  save(KEY, next);
  return next;
}

export function toggleAnswered(id: string): PrayerItem[] {
  const next = getPrayers().map((item) =>
    item.id === id
      ? { ...item, answeredAt: item.answeredAt ? null : new Date().toISOString() }
      : item,
  );
  save(KEY, next);
  return next;
}

export function removePrayer(id: string): PrayerItem[] {
  const next = getPrayers().filter((item) => item.id !== id);
  save(KEY, next);
  return next;
}

export function clearPrayersForLogout() {
  localStorage.removeItem(KEY);
}
