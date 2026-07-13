"use server";

import { createHash, randomInt } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { SESSION_COOKIE } from "@/lib/current-user";
import { sendVerificationEmail, smtpConfigured } from "@/lib/email";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

const AVATAR_COLORS = ["#FFD465", "#D9C2F0", "#F0C7B7", "#8FB8E8", "#7FD1AE"];

export type AuthFormState = { ok: boolean; message: string } | null;

function hashCode(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

export async function sendLoginCode(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return { ok: false, message: "请输入有效的 email 地址" };
  }

  const latest = await db.verificationCode.findFirst({
    where: { email, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (latest && Date.now() - latest.createdAt.getTime() < RESEND_COOLDOWN_MS) {
    const wait = Math.ceil((RESEND_COOLDOWN_MS - (Date.now() - latest.createdAt.getTime())) / 1000);
    return { ok: false, message: `发送过于频繁，请 ${wait} 秒后再试` };
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const record = await db.verificationCode.create({
    data: { email, codeHash: hashCode(code), expiresAt: new Date(Date.now() + CODE_TTL_MS) },
  });

  let delivered: boolean;
  try {
    ({ delivered } = await sendVerificationEmail(email, code));
  } catch (err) {
    // Don't leave an unusable code blocking the resend cooldown.
    await db.verificationCode.delete({ where: { id: record.id } }).catch(() => {});
    console.error("[email] 发送验证码失败：", err);
    return { ok: false, message: "邮件发送失败，请稍后重试（服务器日志有详细错误，请检查 SMTP 配置与发件人验证状态）" };
  }

  return {
    ok: true,
    message: delivered
      ? "验证码已发送到你的邮箱，10 分钟内有效（如未收到请查看垃圾邮件）"
      : "本地开发环境未配置 SMTP：验证码已输出到服务器日志（配置 SMTP_HOST 等环境变量即可真实发信）",
  };
}

export async function verifyLoginCode(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const code = String(formData.get("code") ?? "").trim();
  if (!EMAIL_RE.test(email)) {
    return { ok: false, message: "请输入有效的 email 地址" };
  }
  if (!/^\d{6}$/.test(code)) {
    return { ok: false, message: "请输入 6 位数字验证码" };
  }

  const record = await db.verificationCode.findFirst({
    where: { email, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!record || record.expiresAt.getTime() < Date.now()) {
    return { ok: false, message: "验证码已过期，请重新获取" };
  }
  if (record.attempts >= MAX_ATTEMPTS) {
    return { ok: false, message: "尝试次数过多，请重新获取验证码" };
  }
  if (record.codeHash !== hashCode(code)) {
    await db.verificationCode.update({ where: { id: record.id }, data: { attempts: { increment: 1 } } });
    return { ok: false, message: "验证码不正确" };
  }

  await db.verificationCode.update({ where: { id: record.id }, data: { consumedAt: new Date() } });

  let user = await db.user.findUnique({ where: { email } });
  if (!user) {
    // First login registers the account.
    const localPart = email.split("@")[0].slice(0, 20) || "新用户";
    const color = AVATAR_COLORS[[...email].reduce((s, ch) => s + ch.charCodeAt(0), 0) % AVATAR_COLORS.length];
    user = await db.user.create({
      data: {
        name: localPart,
        email,
        avatarColor: color,
        authAccounts: { create: [{ provider: "EMAIL", providerAccountId: email }] },
      },
    });
  }

  if (user.status === "BANNED") {
    return { ok: false, message: `该账号已被封禁${user.banReason ? `（${user.banReason}）` : ""}，如有疑问请联系运营` };
  }

  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  const store = await cookies();
  store.set(SESSION_COOKIE, user.id, { httpOnly: true, path: "/", sameSite: "lax" });
  redirect("/me");
}

export async function isSmtpConfigured() {
  return smtpConfigured();
}
