import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// 资料库公开读取接口：百科（词典/文章/灵修）、影音库、属灵阶段问题、支持计划。
// 网页版与 App 共用这一套，管理端在 /admin 维护内容。
export const runtime = "nodejs";

const ENTRY_TYPES = ["DICTIONARY", "ARTICLE", "DEVOTIONAL"] as const;
const MEDIA_TYPES = ["VIDEO", "AUDIO"] as const;

type EntryType = (typeof ENTRY_TYPES)[number];
type MediaType = (typeof MEDIA_TYPES)[number];

function error(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const section = url.searchParams.get("section") ?? "encyclopedia";
  const keyword = url.searchParams.get("q")?.trim().slice(0, 60) ?? "";

  if (section === "encyclopedia") {
    const entryType = url.searchParams.get("type");
    if (entryType && !ENTRY_TYPES.includes(entryType as EntryType)) {
      return error("百科类型不正确");
    }
    const indexLetter = url.searchParams.get("letter");
    const entries = await db.encyclopediaEntry.findMany({
      where: {
        isActive: true,
        ...(entryType ? { entryType: entryType as EntryType } : {}),
        ...(indexLetter ? { indexLetter } : {}),
        ...(keyword
          ? {
              OR: [
                { titleZh: { contains: keyword, mode: "insensitive" } },
                { titleEn: { contains: keyword, mode: "insensitive" } },
                { titleKo: { contains: keyword, mode: "insensitive" } },
                { summaryZh: { contains: keyword, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      // 列表不返回正文，正文由详情接口按需取，避免列表响应过大。
      select: {
        id: true,
        entryType: true,
        category: true,
        indexLetter: true,
        coverStyle: true,
        author: true,
        titleZh: true,
        titleEn: true,
        titleKo: true,
        summaryZh: true,
        summaryEn: true,
        summaryKo: true,
        updatedAt: true,
      },
      orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }],
      take: 200,
    });
    return NextResponse.json({ ok: true, entries });
  }

  if (section === "entry") {
    const id = url.searchParams.get("id") ?? "";
    if (!id) return error("缺少百科条目编号");
    const entry = await db.encyclopediaEntry.findFirst({
      where: { id, isActive: true },
    });
    if (!entry) return error("这个条目不存在或已下架", 404);
    return NextResponse.json({ ok: true, entry });
  }

  if (section === "media") {
    const mediaType = url.searchParams.get("type");
    if (mediaType && !MEDIA_TYPES.includes(mediaType as MediaType)) {
      return error("影音类型不正确");
    }
    const items = await db.mediaItem.findMany({
      where: {
        isActive: true,
        ...(mediaType ? { mediaType: mediaType as MediaType } : {}),
        ...(keyword
          ? {
              OR: [
                { title: { contains: keyword, mode: "insensitive" } },
                { series: { contains: keyword, mode: "insensitive" } },
                { teacher: { contains: keyword, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      take: 200,
    });
    return NextResponse.json({ ok: true, items });
  }

  if (section === "spiritual") {
    const stages = await db.spiritualStage.findMany({
      orderBy: { sortOrder: "asc" },
      include: {
        questions: {
          where: { isActive: true },
          orderBy: { sortOrder: "asc" },
          select: {
            id: true,
            questionText: true,
            category: true,
            description: true,
          },
        },
      },
    });
    return NextResponse.json({ ok: true, stages });
  }

  if (section === "support-plans") {
    const plans = await db.supportPlan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    });
    return NextResponse.json({ ok: true, plans });
  }

  return error("不支持的资料库栏目");
}
