// Current session user for the mobile app (401 when logged out).
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/current-user";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, message: "未登录" }, { status: 401 });
  }
  return NextResponse.json({
    ok: true,
    user: { id: user.id, name: user.name, email: user.email, avatarColor: user.avatarColor },
  });
}
