// Real scripture data: 7 translations × 66 books served as static JSON from
// /data (see repo-level data/, symlinked into public/). Book files are
// fetched on demand and cached in memory; the reading position (translation +
// book) persists to localStorage.
import { load, save } from "./store";
import manifest from "./manifest.json";
import { cachedResponse } from "./offline-bible";

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

// 长书名在顶栏窄芯片里放不下（帖撒罗尼迦前书 7 字会把箭头挤出裁切）。
// 芯片展示用教会通用简称；选择器、分享卡、朗读标签等场景仍用全名。
const ZH_CHIP_ABBREVIATIONS: Record<string, string> = {
  "1sa": "撒上",
  "2sa": "撒下",
  lam: "哀歌",
  oba: "俄巴底亚",
  zec: "撒迦利亚",
  "1co": "林前",
  "2co": "林后",
  "1th": "帖前",
  "2th": "帖后",
  "1ti": "提前",
  "2ti": "提后",
};

export function bookChipName(book: Book, version: Version): string {
  if (version.lang === "zh" && ZH_CHIP_ABBREVIATIONS[book.code]) {
    return ZH_CHIP_ABBREVIATIONS[book.code];
  }
  return bookName(book, version);
}

// ---------- reading position ----------

// verse 是章内书签：滚动时记录视口顶部的节号，下次进同一章时静默定位回去
type Reading = { version: string; book: string; chapter: number; verse?: number };
const READING_KEY = "ob.reading";

export function getReading(): Reading {
  const r = load<Partial<Reading>>(READING_KEY, {});
  return {
    version: r.version ?? "cuv",
    book: r.book ?? "jhn",
    chapter: r.chapter ?? defaultChapterFor(r.book ?? "jhn"),
    verse: typeof r.verse === "number" && r.verse > 1 ? r.verse : undefined,
  };
}

export function setReading(reading: Reading) {
  save(READING_KEY, reading);
}

// The demo design opens on John 3; every other book starts at chapter 1.
export function defaultChapterFor(bookCode: string): number {
  return bookCode === "jhn" ? 3 : 1;
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
    const folder = versionCode === "pinyin" ? "pinyin2" : versionCode;
    const url = `/data/bible/${folder}/${bookCode}.json`;
    // 离线优先：在「资源管理」下载过的译本直接读本机缓存，无网络也能翻书
    promise = cachedResponse(url)
      .then((cached) => cached ?? fetch(url))
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

function deobfuscate(text: string): Record<string, JingduEntry[]> {
  const raw = atob(text.trim());
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    bytes[i] = raw.charCodeAt(i) ^ 0x2a;
  }
  return JSON.parse(new TextDecoder("utf-8").decode(bytes)) as Record<string, JingduEntry[]>;
}

function loadJingdu(bookOrder: number) {
  let promise = commentaryCache.get(bookOrder);
  if (!promise) {
    const url = `/data/commentary/jingdu/${bookOrder}.json`;
    // 与 loadBook 同理：注释包下载过就读本机缓存，离线也能看注释
    promise = cachedResponse(url)
      .then((cached) => cached ?? fetch(url))
      .then((r) => {
        if (!r.ok) throw new Error(`load jingdu ${bookOrder}: HTTP ${r.status}`);
        return r.text().then((text) => deobfuscate(text));
      });
    commentaryCache.set(bookOrder, promise);
    promise.catch(() => commentaryCache.delete(bookOrder));
  }
  return promise;
}

// 注释数据源的中文标点是半角（"冬天下雨,其降雨量"），排版观感差。
// 与网页端 zhTypeset 同一套归一规则：两个汉字之间的 , ; : ? ! 转全角。
const CJK_CLASS = "[一-鿿　-〿？！；：、」』）]";
const CJK_OPEN = CJK_CLASS.replace("]", "「『（]");
const PUNCT_RULES: Array<[RegExp, string]> = [
  [new RegExp(`(${CJK_CLASS}),(?=${CJK_OPEN})`, "g"), "$1，"],
  [new RegExp(`(${CJK_CLASS});(?=${CJK_CLASS})`, "g"), "$1；"],
  [new RegExp(`(${CJK_CLASS}):(?=${CJK_CLASS})`, "g"), "$1："],
  [new RegExp(`(${CJK_CLASS})[?](?=${CJK_CLASS})`, "g"), "$1？"],
  [new RegExp(`(${CJK_CLASS})[!](?=${CJK_CLASS})`, "g"), "$1！"],
];

function zhTypeset(text: string): string {
  return PUNCT_RULES.reduce((value, [pattern, replacement]) => value.replace(pattern, replacement), text);
}

// 书卷绪论：注释包的 "0" 章键（概述/标题/作者/综览/大纲…依原书顺序）
export async function loadIntroduction(bookOrder: number): Promise<CommentarySection[]> {
  const file = await loadJingdu(bookOrder);
  return (file["0"] ?? [])
    .filter((e) => e.text?.trim())
    .map((e) => ({ title: e.verses, body: zhTypeset(e.text.trim()) }));
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
      body: zhTypeset(e.text.trim()),
    }));
}
