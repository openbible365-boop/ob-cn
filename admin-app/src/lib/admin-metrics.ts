import type { Prisma } from "@/generated/prisma/client";
import { formatDate } from "@/lib/format";

/**
 * 「真实注册用户」的统一口径：通过真实登录流程建立的账号
 * （邮箱 / Apple / Google 登录会写入第三方账号 id；后台开通的密码登录账号有密码记录）。
 * 种子数据里的演示用户两者都没有，不计入。数据看板与用户管理共用这一口径，数字才对得上。
 */
export const REAL_USER_WHERE: Prisma.UserWhereInput = {
  OR: [
    { authAccounts: { some: { providerAccountId: { not: null } } } },
    { password: { isNot: null } },
  ],
};

/** 最近 n 天的日期键（运营时区，YYYY-MM-DD），从早到晚 */
export function recentDayKeys(days: number, now = new Date()): string[] {
  const keys: string[] = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    keys.push(formatDate(new Date(now.getTime() - offset * 24 * 60 * 60 * 1000)));
  }
  return [...new Set(keys)];
}

/** 把一组时间按运营时区的自然日计数 */
export function countByDay(dates: Date[], dayKeys: string[]): number[] {
  const counts = new Map(dayKeys.map((key) => [key, 0]));
  for (const date of dates) {
    const key = formatDate(date);
    if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return dayKeys.map((key) => counts.get(key) ?? 0);
}
