// 后台登录防爆破：按用户名记失败次数，窗口内超限即锁定。
// 内存实现，适用于单实例部署；成功登录即清零，重启进程也清零。
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;

const failures = new Map<string, number[]>();

function recent(key: string): number[] {
  const now = Date.now();
  const list = (failures.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  failures.set(key, list);
  return list;
}

export function isLockedOut(key: string): boolean {
  return recent(key).length >= MAX_FAILURES;
}

export function recordFailure(key: string) {
  recent(key).push(Date.now());
}

export function clearFailures(key: string) {
  failures.delete(key);
}
