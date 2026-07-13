import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/current-user";

const TRANSLATION = "和合本";

// 导出笔记 — plain-text download of the user's notes, each with its verse
// reference and scripture text attached (「导出内容将附带经文引用出处」).
export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.redirect(new URL("/me", request.url));
  }

  const notes = await db.note.findMany({
    where: { userId: user.id },
    orderBy: [{ book: "asc" }, { chapter: "asc" }, { verse: "asc" }, { createdAt: "asc" }],
  });

  const sections = await Promise.all(
    notes.map(async (n) => {
      const verse = await db.verse.findUnique({
        where: { translation_book_chapter_verse: { translation: TRANSLATION, book: n.book, chapter: n.chapter, verse: n.verse } },
      });
      return [
        `${n.book} ${n.chapter}:${n.verse}（${TRANSLATION}）`,
        verse ? `经文：${verse.text}` : "经文：（未找到）",
        `笔记：${n.content}`,
        `时间：${n.createdAt.toISOString().slice(0, 16).replace("T", " ")}`,
      ].join("\n");
    })
  );

  const body = [
    `OpenBible 笔记导出 · ${user.name}`,
    `导出时间：${new Date().toISOString().slice(0, 16).replace("T", " ")}`,
    `共 ${notes.length} 条`,
    "",
    sections.join("\n\n----------------\n\n"),
    "",
  ].join("\n");

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": 'attachment; filename="openbible-notes.txt"',
    },
  });
}
