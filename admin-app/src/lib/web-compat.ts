import { readFile } from "node:fs/promises";
import path from "node:path";

// 网页版前端（web-app/js/app.js）原本对接 FastAPI，整合后改由 admin-app 提供接口。
// 这一层只负责把 admin-app 的数据翻译成网页版前端已经在用的字段名，
// 从而做到「前端 UI 一行不改，只换 apiBase」。

/** 仓库根目录下的 data/，与 App 端共用同一份圣经数据。 */
export function bibleDataRoot() {
  return path.resolve(
    process.env.BIBLE_DATA_DIR ?? path.join(process.cwd(), "..", "data"),
  );
}

// 历史数据里部分书卷缩写与前端标准 code 不一致，沿用网页版的规范化表。
const BOOK_CODE_NORMALIZE: Record<string, string> = {
  matt: "mat",
  mar: "mrk",
  joh: "jhn",
  "1jo": "1jn",
  "2jo": "2jn",
  "3jo": "3jn",
  eze: "ezk",
  jam: "jas",
  phi: "php",
  php: "php",
  sos: "sng",
  son: "sng",
  jol: "joe",
  nam: "nah",
  mrk: "mrk",
};

export function normalizeBookCode(code: string) {
  const lower = code.trim().toLowerCase();
  return BOOK_CODE_NORMALIZE[lower] ?? lower;
}

type RawVerse = { verse: number; text: string; heading?: string | null };
type RawChapter = { chapter: number; verses: RawVerse[] };
type RawBook = { book?: string; abbr?: string; chapters: RawChapter[] };

const bookCache = new Map<string, RawBook | null>();

export async function loadBookJson(version: string, book: string) {
  const safeVersion = version.replace(/[^a-z0-9_-]/gi, "");
  const safeBook = normalizeBookCode(book).replace(/[^a-z0-9]/gi, "");
  if (!safeVersion || !safeBook) return null;
  const cacheKey = `${safeVersion}/${safeBook}`;
  const cached = bookCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const filePath = path.join(bibleDataRoot(), "bible", safeVersion, `${safeBook}.json`);
  try {
    const parsed = JSON.parse(await readFile(filePath, "utf8")) as RawBook;
    bookCache.set(cacheKey, parsed);
    return parsed;
  } catch {
    bookCache.set(cacheKey, null);
    return null;
  }
}

/** 网页版 /verses/public 的返回形状：verses[].{verse,text,heading} */
export async function chapterVerses(version: string, book: string, chapter: number) {
  const parsed = await loadBookJson(version, book);
  if (!parsed) return [];
  const target = parsed.chapters.find((item) => item.chapter === chapter);
  if (!target) return [];
  return target.verses
    .filter((verse) => (verse.text ?? "").trim())
    .map((verse) => ({
      verse: verse.verse,
      text: verse.text.trim(),
      heading: verse.heading ?? null,
    }));
}

export function jsonError(message: string, status = 400) {
  return Response.json({ detail: message, msg: message }, { status });
}
