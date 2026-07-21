"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { requireRole } from "@/lib/authz";

export async function deletePost(formData: FormData) {
  const session = await requireRole(["SUPER_ADMIN", "MODERATOR"]);
  const postId = String(formData.get("postId"));

  const post = await db.post.update({
    where: { id: postId },
    data: { status: "DELETED" },
    include: { author: true },
  });

  await logAudit({
    operatorId: session.user.id,
    action: "删除帖子",
    targetType: "Post",
    targetId: post.id,
    detail: `作者 ${post.author.name} · ${post.content.slice(0, 30)}`,
  });

  revalidatePath("/admin/content");
  revalidatePath("/admin/moderation");
}

export async function hidePost(formData: FormData) {
  const session = await requireRole(["SUPER_ADMIN", "MODERATOR"]);
  const postId = String(formData.get("postId"));

  const post = await db.post.update({
    where: { id: postId },
    data: { status: "HIDDEN" },
    include: { author: true },
  });

  await logAudit({
    operatorId: session.user.id,
    action: "屏蔽帖子",
    targetType: "Post",
    targetId: post.id,
    detail: `作者 ${post.author.name} · ${post.content.slice(0, 30)}`,
  });

  revalidatePath("/admin/content");
  revalidatePath("/admin/moderation");
}

export async function restorePost(formData: FormData) {
  const session = await requireRole(["SUPER_ADMIN", "MODERATOR"]);
  const postId = String(formData.get("postId"));

  const post = await db.post.update({
    where: { id: postId },
    data: { status: "VISIBLE" },
    include: { author: true },
  });

  await logAudit({
    operatorId: session.user.id,
    action: "恢复帖子",
    targetType: "Post",
    targetId: post.id,
    detail: `作者 ${post.author.name} · ${post.content.slice(0, 30)}`,
  });

  revalidatePath("/admin/content");
  revalidatePath("/admin/moderation");
}

export async function createSensitiveWord(formData: FormData) {
  const session = await requireRole(["SUPER_ADMIN", "MODERATOR"]);
  const word = String(formData.get("word") ?? "").trim();
  const level = String(formData.get("level") ?? "");
  if (!word) throw new Error("词条不能为空");
  if (!["BLOCK", "REVIEW", "LOG"].includes(level)) throw new Error("级别不合法");

  const created = await db.sensitiveWord.create({
    data: { word, level: level as "BLOCK" | "REVIEW" | "LOG" },
  });

  await logAudit({
    operatorId: session.user.id,
    action: "新增敏感词",
    targetType: "SensitiveWord",
    targetId: created.id,
    detail: `${word}（${level}）`,
  });

  revalidatePath("/admin/content");
  revalidatePath("/admin/moderation");
}

export async function deleteSensitiveWord(formData: FormData) {
  const session = await requireRole(["SUPER_ADMIN", "MODERATOR"]);
  const id = String(formData.get("id"));

  const word = await db.sensitiveWord.delete({ where: { id } });

  await logAudit({
    operatorId: session.user.id,
    action: "删除敏感词",
    targetType: "SensitiveWord",
    targetId: id,
    detail: word.word,
  });

  revalidatePath("/admin/content");
  revalidatePath("/admin/moderation");
}

export async function deleteNote(formData: FormData) {
  const session = await requireRole(["SUPER_ADMIN", "MODERATOR"]);
  const noteId = String(formData.get("noteId"));

  const note = await db.note.delete({
    where: { id: noteId },
    include: { user: true },
  });

  await logAudit({
    operatorId: session.user.id,
    action: "删除笔记",
    targetType: "Note",
    targetId: note.id,
    detail: `作者 ${note.user.name} · ${note.book} ${note.chapter}:${note.verse} · ${note.content.slice(0, 30)}`,
  });

  revalidatePath("/admin/annotations");
}

export async function deleteHighlight(formData: FormData) {
  const session = await requireRole(["SUPER_ADMIN", "MODERATOR"]);
  const highlightId = String(formData.get("highlightId"));

  const highlight = await db.highlight.delete({
    where: { id: highlightId },
    include: { user: true },
  });

  await logAudit({
    operatorId: session.user.id,
    action: "删除高亮",
    targetType: "Highlight",
    targetId: highlight.id,
    detail: `作者 ${highlight.user.name} · ${highlight.book} ${highlight.chapter}:${highlight.verse}`,
  });

  revalidatePath("/admin/annotations");
}
