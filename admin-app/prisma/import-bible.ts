// Import the full bible corpus (7 translations × 66 books) and the 精读本
// (jingdu) commentary from the repo-level data/ directory into Postgres.
// Replaces whatever Verse/Commentary rows exist — safe to re-run.
//
//   npx tsx prisma/import-bible.ts
//   BIBLE_DATA_DIR=/data npx tsx prisma/import-bible.ts   (in the container)
import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });

const DATA_DIR = process.env.BIBLE_DATA_DIR ?? join(__dirname, "..", "..", "data");

type Manifest = {
  versions: { code: string; label: string; lang: "zh" | "ko" | "en" }[];
  books: { order: number; code: string; zh: string; ko: string; en: string; chapters: number }[];
};

type BookFile = {
  // 和合本 merges a few verses ("4-5") — verse can be a string range.
  chapters: { chapter: number; verses: { verse: number | string; text: string }[] }[];
};

type JingduEntry = { type: string; verses: string; text: string };

const readJson = <T>(...parts: string[]): T =>
  JSON.parse(readFileSync(join(DATA_DIR, ...parts), "utf-8")) as T;

// 拼音和合本 keeps its <ruby> markup (rendered as HTML); every translation
// drops the <mark>/<span> wrappers, which the reader UI does not use.
function cleanText(text: string, keepRuby: boolean): string {
  let t = text;
  if (!keepRuby) {
    t = t.replace(/<[^>]+>/g, "");
  } else {
    t = t.replace(/<\/?mark[^>]*>/g, "");
  }
  return t.replace(/\s{2,}/g, " ").trim();
}

// "3:5" | "3:22-30" | "1:19-2:11" | "4:25,26" → verse span within `chapter`.
// A range that runs past the current chapter is clamped to 999 (= chapter end).
function parseRange(verses: string, chapter: number): { start: number; end: number } {
  const m = verses.match(/^(\d+):(\d+)(?:[-,](?:(\d+):)?(\d+))?$/);
  if (!m) return { start: 1, end: 999 };
  const start = Number(m[2]);
  if (!m[4]) return { start, end: start };
  const endChapter = m[3] ? Number(m[3]) : chapter;
  return { start, end: endChapter === chapter ? Number(m[4]) : 999 };
}

const BATCH = 5000;

async function importVerses(manifest: Manifest) {
  await db.verse.deleteMany();
  let total = 0;
  for (const version of manifest.versions) {
    const rows: {
      translation: string;
      book: string;
      bookOrder: number;
      chapter: number;
      verse: number;
      text: string;
    }[] = [];
    for (const book of manifest.books) {
      const file = readJson<BookFile>("bible", version.code, `${book.code}.json`);
      const bookName = book[version.lang];
      for (const ch of file.chapters) {
        for (const v of ch.verses) {
          const text = cleanText(v.text, version.code === "pinyin");
          const verse = typeof v.verse === "number" ? v.verse : parseInt(v.verse, 10);
          if (!text || !Number.isInteger(verse)) continue;
          rows.push({
            translation: version.code,
            book: bookName,
            bookOrder: book.order,
            chapter: ch.chapter,
            verse,
            text,
          });
        }
      }
    }
    for (let i = 0; i < rows.length; i += BATCH) {
      await db.verse.createMany({ data: rows.slice(i, i + BATCH), skipDuplicates: true });
    }
    total += rows.length;
    console.log(`${version.code} (${version.label}): ${rows.length} verses`);
  }
  console.log(`verses total: ${total}`);
}

async function importCommentary(manifest: Manifest) {
  await db.commentary.deleteMany();
  const rows: {
    book: string;
    chapter: number;
    rangeStart: number;
    rangeEnd: number;
    title: string;
    body: string;
  }[] = [];
  for (const book of manifest.books) {
    const file = readJson<Record<string, JingduEntry[]>>(
      "commentary",
      "jingdu",
      `${book.order}.json`,
    );
    for (const [chapterKey, entries] of Object.entries(file)) {
      const chapter = Number(chapterKey);
      if (!Number.isInteger(chapter)) continue;
      for (const entry of entries) {
        const body = entry.text?.trim();
        if (!body) continue;
        const { start, end } = parseRange(entry.verses, chapter);
        rows.push({
          book: book.zh, // commentary is keyed by the canonical zh book name
          chapter,
          rangeStart: start,
          rangeEnd: end,
          title: entry.type === "overview" ? `${entry.verses} · 段落综览` : entry.verses,
          body,
        });
      }
    }
  }
  for (let i = 0; i < rows.length; i += BATCH) {
    await db.commentary.createMany({ data: rows.slice(i, i + BATCH) });
  }
  console.log(`commentary total: ${rows.length}`);
}

async function main() {
  const manifest = readJson<Manifest>("manifest.json");
  await importVerses(manifest);
  await importCommentary(manifest);
  console.log("Import complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
