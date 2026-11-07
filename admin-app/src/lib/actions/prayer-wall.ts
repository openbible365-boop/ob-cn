"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { requireRole } from "@/lib/authz";

// 祷告墙管理：代祷是 postType=PRAYER 的帖子。
// 「通过」= 待审核的代祷上墙；「屏蔽」= 从墙上撤下（作者与他人都看不到）；「删除」= 软删除。
// 状态改动同时结案该代祷的待审记录，避免内容审核里残留。

const PAGE = "/admin/prayer-wall";

async function loadPrayer(postId: string) {
  return db.post.findFirst({
    where: { id: postId, postType: "PRAYER" },
    include: { author: { select: { name: true } } },
  });
}

async function setStatus(formData: FormData, status: "VISIBLE" | "HIDDEN" | "DELETED", action: string, resolution: string) {
  const session = await requireRole(["SUPER_ADMIN", "MODERATOR"]);
  const postId = String(formData.get("postId") ?? "");
  const prayer = await loadPrayer(postId);
  if (!prayer) return;

  await db.$transaction([
    db.post.update({ where: { id: postId }, data: { status } }),
    db.report.updateMany({
      where: { postId, status: "PENDING" },
      data: { status: "RESOLVED", resolution, resolvedAt: new Date() },
    }),
  ]);
  await logAudit({
    operatorId: session.user.id,
    action,
    targetType: "Post",
    targetId: postId,
    detail: `作者 ${prayer.author.name} · ${prayer.content.slice(0, 30)}`,
  });
  revalidatePath(PAGE);
  revalidatePath("/admin/moderation");
}

export async function approvePrayer(formData: FormData) {
  await setStatus(formData, "VISIBLE", "代祷通过上墙", "审核通过");
}

export async function hidePrayer(formData: FormData) {
  await setStatus(formData, "HIDDEN", "代祷从墙上撤下", "已屏蔽");
}

export async function deletePrayer(formData: FormData) {
  await setStatus(formData, "DELETED", "删除代祷", "已删除");
}
