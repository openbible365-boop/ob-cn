// Real scripture data: 7 translations × 66 books served as static JSON from
// /data (see repo-level data/, symlinked into public/). Book files are
// fetched on demand and cached in memory; the reading position (translation +
// book) persists to localStorage.
import { load, save } from "./store";
import manifest from "./manifest.json";

export type Version = { code: string; label: string; lang: "zh" | "ko" | "en" };
export type Book = {
  order: number;
  code: string;
  zh: string;
  ko: string;
  en: string;
  chapters: number;
};

export const VERSIONS = manifest.versions as Version[];
export const BOOKS = manifest.books as Book[];

export const OT_BOOKS = BOOKS.slice(0, 39);
export const NT_BOOKS = BOOKS.slice(39);

export function getVersion(code: string | null | undefined): Version {
  return VERSIONS.find((v) => v.code === code) ?? VERSIONS[0];
}

export function getBookByCode(code: string | null | undefined): Book {
  return BOOKS.find((b) => b.code === code) ?? BOOKS[42]; // 约翰福音
}

export function bookName(book: Book, version: Version): string {
  return book[version.lang];
}

// ---------- reading position ----------

type Reading = { version: string; book: string };
const READING_KEY = "ob.reading";

export function getReading(): Reading {
  return load<Reading>(READING_KEY, { version: "cuv", book: "jhn" });
}

export function setReading(reading: Reading) {
  save(READING_KEY, reading);
}

// ---------- book text ----------

export type Verse = {
  verse: number; // numeric start (和合本 merges a few verses, e.g. "4-5")
  label: string; // display label, usually same as verse
  text: string; // may contain <mark>/<ruby> markup — render as HTML
  heading?: string; // section heading shown before this verse
};

export type BookData = { maxChapter: number; chapters: Map<number, Verse[]> };

type RawBook = {
  chapters: {
    chapter: number;
    verses: { verse: number | string; text: string; heading?: string }[];
  }[];
};

const bookCache = new Map<string, Promise<BookData>>();

export function loadBook(versionCode: string, bookCode: string): Promise<BookData> {
  const key = `${versionCode}/${bookCode}`;
  let promise = bookCache.get(key);
  if (!promise) {
    promise = fetch(`/data/bible/${versionCode}/${bookCode}.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`load ${key}: HTTP ${r.status}`);
        return r.json() as Promise<RawBook>;
      })
      .then((raw) => {
        const chapters = new Map<number, Verse[]>();
        for (const ch of raw.chapters) {
          chapters.set(
            ch.chapter,
            ch.verses
              .map((v) => ({
                verse: typeof v.verse === "number" ? v.verse : parseInt(v.verse, 10),
                label: String(v.verse),
                text: v.text,
                heading: v.heading,
              }))
              .filter((v) => Number.isInteger(v.verse) && v.text),
          );
        }
        return { maxChapter: raw.chapters.length, chapters };
      });
    bookCache.set(key, promise);
    promise.catch(() => bookCache.delete(key)); // allow retry after a failure
  }
  return promise;
}

export function stripHtml(text: string): string {
  return text
    .replace(/<rt[^>]*>.*?<\/rt>/g, "") // drop pinyin annotations entirely
    .replace(/<[^>]+>/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// ---------- 精读本注释 (jingdu commentary) ----------

export type CommentarySection = {
  title: string;
  body: string;
  highlight?: boolean;
};

type JingduEntry = { type: string; verses: string; text: string };

const commentaryCache = new Map<number, Promise<Record<string, JingduEntry[]>>>();

function loadJingdu(bookOrder: number) {
  let promise = commentaryCache.get(bookOrder);
  if (!promise) {
    promise = fetch(`/data/commentary/jingdu/${bookOrder}.json`).then((r) => {
      if (!r.ok) throw new Error(`load jingdu ${bookOrder}: HTTP ${r.status}`);
      return r.json() as Promise<Record<string, JingduEntry[]>>;
    });
    commentaryCache.set(bookOrder, promise);
    promise.catch(() => commentaryCache.delete(bookOrder));
  }
  return promise;
}

export async function loadCommentary(
  bookOrder: number,
  chapter: number,
): Promise<CommentarySection[]> {
  const file = await loadJingdu(bookOrder);
  const entries = file[String(chapter)] ?? [];
  return entries
    .filter((e) => e.text?.trim())
    .map((e) => ({
      title: e.type === "overview" ? `${e.verses} · 段落综览` : e.verses,
      body: e.text.trim(),
    }));
}
