import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/current-user";
import { db } from "@/lib/db";
import { BOOKS } from "@/lib/bible-books";
import { formatDate } from "@/lib/format";

export const runtime = "nodejs";

// 阅读统计上报：App 端读完一章（停留 ≥ 8 秒）记一条，批量补传。
// 未登录也收（按设备 id 统计人数）；登录时关联账号。只记「哪一章被读了」，不记阅读内容。

type EventInput = { kind?: unknown; version?: unknown; book?: unknown; chapter?: unknown; at?: unknown };

const MAX_BATCH = 100;
const MAX_PER_DEVICE_PER_DAY = 400; // 正常人一天读不了这么多章：超出视为异常，丢弃
const BACKFILL_MS = 8 * 24 * 60 * 60 * 1000;
const PLATFORMS = new Set(["ios", "android", "web"]);
const CHAPTERS = new Map(BOOKS.map((book) => [book.code, book.chapters]));

function parseEvent(input: EventInput, now: number) {
  const kind = input.kind === "bible" ? "BIBLE" : input.kind === "commentary" ? "COMMENTARY" : null;
  const book = typeof input.book === "string" ? input.book.toLowerCase() : "";
  const chapter = Number(input.chapter);
  const maxChapter = CHAPTERS.get(book);
  if (!kind || !maxChapter || !Number.isInteger(chapter)) return null;
  // 注释允许 0（书卷绪论）
  if (chapter > maxChapter || chapter < (kind === "COMMENTARY" ? 0 : 1)) return null;
  const version = kind === "BIBLE" && typeof input.version === "string" && /^[a-z0-9_-]{2,20}$/.test(input.version)
    ? input.version
    : "";
  if (kind === "BIBLE" && !version) return null;
  const at = typeof input.at === "string" ? Date.parse(input.at) : NaN;
  // 时间只接受最近 8 天、且不晚于现在；否则按收到时间算
  const occurredAt = new Date(Number.isFinite(at) && at <= now && now - at <= BACKFILL_MS ? at : now);
  return { kind, version, book, chapter, occurredAt } as const;
}

export async function POST(request: Request) {
  let body: { deviceId?: unknown; platform?: unknown; events?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "请求格式无效" }, { status: 400 });
  }
  const deviceId = typeof body.deviceId === "string" && /^[a-zA-Z0-9_-]{8,64}$/.test(body.deviceId) ? body.deviceId : "";
  if (!deviceId || !Array.isArray(body.events)) {
    return NextResponse.json({ ok: false, message: "请求格式无效" }, { status: 400 });
  }
  const platform = typeof body.platform === "string" && PLATFORMS.has(body.platform) ? body.platform : "";
  const now = Date.now();
  const events = body.events
    .slice(0, MAX_BATCH)
    .map((item) => (item && typeof item === "object" ? parseEvent(item as EventInput, now) : null))
    .filter((event) => event !== null);
  if (events.length === 0) return NextResponse.json({ ok: true, accepted: 0 });

  const user = await getSessionUser().catch(() => null);

  // 去重：同一设备、同一章、同一天只记一次（客户端已去重，这里兜底重传）
  const since = new Date(Math.min(...events.map((event) => event.occurredAt.getTime())) - 24 * 60 * 60 * 1000);
  const existing = await db.readingEvent.findMany({
    where: { deviceId, occurredAt: { gte: since } },
    select: { kind: true, version: true, book: true, chapter: true, occurredAt: true },
  });
  const keyOf = (e: { kind: string; version: string; book: string; chapter: number; occurredAt: Date }) =>
    `${e.kind}|${e.version}|${e.book}|${e.chapter}|${formatDate(e.occurredAt)}`;
  const seen = new Set(existing.map(keyOf));
  const perDay = new Map<string, number>();
  for (const e of existing) perDay.set(formatDate(e.occurredAt), (perDay.get(formatDate(e.occurredAt)) ?? 0) + 1);

  const fresh = [];
  for (const event of events) {
    const key = keyOf(event);
    const day = formatDate(event.occurredAt);
    if (seen.has(key) || (perDay.get(day) ?? 0) >= MAX_PER_DEVICE_PER_DAY) continue;
    seen.add(key);
    perDay.set(day, (perDay.get(day) ?? 0) + 1);
    fresh.push({ ...event, deviceId, platform, userId: user?.id ?? null });
  }
  if (fresh.length) await db.readingEvent.createMany({ data: fresh });
  return NextResponse.json({ ok: true, accepted: fresh.length });
}
