import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/current-user";
import { loginWithNativeAppleCredential } from "@/lib/apple-login";

export async function POST(request: Request) {
  let credential: unknown;
  try {
    credential = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "请求格式错误" }, { status: 400 });
  }

  if (!credential || typeof credential !== "object") {
    return NextResponse.json({ ok: false, message: "请求格式错误" }, { status: 400 });
  }

  const result = await loginWithNativeAppleCredential(credential);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, message: result.message },
      { status: result.status },
    );
  }

  const store = await cookies();
  store.set(SESSION_COOKIE, result.user.id, {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return NextResponse.json(result);
}
