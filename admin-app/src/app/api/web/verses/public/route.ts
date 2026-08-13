import { chapterVerses } from "@/lib/web-compat";

export const runtime = "nodejs";

// 对应网页版原 GET /api/verses/public
export async function GET(request: Request) {
  const url = new URL(request.url);
  const version = url.searchParams.get("version") ?? "cuv";
  const book = url.searchParams.get("book") ?? "gen";
  const chapter = Math.max(1, Number(url.searchParams.get("chapter")) || 1);

  const verses = await chapterVerses(version, book, chapter);
  // 经文是静态数据，允许浏览器缓存一天，翻章回看不再重复请求
  return Response.json(
    { version, book, chapter, verses },
    { headers: { "Cache-Control": "public, max-age=86400" } },
  );
}
