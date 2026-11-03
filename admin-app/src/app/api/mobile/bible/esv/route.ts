import { NextResponse } from "next/server";

export const runtime = "nodejs";

// ESV 在线查经代理（Crossway 官方 API，api.esv.org）。
// 按版权条款：App 不离线存储 ESV 全文，只按章在线取；服务端仅做短时内存缓存。
// 启用方式：到 https://api.esv.org 免费申请 key，写入环境变量 ESV_API_KEY。
// 免费额度：每天 5000 次查询——配合下面的章级缓存足够个人应用使用。

// 书卷码（项目统一编码）→ ESV API 的书名
const ESV_BOOK_NAMES: Record<string, string> = {
  gen: "Genesis", exo: "Exodus", lev: "Leviticus", num: "Numbers", deu: "Deuteronomy",
  jos: "Joshua", jdg: "Judges", rut: "Ruth", "1sa": "1 Samuel", "2sa": "2 Samuel",
  "1ki": "1 Kings", "2ki": "2 Kings", "1ch": "1 Chronicles", "2ch": "2 Chronicles",
  ezr: "Ezra", neh: "Nehemiah", est: "Esther", job: "Job", psa: "Psalm", pro: "Proverbs",
  ecc: "Ecclesiastes", sng: "Song of Solomon", isa: "Isaiah", jer: "Jeremiah",
  lam: "Lamentations", ezk: "Ezekiel", dan: "Daniel", hos: "Hosea", joe: "Joel",
  amo: "Amos", oba: "Obadiah", jon: "Jonah", mic: "Micah", nah: "Nahum",
  hab: "Habakkuk", zep: "Zephaniah", hag: "Haggai", zec: "Zechariah", mal: "Malachi",
  mat: "Matthew", mrk: "Mark", luk: "Luke", jhn: "John", act: "Acts", rom: "Romans",
  "1co": "1 Corinthians", "2co": "2 Corinthians", gal: "Galatians", eph: "Ephesians",
  php: "Philippians", col: "Colossians", "1th": "1 Thessalonians", "2th": "2 Thessalonians",
  "1ti": "1 Timothy", "2ti": "2 Timothy", tit: "Titus", phm: "Philemon", heb: "Hebrews",
  jas: "James", "1pe": "1 Peter", "2pe": "2 Peter", "1jn": "1 John", "2jn": "2 John",
  "3jn": "3 John", jud: "Jude", rev: "Revelation",
};

type CachedChapter = { at: number; verses: { verse: number; text: string }[] };
const cache = new Map<string, CachedChapter>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 短时缓存：条款允许 temporary caching
const CACHE_MAX = 300;

export async function GET(request: Request) {
  const apiKey = process.env.ESV_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, message: "ESV 在线查经未配置（需在服务器设置 ESV_API_KEY）" },
      { status: 503 },
    );
  }

  const url = new URL(request.url);
  const book = String(url.searchParams.get("book") ?? "");
  const chapter = Number(url.searchParams.get("chapter"));
  const bookName = ESV_BOOK_NAMES[book];
  if (!bookName || !Number.isInteger(chapter) || chapter < 1 || chapter > 200) {
    return NextResponse.json({ ok: false, message: "无效的书卷或章号" }, { status: 400 });
  }

  const cacheKey = `${book}.${chapter}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return NextResponse.json({ ok: true, verses: hit.verses, cached: true });
  }

  const query = new URLSearchParams({
    q: `${bookName} ${chapter}`,
    "include-passage-references": "false",
    "include-footnotes": "false",
    "include-headings": "false",
    "include-short-copyright": "false",
    "include-verse-numbers": "true",
    "indent-poetry": "false",
    "indent-paragraphs": "0",
  });
  const upstream = await fetch(`https://api.esv.org/v3/passage/text/?${query}`, {
    headers: { Authorization: `Token ${apiKey}` },
  });
  if (!upstream.ok) {
    return NextResponse.json(
      { ok: false, message: `ESV 服务暂不可用（${upstream.status}）` },
      { status: 502 },
    );
  }
  const data = (await upstream.json()) as { passages?: string[] };
  const passage = data.passages?.[0] ?? "";
  // 文本形如 "[1] In the beginning... [2] ..."：按节号标记切分
  const verses: { verse: number; text: string }[] = [];
  const re = /\[(\d+)\]\s*([^[]*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(passage))) {
    const text = m[2].replace(/\s+/g, " ").trim();
    if (text) verses.push({ verse: Number(m[1]), text });
  }
  if (verses.length === 0) {
    return NextResponse.json({ ok: false, message: "未取得经文" }, { status: 502 });
  }

  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(cacheKey, { at: Date.now(), verses });
  return NextResponse.json({ ok: true, verses });
}
