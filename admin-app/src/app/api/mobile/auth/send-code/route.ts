// Mobile app login, step 1: request an email verification code.
// The static app site proxies /api/* here, so the session cookie is
// first-party for the mobile origin too.
import { NextResponse } from "next/server";
import { requestLoginCode } from "@/lib/email-login";

// 发码限频：原先只有按 email 的 60 秒冷却——换邮箱即可无限发信（邮件轰炸、
// 耗 SMTP 配额、灌 verificationCode 表）。加两道闸：
// 按 IP（XFF 可伪造，故再加）不看 IP 的全局闸。单实例内存实现。
const MINUTE_MS = 60 * 1000;
const IP_MAX_KEYS = 2000;
const ipWindow = new Map<string, number[]>();
let globalWindow: number[] = [];

function sendRateLimited(ip: string): boolean {
  const now = Date.now();
  globalWindow = globalWindow.filter((t) => now - t < MINUTE_MS);
  if (globalWindow.length >= 20) return true; // 全局每分钟 20 封封顶

  const list = (ipWindow.get(ip) ?? []).filter((t) => now - t < 10 * MINUTE_MS);
  if (list.length >= 5) return true; // 单 IP 10 分钟最多 5 封

  if (!ipWindow.has(ip) && ipWindow.size >= IP_MAX_KEYS) {
    for (const [key, stamps] of ipWindow) {
      if (!stamps.some((t) => now - t < 10 * MINUTE_MS)) ipWindow.delete(key);
    }
    if (ipWindow.size >= IP_MAX_KEYS) ipWindow.clear();
  }
  list.push(now);
  ipWindow.set(ip, list);
  globalWindow.push(now);
  return false;
}

export async function POST(request: Request) {
  let email = "";
  try {
    ({ email = "" } = await request.json());
  } catch {
    return NextResponse.json({ ok: false, message: "请求格式错误" }, { status: 400 });
  }
  if (typeof email !== "string" || email.length > 254) {
    return NextResponse.json({ ok: false, message: "请输入有效的 email 地址" }, { status: 400 });
  }
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (sendRateLimited(ip)) {
    return NextResponse.json({ ok: false, message: "请求太频繁了，请稍后再试" }, { status: 429 });
  }
  const result = await requestLoginCode(String(email));
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
