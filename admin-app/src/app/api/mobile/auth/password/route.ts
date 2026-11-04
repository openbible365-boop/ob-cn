// 移动端账号密码登录：仅限后台开通了密码的账号，校验通过后与验证码登录
// 一样设置会话 cookie 并返回登录用户。
import { NextResponse } from "next/server";
import { createSession } from "@/lib/current-user";
import { verifyPasswordLogin } from "@/lib/password-login";

export async function POST(request: Request) {
  let account: unknown = "";
  let password: unknown = "";
  try {
    ({ account = "", password = "" } = await request.json());
  } catch {
    return NextResponse.json({ ok: false, message: "请求格式错误" }, { status: 400 });
  }
  if (typeof account !== "string" || typeof password !== "string") {
    return NextResponse.json({ ok: false, message: "请输入账号和密码" }, { status: 400 });
  }

  // 与 send-code 一致取反代传入的首个 IP，作为失败限频的第二个维度
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const result = await verifyPasswordLogin(account, password, ip);
  if (!result.ok) {
    return NextResponse.json(result, { status: 400 });
  }

  await createSession(result.user.id, request.headers.get("user-agent"));
  return NextResponse.json(result);
}
