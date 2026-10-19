"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { requireRole } from "@/lib/authz";

// 网页版原有的四个内容模块（百科 / 影音 / 灵修 / 研经笔记）整合进后台后的写操作。
// 全部走运营账号鉴权并写审计日志，与社群那套管理动作保持一致。

type EntryType = "DICTIONARY" | "ARTICLE" | "DEVOTIONAL";
type MediaType = "VIDEO" | "AUDIO";

function text(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function optional(form: FormData, key: string) {
  return text(form, key) || null;
}

function int(form: FormData, key: string) {
  const value = Number(text(form, key));
  return Number.isFinite(value) ? Math.trunc(value) : 0;
}

// ---------- 百科 ----------

export async function saveEncyclopediaEntry(formData: FormData) {
  const session = await requireRole(["SUPER_ADMIN", "MODERATOR"]);
  const id = text(formData, "id");
  const entryType = text(formData, "entryType") as EntryType;
  if (!["DICTIONARY", "ARTICLE", "DEVOTIONAL"].includes(entryType)) {
    throw new Error("百科类型不正确");
  }
  const titleZh = text(formData, "titleZh");
  if (!titleZh) throw new Error("请填写中文标题");

  const data = {
    entryType,
    category: optional(formData, "category"),
    indexLetter: optional(formData, "indexLetter"),
    coverStyle: optional(formData, "coverStyle"),
    author: optional(formData, "author"),
    sortOrder: int(formData, "sortOrder"),
    isActive: formData.get("isActive") === "on",
    titleZh,
    titleEn: optional(formData, "titleEn"),
    titleKo: optional(formData, "titleKo"),
    summaryZh: optional(formData, "summaryZh"),
    summaryEn: optional(formData, "summaryEn"),
    summaryKo: optional(formData, "summaryKo"),
    contentZh: optional(formData, "contentZh"),
    contentEn: optional(formData, "contentEn"),
    contentKo: optional(formData, "contentKo"),
  };

  const entry = id
    ? await db.encyclopediaEntry.update({ where: { id }, data })
    : await db.encyclopediaEntry.create({ data });

  await logAudit({
    operatorId: session.user.id,
    action: id ? "更新百科条目" : "新增百科条目",
    targetType: "EncyclopediaEntry",
    targetId: entry.id,
    detail: `${entryType} · ${titleZh}`,
  });
  revalidatePath("/admin/encyclopedia");
}

export async function deleteEncyclopediaEntry(formData: FormData) {
  const session = await requireRole(["SUPER_ADMIN", "MODERATOR"]);
  const id = text(formData, "id");
  const entry = await db.encyclopediaEntry.delete({ where: { id } });
  await logAudit({
    operatorId: session.user.id,
    action: "删除百科条目",
    targetType: "EncyclopediaEntry",
    targetId: id,
    detail: entry.titleZh ?? id,
  });
  revalidatePath("/admin/encyclopedia");
}

// ---------- 影音 ----------

export async function saveMediaItem(formData: FormData) {
  const session = await requireRole(["SUPER_ADMIN", "MODERATOR"]);
  const id = text(formData, "id");
  const mediaType = text(formData, "mediaType") as MediaType;
  if (!["VIDEO", "AUDIO"].includes(mediaType)) throw new Error("影音类型不正确");
  const title = text(formData, "title");
  if (!title) throw new Error("请填写标题");
  const url = optional(formData, "url");
  if (url && !/^https?:\/\//i.test(url)) throw new Error("请填写 http 或 https 链接");

  const data = {
    mediaType,
    title,
    series: optional(formData, "series"),
    category: text(formData, "category") || "未分类",
    duration: optional(formData, "duration"),
    teacher: optional(formData, "teacher"),
    description: optional(formData, "description"),
    coverStyle: optional(formData, "coverStyle"),
    url,
    sortOrder: int(formData, "sortOrder"),
    isActive: formData.get("isActive") === "on",
  };

  const item = id
    ? await db.mediaItem.update({ where: { id }, data })
    : await db.mediaItem.create({ data });

  await logAudit({
    operatorId: session.user.id,
    action: id ? "更新影音" : "新增影音",
    targetType: "MediaItem",
    targetId: item.id,
    detail: `${mediaType} · ${title}`,
  });
  revalidatePath("/admin/media");
}

export async function deleteMediaItem(formData: FormData) {
  const session = await requireRole(["SUPER_ADMIN", "MODERATOR"]);
  const id = text(formData, "id");
  const item = await db.mediaItem.delete({ where: { id } });
  await logAudit({
    operatorId: session.user.id,
    action: "删除影音",
    targetType: "MediaItem",
    targetId: id,
    detail: item.title,
  });
  revalidatePath("/admin/media");
}

// ---------- 灵修 ----------

export async function saveSpiritualStage(formData: FormData) {
  const session = await requireRole(["SUPER_ADMIN", "MODERATOR"]);
  const id = text(formData, "id");
  const name = text(formData, "name");
  if (!name) throw new Error("请填写阶段名称");
  const data = {
    name,
    description: optional(formData, "description"),
    sortOrder: int(formData, "sortOrder"),
  };
  const stage = id
    ? await db.spiritualStage.update({ where: { id }, data })
    : await db.spiritualStage.create({ data });
  await logAudit({
    operatorId: session.user.id,
    action: id ? "更新属灵阶段" : "新增属灵阶段",
    targetType: "SpiritualStage",
    targetId: stage.id,
    detail: name,
  });
  revalidatePath("/admin/spiritual");
}

export async function deleteSpiritualStage(formData: FormData) {
  const session = await requireRole(["SUPER_ADMIN", "MODERATOR"]);
  const id = text(formData, "id");
  // 问题表是级联删除，这里提示一下影响范围写进审计。
  const stage = await db.spiritualStage.findUnique({
    where: { id },
    select: { name: true, _count: { select: { questions: true } } },
  });
  await db.spiritualStage.delete({ where: { id } });
  await logAudit({
    operatorId: session.user.id,
    action: "删除属灵阶段",
    targetType: "SpiritualStage",
    targetId: id,
    detail: `${stage?.name ?? id} · 连带删除 ${stage?._count.questions ?? 0} 个问题`,
  });
  revalidatePath("/admin/spiritual");
}

export async function saveSpiritualQuestion(formData: FormData) {
  const session = await requireRole(["SUPER_ADMIN", "MODERATOR"]);
  const id = text(formData, "id");
  const stageId = text(formData, "stageId");
  const questionText = text(formData, "questionText");
  if (!stageId) throw new Error("请选择所属阶段");
  if (!questionText) throw new Error("请填写问题内容");
  const data = {
    stageId,
    questionText,
    category: text(formData, "category") || "general",
    description: optional(formData, "description"),
    sortOrder: int(formData, "sortOrder"),
    isActive: formData.get("isActive") === "on",
  };
  const question = id
    ? await db.spiritualQuestion.update({ where: { id }, data })
    : await db.spiritualQuestion.create({ data });
  await logAudit({
    operatorId: session.user.id,
    action: id ? "更新灵修问题" : "新增灵修问题",
    targetType: "SpiritualQuestion",
    targetId: question.id,
    detail: questionText.slice(0, 40),
  });
  revalidatePath("/admin/spiritual");
}

export async function deleteSpiritualQuestion(formData: FormData) {
  const session = await requireRole(["SUPER_ADMIN", "MODERATOR"]);
  const id = text(formData, "id");
  const question = await db.spiritualQuestion.delete({ where: { id } });
  await logAudit({
    operatorId: session.user.id,
    action: "删除灵修问题",
    targetType: "SpiritualQuestion",
    targetId: id,
    detail: question.questionText.slice(0, 40),
  });
  revalidatePath("/admin/spiritual");
}

// ---------- 研经笔记 ----------

export async function saveStudyNote(formData: FormData) {
  const session = await requireRole(["SUPER_ADMIN", "MODERATOR"]);
  const id = text(formData, "id");
  const verseRef = text(formData, "verseRef");
  const content = text(formData, "content");
  if (!verseRef) throw new Error("请填写经节引用，例如 gen-1-1");
  if (!content) throw new Error("请填写注释内容");

  const note = id
    ? await db.studyNote.update({ where: { id }, data: { verseRef, content } })
    // 同一节经文只保留一条，重复导入时覆盖而不是报错。
    : await db.studyNote.upsert({
        where: { verseRef },
        update: { content },
        create: { verseRef, content },
      });

  await logAudit({
    operatorId: session.user.id,
    action: id ? "更新研经笔记" : "保存研经笔记",
    targetType: "StudyNote",
    targetId: note.id,
    detail: verseRef,
  });
  revalidatePath("/admin/study-notes");
}

export async function deleteStudyNote(formData: FormData) {
  const session = await requireRole(["SUPER_ADMIN", "MODERATOR"]);
  const id = text(formData, "id");
  const note = await db.studyNote.delete({ where: { id } });
  await logAudit({
    operatorId: session.user.id,
    action: "删除研经笔记",
    targetType: "StudyNote",
    targetId: id,
    detail: note.verseRef,
  });
  revalidatePath("/admin/study-notes");
}
