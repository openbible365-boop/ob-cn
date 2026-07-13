// Mobile app login, step 2: verify the code, set the session cookie and
// return the signed-in user.
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/current-user";
import { verifyLoginCodeFor } from "@/lib/email-login";

export async function POST(request: Request) {
  let email = "";
  let code = "";
  try {
    ({ email = "", code = "" } = await request.json());
  } catch {
    return NextResponse.json({ ok: false, message: "请求格式错误" }, { status: 400 });
  }

  const result = await verifyLoginCodeFor(String(email), String(code));
  if (!result.ok) {
    return NextResponse.json(result, { status: 400 });
  }

  const store = await cookies();
  store.set(SESSION_COOKIE, result.user.id, { httpOnly: true, path: "/", sameSite: "lax" });
  return NextResponse.json(result);
}
