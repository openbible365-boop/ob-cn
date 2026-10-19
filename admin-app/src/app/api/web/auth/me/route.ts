import { getSessionUser } from "@/lib/current-user";

export const runtime = "nodejs";

// 对应网页版原 GET /api/auth/me。
// 整合后网页版与 App 同源共用一套会话 Cookie，不再需要 Bearer token：
// 在任一端登录，另一端刷新即认得同一个账号。
export async function GET() {
  const user = await getSessionUser();
  if (!user) return Response.json({ detail: "未登录" }, { status: 401 });
  return Response.json({
    id: user.id,
    username: user.name,
    email: user.email,
    avatar_url: user.avatarUrl,
    plan: "free",
  });
}
