"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/current-user";
import { HIGHLIGHT_COLORS } from "@/lib/reading-constants";

export async function setHighlight(formData: FormData) {
  const user = await requireUser();
  const book = String(formData.get("book"));
  const chapter = Number(formData.get("chapter"));
  const verse = Number(formData.get("verse"));
  const color = String(formData.get("color"));
  if (!HIGHLIGHT_COLORS.includes(color)) throw new Error("颜色不合法");

  await db.highlight.upsert({
    where: { userId_book_chapter_verse: { userId: user.id, book, chapter, verse } },
    update: { color },
    create: { userId: user.id, book, chapter, verse, color },
  });

  revalidatePath("/bible");
}

export async function clearHighlight(formData: FormData) {
  const user = await requireUser();
  const book = String(formData.get("book"));
  const chapter = Number(formData.get("chapter"));
  const verse = Number(formData.get("verse"));

  await db.highlight.deleteMany({ where: { userId: user.id, book, chapter, verse } });

  revalidatePath("/bible");
}

export async function addNote(formData: FormData) {
  const user = await requireUser();
  const book = String(formData.get("book"));
  const chapter = Number(formData.get("chapter"));
  const verse = Number(formData.get("verse"));
  const content = String(formData.get("content") ?? "").trim();
  if (!content) throw new Error("笔记内容不能为空");

  await db.note.create({
    data: { userId: user.id, book, chapter, verse, content },
  });

  revalidatePath("/bible");
}
