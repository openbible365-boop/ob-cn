import { db } from "@/lib/db";
import { serializeEntry } from "@/lib/web-encyclopedia";
import type { Prisma } from "@/generated/prisma/client";

export const runtime = "nodejs";

const TYPE_BY_PARAM: Record<string, "DICTIONARY" | "ARTICLE" | "DEVOTIONAL"> = {
  dictionary: "DICTIONARY",
  article: "ARTICLE",
  devotional: "DEVOTIONAL",
};


// 对应网页版原 GET /api/encyclopedia/entries
export async function GET(request: Request) {
  const url = new URL(request.url);
  const entryType = TYPE_BY_PARAM[url.searchParams.get("entry_type")?.toLowerCase() ?? ""];
  const letter = url.searchParams.get("letter");
  const q = url.searchParams.get("q")?.trim() ?? "";
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 200, 1), 500);
  const offset = Math.max(Number(url.searchParams.get("offset")) || 0, 0);
  // 词典列表条目多且释义长，默认不带正文；详情页再单独取。
  const withContent = url.searchParams.get("with_content") === "1";

  const where: Prisma.EncyclopediaEntryWhereInput = {
    isActive: true,
    ...(entryType ? { entryType } : {}),
    ...(letter ? { indexLetter: letter } : {}),
    ...(q
      ? {
          OR: [
            { titleZh: { contains: q, mode: "insensitive" } },
            { titleEn: { contains: q, mode: "insensitive" } },
            { titleKo: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [entries, total] = await Promise.all([
    db.encyclopediaEntry.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }],
      skip: offset,
      take: limit,
    }),
    db.encyclopediaEntry.count({ where }),
  ]);

  const items = entries.map((entry) => serializeEntry(entry, withContent));
  // 词典分页走 {total, items}，其它类型前端直接当数组用。
  if (entryType === "DICTIONARY") {
    return Response.json({ total, items });
  }
  return Response.json(items);
}
