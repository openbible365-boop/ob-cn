import { NextResponse } from "next/server";
import { createSession } from "@/lib/current-user";
import { loginWithGoogleIdToken } from "@/lib/google-login";

export async function POST(request: Request) {
  let idToken: unknown;
  try {
    ({ idToken } = (await request.json()) as { idToken?: unknown });
  } catch {
    return NextResponse.json({ ok: false, message: "请求格式错误" }, { status: 400 });
  }

  const result = await loginWithGoogleIdToken(idToken);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, message: result.message },
      { status: result.status },
    );
  }

  await createSession(result.user.id, request.headers.get("user-agent"));
  return NextResponse.json(result);
}
