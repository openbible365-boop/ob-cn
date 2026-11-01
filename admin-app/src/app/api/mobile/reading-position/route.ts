import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/current-user";
import { db } from "@/lib/db";

export const runtime = "nodejs";

// 阅读位置跨设备同步：客户端翻章时防抖上报，启动/登录时拉取。
// 以 readingPositionAt 判新旧，客户端只在服务器版本更新时覆盖本地。

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, message: "请先登录" }, { status: 401 });
  }
  const record = await db.user.findUnique({
    where: { id: user.id },
    select: { readingPosition: true, readingPositionAt: true },
  });
  return NextResponse.json({
    ok: true,
    position: record?.readingPosition ?? null,
    updatedAt: record?.readingPositionAt?.toISOString() ?? null,
  });
}

type PositionBody = {
  version?: unknown;
  book?: unknown;
  chapter?: unknown;
  verse?: unknown;
};

export async function PUT(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, message: "请先登录" }, { status: 401 });
  }

  let body: PositionBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "请求格式不正确" }, { status: 400 });
  }

  const version = typeof body.version === "string" ? body.version.trim().toLowerCase() : "";
  const book = typeof body.book === "string" ? body.book.trim().toLowerCase() : "";
  const chapter = Number(body.chapter);
  const verse = body.verse === undefined || body.verse === null ? undefined : Number(body.verse);
  if (
    !/^[a-z0-9_-]{2,20}$/.test(version) ||
    !/^[a-z0-9_-]{2,20}$/.test(book) ||
    !Number.isInteger(chapter) || chapter < 1 || chapter > 200 ||
    (verse !== undefined && (!Number.isInteger(verse) || verse < 1 || verse > 300))
  ) {
    return NextResponse.json({ ok: false, message: "阅读位置不合法" }, { status: 400 });
  }

  const updatedAt = new Date();
  await db.user.update({
    where: { id: user.id },
    data: {
      readingPosition: { version, book, chapter, ...(verse !== undefined ? { verse } : {}) },
      readingPositionAt: updatedAt,
    },
  });
  return NextResponse.json({ ok: true, updatedAt: updatedAt.toISOString() });
}
