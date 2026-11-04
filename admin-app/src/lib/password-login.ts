// 账号密码登录：仅面向后台开通了密码的账号（商店审核 / 内部测试），
// 普通用户仍走邮箱验证码 / Google / Apple，不能自助注册密码。
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import type { VerifyResult } from "@/lib/email-login";
import { clearFailures, isLockedOut, recordFailure } from "@/lib/login-rate-limit";

const MAX_ACCOUNT_LENGTH = 120;
const MAX_PASSWORD_LENGTH = 128;
const GENERIC_FAILURE = "账号或密码不正确";
const LOCKED_MESSAGE = "尝试次数过多，请 15 分钟后再试";

// NOTE: 账号不存在时也跑一次 bcrypt 比对，避免通过响应耗时判断账号是否存在
const DUMMY_HASH = bcrypt.hashSync("openbible-dummy-password", 10);

/**
 * 规范化登录名：去空白并转小写，实现大小写不敏感
 * @param value 原始输入
 * @returns 规范化后的登录名
 */
export function normalizeLoginName(value: string) {
  return value.trim().toLowerCase();
}

async function findCredential(account: string) {
  const byLoginName = await db.userPassword.findUnique({
    where: { loginName: account },
    include: { user: true },
  });
  if (byLoginName) return byLoginName;

  // 也允许用账号绑定的邮箱登录
  if (!account.includes("@")) return null;
  const user = await db.user.findUnique({
    where: { email: account },
    include: { password: true },
  });
  if (!user?.password) return null;
  const { password, ...rest } = user;
  return { ...password, user: rest };
}

/**
 * 校验账号密码并返回登录用户；失败次数按账号与来源 IP 两个维度限频
 * @param rawAccount 用户名或邮箱
 * @param rawPassword 密码
 * @param clientIp 请求来源 IP，用于限频
 * @returns 与验证码登录一致的结果结构
 */
export async function verifyPasswordLogin(
  rawAccount: string,
  rawPassword: string,
  clientIp: string,
): Promise<VerifyResult> {
  const account = normalizeLoginName(rawAccount).slice(0, MAX_ACCOUNT_LENGTH);
  const password = rawPassword.slice(0, MAX_PASSWORD_LENGTH);
  if (!account || !password) {
    return { ok: false, message: "请输入账号和密码" };
  }

  const accountKey = `password-login:account:${account}`;
  const ipKey = `password-login:ip:${clientIp}`;
  if (isLockedOut(accountKey) || isLockedOut(ipKey)) {
    return { ok: false, message: LOCKED_MESSAGE };
  }

  const credential = await findCredential(account);
  const matched = await bcrypt.compare(password, credential?.passwordHash ?? DUMMY_HASH);
  if (!credential || !matched) {
    recordFailure(accountKey);
    recordFailure(ipKey);
    return { ok: false, message: GENERIC_FAILURE };
  }

  const user = credential.user;
  if (user.status === "BANNED") {
    return { ok: false, message: `该账号已被封禁${user.banReason ? `（${user.banReason}）` : ""}，如有疑问请联系运营` };
  }

  clearFailures(accountKey);
  clearFailures(ipKey);
  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  return {
    ok: true,
    message: "登录成功",
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      avatarColor: user.avatarColor,
      tier: user.tier,
      tierPriceCents: user.tierPriceCents,
    },
  };
}
