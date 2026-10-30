// 连续读经 Streak：本机记录「哪些天读过」，计算连续天数。
// 记为已读的动作：读经计划打卡成功、从今日金句进入经文。
// 宽限规则（微读式的仁慈）：整段连续中允许缺席一天一次，断两天才归零。
import { load, save } from "./store";

const KEY = "ob.read-days";
const MAX_DAYS = 400; // 只保留最近一年多，够算 streak 也不膨胀

function dayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function markTodayRead() {
  const days = new Set(load<string[]>(KEY, []));
  days.add(dayKey(new Date()));
  save(KEY, [...days].sort().slice(-MAX_DAYS));
}

export function isTodayRead() {
  return new Set(load<string[]>(KEY, [])).has(dayKey(new Date()));
}

export function getStreak(): number {
  const days = new Set(load<string[]>(KEY, []));
  if (days.size === 0) return 0;

  const cursor = new Date();
  // 今天还没读不算断——从昨天开始向回数
  if (!days.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);

  let streak = 0;
  let graceUsed = false;
  for (;;) {
    if (days.has(dayKey(cursor))) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    } else if (!graceUsed) {
      // 宽限：缺席的这一天跳过、不计数，但整段只容一次
      graceUsed = true;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}
