import { getSessionUser } from "@/lib/current-user";
import { db } from "@/lib/db";
import { toStoredNote, toWebNote, type WebNote } from "@/lib/web-notes";

export const runtime = "nodejs";

// 对应网页版原 POST /api/user-notes/sync。
// 请求体是 [{ verse_ref, content }]，content 是网页版笔记对象的 JSON 字符串。
// 整合后写入的是 App 同一张 Note 表，所以网页版存的笔记 App 能看到，反之亦然。
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return Response.json({ detail: "未登录" }, { status: 401 });
  }

  let incoming: Array<{ verse_ref?: unknown; content?: unknown }>;
  try {
    const body = await request.json();
    incoming = Array.isArray(body) ? body : [];
  } catch {
    return Response.json({ detail: "请求格式不正确" }, { status: 400 });
  }
  if (incoming.length > 3000) {
    return Response.json({ detail: "笔记数量超出限制" }, { status: 400 });
  }

  // 网页版可以记「无经文」的散记（refs 为空），App 的 Note 必须挂在某一节上。
  // 这类笔记无法进共享表，原样回传让网页版继续留在本地，而不是静默丢掉。
  const localOnly: WebNote[] = [];

  for (const item of incoming) {
    const fallbackId = typeof item.verse_ref === "string" ? item.verse_ref : "";
    if (typeof item.content !== "string") continue;
    let parsed: WebNote;
    try {
      parsed = JSON.parse(item.content) as WebNote;
    } catch {
      continue;
    }
    const stored = toStoredNote(parsed, fallbackId);
    if (!stored) {
      // 进不了共享表的两类：无经文散记、慧读问答笔记（只有 question/answer）。
      // 两类都原样回传留在网页版本地——此前只兜住了前者，
      // 后者因 text 为空被直接 continue 掉，用户的慧读记录会在同步时永久丢失。
      const hasBody =
        (parsed.text ?? "").trim() ||
        (parsed.answer ?? "").trim() ||
        (parsed.question ?? "").trim();
      if (hasBody) localOnly.push({ ...parsed, id: fallbackId || parsed.id });
      continue;
    }
    await db.note.upsert({
      where: { id: stored.id },
      update: {
        book: stored.book,
        chapter: stored.chapter,
        verse: stored.verse,
        content: stored.content,
      },
      create: { ...stored, userId: user.id },
    });
  }

  const all = await db.note.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 3000,
  });

  // 回传网页版认识的格式：verse_ref 是笔记 id，content 是笔记对象的 JSON。
  const merged = [
    ...all.map((note) => ({
      verse_ref: note.id,
      content: JSON.stringify(toWebNote(note)),
    })),
    ...localOnly.map((note) => ({
      verse_ref: note.id ?? "",
      content: JSON.stringify(note),
    })),
  ];

  return Response.json(merged);
}
