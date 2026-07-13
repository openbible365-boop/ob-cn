"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { requireRole } from "@/lib/authz";

async function resolveReport(reportId: string, resolution: string) {
  return db.report.update({
    where: { id: reportId },
    data: { status: "RESOLVED", resolution, resolvedAt: new Date() },
  });
}

export async function approveReport(formData: FormData) {
  const session = await requireRole(["SUPER_ADMIN", "MODERATOR"]);
  const reportId = String(formData.get("reportId"));

  await resolveReport(reportId, "已通过");

  await logAudit({
    operatorId: session.user.id,
    action: "举报处理·通过",
    targetType: "Report",
    targetId: reportId,
    detail: "内容未违规，已通过",
  });

  revalidatePath("/admin/moderation");
}

export async function removeReportedContent(formData: FormData) {
  const session = await requireRole(["SUPER_ADMIN", "MODERATOR"]);
  const reportId = String(formData.get("reportId"));
  const report = await db.report.findUniqueOrThrow({ where: { id: reportId } });

  if (report.postId) {
    await db.post.update({ where: { id: report.postId }, data: { status: "DELETED" } });
  }
  await resolveReport(reportId, report.postId ? "已删除" : "已强制下架");

  await logAudit({
    operatorId: session.user.id,
    action: "举报处理·删除内容",
    targetType: "Report",
    targetId: reportId,
    detail: report.contentSnapshot.slice(0, 30),
  });

  revalidatePath("/admin/moderation");
  revalidatePath("/admin/content");
}

export async function hideReportedContent(formData: FormData) {
  const session = await requireRole(["SUPER_ADMIN", "MODERATOR"]);
  const reportId = String(formData.get("reportId"));
  const report = await db.report.findUniqueOrThrow({ where: { id: reportId } });

  if (report.postId) {
    await db.post.update({ where: { id: report.postId }, data: { status: "HIDDEN" } });
  }
  await resolveReport(reportId, "已屏蔽");

  await logAudit({
    operatorId: session.user.id,
    action: "举报处理·屏蔽内容",
    targetType: "Report",
    targetId: reportId,
    detail: report.contentSnapshot.slice(0, 30),
  });

  revalidatePath("/admin/moderation");
  revalidatePath("/admin/content");
}

export async function banReportedUser(formData: FormData) {
  const session = await requireRole(["SUPER_ADMIN", "MODERATOR"]);
  const reportId = String(formData.get("reportId"));
  const report = await db.report.findUniqueOrThrow({
    where: { id: reportId },
    include: { post: { include: { author: true } } },
  });
  if (!report.post) throw new Error("该举报未关联具体内容，无法封禁用户");

  await db.user.update({
    where: { id: report.post.authorId },
    data: { status: "BANNED", banReason: report.reason },
  });
  await resolveReport(reportId, "已封禁用户");

  await logAudit({
    operatorId: session.user.id,
    action: "举报处理·封禁用户",
    targetType: "User",
    targetId: report.post.authorId,
    detail: `${report.post.author.name} · 原因：${report.reason}`,
  });

  revalidatePath("/admin/moderation");
  revalidatePath("/admin/users");
}

export async function muteReportedUser(formData: FormData) {
  const session = await requireRole(["SUPER_ADMIN", "MODERATOR"]);
  const reportId = String(formData.get("reportId"));
  const report = await db.report.findUniqueOrThrow({
    where: { id: reportId },
    include: { post: { include: { author: true } } },
  });
  if (!report.post) throw new Error("该举报未关联具体内容，无法禁言用户");

  const mutedUntil = new Date();
  mutedUntil.setDate(mutedUntil.getDate() + 7);
  await db.user.update({
    where: { id: report.post.authorId },
    data: { status: "MUTED", mutedUntil },
  });
  await resolveReport(reportId, "已禁言用户 7 天");

  await logAudit({
    operatorId: session.user.id,
    action: "举报处理·禁言用户",
    targetType: "User",
    targetId: report.post.authorId,
    detail: `${report.post.author.name} · 禁言至 ${mutedUntil.toISOString().slice(0, 10)}`,
  });

  revalidatePath("/admin/moderation");
  revalidatePath("/admin/users");
}
