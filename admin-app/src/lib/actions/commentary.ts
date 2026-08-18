"use server";

import { writeFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { requireRole } from "@/lib/authz";
import { bibleDataRoot } from "@/lib/web-compat";

/** 解析 "3:1-21" / "11:18,19" → 起止节，与导入脚本保持一致。 */
function parseRange(verses: string) {
  const m = /^(\d+):(\d+)(?:\s*[-–,]\s*(?:(\d+):)?(\d+))?/.exec(verses.trim());
  if (!m) return { rangeStart: 0, rangeEnd: 0 };
  const start = Number(m[2]);
  const end = m[4] ? Number(m[4]) : start;
  return { rangeStart: start, rangeEnd: Math.max(start, end) };
}

/** 保存单条注释：写入正文并留痕。 */
export async function saveCommentaryEntry(formData: FormData) {
  const session = await requireRole(["SUPER_ADMIN", "MODERATOR"]);
  const id = String(formData.get("id") ?? "");
  const text = String(formData.get("text") ?? "").trim();
  const verses = String(formData.get("verses") ?? "").trim();
  const status = String(formData.get("status") ?? "DRAFT");
  if (!id) throw new Error("缺少条目 id");
  if (!text) throw new Error("注释正文不能为空");
  if (text.length > 20_000) throw new Error("注释正文过长");
  if (!["DRAFT", "REVIEWED", "PUBLISHED"].includes(status)) throw new Error("状态不正确");

  const before = await db.commentaryEntry.findUniqueOrThrow({ where: { id } });

  await db.$transaction([
    db.commentaryEntry.update({
      where: { id },
      data: {
        text,
        verses: verses || before.verses,
        ...parseRange(verses || before.verses),
        status,
        // html 与纯文本保持同源：编辑的是纯文本，导出时用段落包一层
        html: `<p>${text.replace(/\n{2,}/g, "</p><p>").replace(/\n/g, "<br>")}</p>`,
      },
    }),
    // 只在正文真的变了时留痕，避免仅改状态也刷出一条修订
    ...(before.text !== text
      ? [
          db.commentaryRevision.create({
            data: {
              entryId: id,
              beforeText: before.text,
              afterText: text,
              operatorId: session.user.id,
            },
          }),
        ]
      : []),
  ]);

  await logAudit({
    operatorId: session.user.id,
    action: "编辑注释",
    targetType: "CommentaryEntry",
    targetId: id,
    detail: `第 ${before.bookOrder} 卷 ${before.chapter} 章 ${before.verses} · ${status}`,
  });

  revalidatePath("/admin/commentary");
}

/** 批量标记本章条目的校对状态。 */
export async function markChapterStatus(formData: FormData) {
  const session = await requireRole(["SUPER_ADMIN", "MODERATOR"]);
  const bookOrder = Number(formData.get("bookOrder"));
  const chapter = Number(formData.get("chapter"));
  const status = String(formData.get("status") ?? "");
  if (!Number.isFinite(bookOrder) || !Number.isFinite(chapter)) throw new Error("卷章参数不正确");
  if (!["DRAFT", "REVIEWED", "PUBLISHED"].includes(status)) throw new Error("状态不正确");

  const { count } = await db.commentaryEntry.updateMany({
    where: { bookOrder, chapter },
    data: { status },
  });

  await logAudit({
    operatorId: session.user.id,
    action: "批量标记注释状态",
    targetType: "CommentaryEntry",
    targetId: `${bookOrder}:${chapter}`,
    detail: `${count} 条 → ${status}`,
  });

  revalidatePath("/admin/commentary");
}

/**
 * 发布：把数据库内容导出回 data/commentary/jingdu/*.json。
 *
 * 前端（App 与网页版）读的仍是这些静态文件，所以编辑后必须发布才对读者生效——
 * 这正是方案 C 的用意：校对期间的改动不会立刻影响线上。
 */
function obfuscate(content: string): string {
  const rawBytes = Buffer.from(content, "utf8");
  const obfuscatedBytes = Buffer.alloc(rawBytes.length);
  for (let i = 0; i < rawBytes.length; i++) {
    obfuscatedBytes[i] = rawBytes[i] ^ 0x2a;
  }
  return obfuscatedBytes.toString("base64");
}

export async function publishCommentary(formData: FormData) {
  const session = await requireRole(["SUPER_ADMIN"]);
  const scope = String(formData.get("bookOrder") ?? "all");
  const dir = path.join(bibleDataRoot(), "commentary/jingdu");

  const books = scope === "all"
    ? (await db.commentaryEntry.findMany({
        distinct: ["bookOrder"],
        select: { bookOrder: true },
        orderBy: { bookOrder: "asc" },
      })).map((r) => r.bookOrder)
    : [Number(scope)];

  let written = 0;
  for (const bookOrder of books) {
    if (!Number.isFinite(bookOrder)) continue;
    const entries = await db.commentaryEntry.findMany({
      where: { bookOrder },
      orderBy: [{ chapter: "asc" }, { sortOrder: "asc" }],
    });
    if (entries.length === 0) continue;

    // 还原成原始文件结构：{ "章号": [ {type, verses, text, html}, ... ] }
    const byChapter: Record<string, { type: string; verses: string; text: string; html: string }[]> = {};
    for (const e of entries) {
      (byChapter[String(e.chapter)] ??= []).push({
        type: e.entryType,
        verses: e.verses,
        text: e.text,
        html: e.html,
      });
    }

    const obfuscated = obfuscate(JSON.stringify(byChapter, null, 0));
    await writeFile(
      path.join(dir, `${bookOrder}.json`),
      obfuscated,
      "utf8",
    );
    written += 1;

    // 发布后本卷全部转为已发布
    await db.commentaryEntry.updateMany({
      where: { bookOrder },
      data: { status: "PUBLISHED" },
    });
  }

  await logAudit({
    operatorId: session.user.id,
    action: "发布注释",
    targetType: "CommentaryEntry",
    targetId: scope,
    detail: `导出 ${written} 卷到静态文件`,
  });

  revalidatePath("/admin/commentary");
}
