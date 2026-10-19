// 网页版和 App 的笔记要互通，但两边的数据形状本来不一样：
//   网页版：{ id, ref: "创世记 1:1", refs: ["gen-1-1"], text, date }，整包当 JSON 存
//   App  ：{ id, book, chapter, verse, content, createdAt }，结构化按经节存
// 这里做双向翻译，两端共用同一张 Note 表。
import { BOOKS } from "@/lib/bible-books";

export type WebNote = {
  id?: string;
  ref?: string;
  refs?: string[];
  text?: string;
  date?: string;
  // 慧读问答笔记没有 text，只有下面三项；它进不了共享 Note 表（App 侧按纯文本读），
  // 但必须原样回传给网页版，否则同步一次就丢一次。
  type?: string;
  question?: string;
  answer?: string;
};

const BOOK_BY_CODE = new Map(BOOKS.map((book) => [book.code, book]));

/** "gen-1-1" → { book: "gen", chapter: 1, verse: 1 } */
export function parseVerseRef(value: string) {
  const match = /^([a-z0-9]+)-(\d+)-(\d+)$/i.exec(value.trim());
  if (!match) return null;
  const book = match[1].toLowerCase();
  if (!BOOK_BY_CODE.has(book)) return null;
  const chapter = Number(match[2]);
  const verse = Number(match[3]);
  if (!Number.isInteger(chapter) || !Number.isInteger(verse)) return null;
  return { book, chapter, verse };
}

/** 反向拼出网页版展示用的中文引用，如 "创世记 1:1"。 */
export function verseRefLabel(book: string, chapter: number, verse: number) {
  return `${BOOK_BY_CODE.get(book)?.zh ?? book} ${chapter}:${verse}`;
}

export function toStoredNote(webNote: WebNote, fallbackId: string) {
  const text = (webNote.text ?? "").trim();
  if (!text) return null;
  // 网页版的笔记可以跨多节，App 按单节存；取第一节做锚点，
  // 其余经节引用会在正文里由用户自己写明，不额外造字段。
  const firstRef = (webNote.refs ?? []).map((ref) => parseVerseRef(ref)).find(Boolean);
  if (!firstRef) return null; // 无经文的散记留在网页版本地，见 route 里的说明
  const createdAt = webNote.date ? new Date(webNote.date) : new Date();
  return {
    id: (webNote.id ?? fallbackId).slice(0, 100),
    book: firstRef.book,
    chapter: firstRef.chapter,
    verse: firstRef.verse,
    content: text.slice(0, 10_000),
    createdAt: Number.isNaN(createdAt.getTime()) ? new Date() : createdAt,
  };
}

export function toWebNote(stored: {
  id: string;
  book: string;
  chapter: number;
  verse: number;
  content: string;
  createdAt: Date;
}): WebNote {
  const ref = `${stored.book}-${stored.chapter}-${stored.verse}`;
  return {
    id: stored.id,
    ref: verseRefLabel(stored.book, stored.chapter, stored.verse),
    refs: [ref],
    text: stored.content,
    date: stored.createdAt.toISOString().slice(0, 10),
  };
}
