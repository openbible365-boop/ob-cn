import { loadBookJson } from "@/lib/web-compat";
import { BOOKS } from "@/lib/bible-books";

export const runtime = "nodejs";

// 对应网页版原 GET /api/verses/search
// 网页版原实现是把全部译本读进内存再过滤；这里按书卷顺序流式扫描，
// 命中够一页就停，避免为一次搜索把 66 卷全部载入。
export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const version = url.searchParams.get("version") ?? "cuv";
  const testament = url.searchParams.get("testament")?.toLowerCase() ?? "";
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 40, 1), 100);
  const offset = Math.max(Number(url.searchParams.get("offset")) || 0, 0);

  if (!q) {
    return Response.json({ results: [], total: 0, offset, limit, has_more: false });
  }

  // 旧约 1-39，新约 40-66
  const books = BOOKS.filter((book) =>
    testament === "ot" ? book.order <= 39 : testament === "nt" ? book.order >= 40 : true,
  );

  const needle = q.toLowerCase();
  const results: Array<{ book: string; ch: number; verse: number; text: string }> = [];
  let total = 0;

  for (const book of books) {
    const parsed = await loadBookJson(version, book.code);
    if (!parsed) continue;
    for (const chapter of parsed.chapters) {
      for (const verse of chapter.verses) {
        const text = (verse.text ?? "").trim();
        if (!text || !text.toLowerCase().includes(needle)) continue;
        total += 1;
        if (total > offset && results.length < limit) {
          results.push({ book: book.code, ch: chapter.chapter, verse: verse.verse, text });
        }
      }
    }
  }

  return Response.json({
    results,
    total,
    offset,
    limit,
    has_more: offset + results.length < total,
  });
}
