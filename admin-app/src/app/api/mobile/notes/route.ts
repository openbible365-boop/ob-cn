import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/current-user";
import { db } from "@/lib/db";

type NoteInput = {
  id?: unknown;
  book?: unknown;
  chapter?: unknown;
  verse?: unknown;
  content?: unknown;
  createdAt?: unknown;
};

function parseNote(input: NoteInput) {
  const id = typeof input.id === "string" ? input.id.trim().slice(0, 100) : "";
  const book = typeof input.book === "string" ? input.book.trim().toLowerCase() : "";
  const chapter = Number(input.chapter);
  const verse = Number(input.verse);
  const content = typeof input.content === "string" ? input.content.trim().slice(0, 10_000) : "";
  const createdAt = typeof input.createdAt === "string" ? new Date(input.createdAt) : new Date();
  if (
    !id ||
    !/^[a-z0-9_-]{2,20}$/.test(book) ||
    !Number.isInteger(chapter) || chapter < 1 || chapter > 200 ||
    !Number.isInteger(verse) || verse < 1 || verse > 300 ||
    !content
  ) return null;
  return {
    id,
    book,
    chapter,
    verse,
    content,
    createdAt: Number.isNaN(createdAt.getTime()) ? new Date() : createdAt,
  };
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, message: "未登录" }, { status: 401 });
  }

  let body: { notes?: NoteInput[]; deletions?: unknown[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "请求格式无效" }, { status: 400 });
  }

  const noteInputs = Array.isArray(body.notes) ? body.notes : [];
  const deletionIds = Array.isArray(body.deletions)
    ? body.deletions.filter((id): id is string => typeof id === "string").slice(0, 3000)
    : [];
  if (noteInputs.length > 3000) {
    return NextResponse.json({ ok: false, message: "笔记数量超出限制" }, { status: 400 });
  }
  const notes = noteInputs.map(parseNote);
  if (notes.some((note) => !note)) {
    return NextResponse.json({ ok: false, message: "笔记数据无效" }, { status: 400 });
  }

  await db.$transaction(async (tx) => {
    if (deletionIds.length) {
      await tx.note.deleteMany({
        where: { userId: user.id, id: { in: deletionIds } },
      });
    }
    for (const note of notes) {
      if (!note) continue;
      const existing = await tx.note.findFirst({
        where: { id: note.id, userId: user.id },
        select: { id: true },
      });
      if (existing) {
        await tx.note.update({
          where: { id: existing.id },
          data: {
            book: note.book,
            chapter: note.chapter,
            verse: note.verse,
            content: note.content,
          },
        });
      } else {
        await tx.note.create({ data: { userId: user.id, ...note } });
      }
    }
  });

  const stored = await db.note.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      book: true,
      chapter: true,
      verse: true,
      content: true,
      createdAt: true,
    },
  });
  return NextResponse.json({ ok: true, notes: stored });
}
