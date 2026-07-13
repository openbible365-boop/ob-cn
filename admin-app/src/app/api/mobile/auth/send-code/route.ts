// Mobile app login, step 1: request an email verification code.
// The static app site proxies /api/* here, so the session cookie is
// first-party for the mobile origin too.
import { NextResponse } from "next/server";
import { requestLoginCode } from "@/lib/email-login";

export async function POST(request: Request) {
  let email = "";
  try {
    ({ email = "" } = await request.json());
  } catch {
    return NextResponse.json({ ok: false, message: "请求格式错误" }, { status: 400 });
  }
  const result = await requestLoginCode(String(email));
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
