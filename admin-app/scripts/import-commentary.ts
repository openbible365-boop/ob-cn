// 把 data/commentary/jingdu/*.json 导入 CommentaryEntry 表。
//
// 导入后数据库成为编辑与校对的唯一真相来源；前端仍读静态 JSON，
// 由后台「发布」动作导出回文件（见 src/lib/actions/commentary.ts）。
//
//   npm run import:commentary          # 首次导入（表非空时中止）
//   npm run import:commentary -- --force   # 清空重导
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";

type RawEntry = { type?: string; verses?: string; text?: string; html?: string };

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const DATA_DIR = path.resolve(
  process.env.BIBLE_DATA_DIR ?? path.join(process.cwd(), "..", "data"),
  "commentary/jingdu",
);

/** 解析 "3:1-21" / "11:18,19" / "3:16" → 起止节；解析不出时退回 0，排序时排在最后。 */
export function parseRange(verses: string) {
  const m = /^(\d+):(\d+)(?:\s*[-–,]\s*(?:(\d+):)?(\d+))?/.exec(verses.trim());
  if (!m) return { rangeStart: 0, rangeEnd: 0 };
  const startVerse = Number(m[2]);
  const endVerse = m[4] ? Number(m[4]) : startVerse;
  return { rangeStart: startVerse, rangeEnd: Math.max(startVerse, endVerse) };
}

function deobfuscate(text: string): string {
  let b64 = "";
  for (let i = 0; i < text.length; i++) {
    b64 += String.fromCharCode(text.charCodeAt(i) ^ 0x2a);
  }
  return Buffer.from(b64, "base64").toString("utf8");
}

async function main() {
  const force = process.argv.includes("--force");
  const existing = await db.commentaryEntry.count();
  if (existing > 0 && !force) {
    console.error(`CommentaryEntry 已有 ${existing} 条。加 --force 可清空重导。`);
    process.exit(1);
  }
  if (force && existing > 0) {
    // 修订记录随条目级联删除
    await db.commentaryEntry.deleteMany({});
    console.log(`已清空 ${existing} 条旧数据`);
  }

  const files = (await readdir(DATA_DIR))
    .filter((f) => /^\d+\.json$/.test(f))
    .sort((a, b) => Number.parseInt(a, 10) - Number.parseInt(b, 10));

  let total = 0;
  for (const file of files) {
    const bookOrder = Number.parseInt(file, 10);
    const content = await readFile(path.join(DATA_DIR, file), "utf8");
    let parsed: Record<string, RawEntry[]> = {};
    if (content.trim().startsWith("{")) {
      parsed = JSON.parse(content);
    } else {
      parsed = JSON.parse(deobfuscate(content));
    }

    const rows: {
      bookOrder: number; chapter: number; entryType: string; verses: string;
      rangeStart: number; rangeEnd: number; sortOrder: number; text: string; html: string;
    }[] = [];

    for (const [chapterKey, entries] of Object.entries(parsed)) {
      const chapter = Number.parseInt(chapterKey, 10);
      if (!Number.isFinite(chapter)) continue;
      entries.forEach((entry, index) => {
        const text = (entry.text ?? "").trim();
        if (!text) return;
        const verses = (entry.verses ?? "").trim();
        rows.push({
          bookOrder,
          chapter,
          entryType: entry.type === "overview" ? "overview" : "commentary",
          verses,
          ...parseRange(verses),
          // 原始文件内的顺序，导出时据此还原
          sortOrder: index,
          text,
          html: (entry.html ?? "").trim(),
        });
      });
    }

    // 分批写入，避免单条语句过大
    for (let i = 0; i < rows.length; i += 500) {
      await db.commentaryEntry.createMany({ data: rows.slice(i, i + 500) });
    }
    total += rows.length;
    process.stdout.write(`\r已导入 ${total.toLocaleString()} 条（第 ${bookOrder}/66 卷）`);
  }

  console.log(`\n完成：${total.toLocaleString()} 条`);
  await db.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await db.$disconnect();
  process.exit(1);
});
