import { getSessionUser } from "@/lib/current-user";
import { db } from "@/lib/db";

export const runtime = "nodejs";

type RouteParams = { params: Promise<{ verseRef: string }> };

// 对应网页版原 DELETE /api/user-notes/{verse_ref}。
// verse_ref 在整合后就是 Note 的 id，删除只作用于当前登录用户自己的笔记。
export async function DELETE(_request: Request, { params }: RouteParams) {
  const user = await getSessionUser();
  if (!user) return Response.json({ detail: "未登录" }, { status: 401 });

  const { verseRef } = await params;
  const removed = await db.note.deleteMany({
    where: { id: decodeURIComponent(verseRef), userId: user.id },
  });
  return Response.json({ ok: true, removed: removed.count });
}
