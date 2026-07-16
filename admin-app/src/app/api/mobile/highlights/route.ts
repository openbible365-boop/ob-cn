import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/current-user";
import { db } from "@/lib/db";
import { HIGHLIGHT_COLORS } from "@/lib/reading-constants";

type HighlightInput = {
  book?: unknown;
  chapter?: unknown;
  verse?: unknown;
  color?: unknown;
  createdAt?: unknown;
};

type DeleteInput = { book?: unknown; chapter?: unknown; verse?: unknown };

function reference(input: DeleteInput) {
  if (
    typeof input.book !== "string" || !/^[a-z0-9_-]{2,20}$/i.test(input.book) ||
    !Number.isInteger(input.chapter) || Number(input.chapter) < 1 || Number(input.chapter) > 200 ||
    !Number.isInteger(input.verse) || Number(input.verse) < 1 || Number(input.verse) > 300
  ) return null;
  return { book: input.book.toLowerCase(), chapter: Number(input.chapter), verse: Number(input.verse) };
}

function highlight(input: HighlightInput) {
  const ref = reference(input);
  if (!ref || typeof input.color !== "string" || !HIGHLIGHT_COLORS.includes(input.color)) return null;
  const parsedDate = typeof input.createdAt === "string" ? new Date(input.createdAt) : new Date();
  return { ...ref, color: input.color, createdAt: Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate };
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "未登录" }, { status: 401 });

  let body: { highlights?: HighlightInput[]; deletions?: DeleteInput[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "请求格式无效" }, { status: 400 });
  }

  if (!Array.isArray(body.highlights) || !Array.isArray(body.deletions) || body.highlights.length > 3000 || body.deletions.length > 3000) {
    return NextResponse.json({ ok: false, message: "高亮数据无效" }, { status: 400 });
  }
  const highlights = body.highlights.map(highlight);
  const deletions = body.deletions.map(reference);
  if (highlights.some((item) => !item) || deletions.some((item) => !item)) {
    return NextResponse.json({ ok: false, message: "高亮数据无效" }, { status: 400 });
  }

  await db.$transaction(async (tx) => {
    for (const item of deletions) {
      if (item) await tx.highlight.deleteMany({ where: { userId: user.id, ...item } });
    }
    for (const item of highlights) {
      if (!item) continue;
      await tx.highlight.upsert({
        where: { userId_book_chapter_verse: { userId: user.id, book: item.book, chapter: item.chapter, verse: item.verse } },
        create: { userId: user.id, ...item },
        update: { color: item.color },
      });
    }
  });

  const stored = await db.highlight.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    select: { book: true, chapter: true, verse: true, color: true, createdAt: true },
  });
  return NextResponse.json({ ok: true, highlights: stored });
}
