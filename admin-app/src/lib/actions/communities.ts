"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { requireRole } from "@/lib/authz";

export async function warnCommunity(formData: FormData) {
  const session = await requireRole(["SUPER_ADMIN", "MODERATOR"]);
  const communityId = String(formData.get("communityId"));

  const community = await db.community.update({
    where: { id: communityId },
    data: { warningCount: { increment: 1 } },
  });

  await logAudit({
    operatorId: session.user.id,
    action: "警告社群",
    targetType: "Community",
    targetId: community.id,
    detail: `${community.name} · 累计警告 ${community.warningCount} 次`,
  });

  revalidatePath("/communities");
}

export async function banCommunity(formData: FormData) {
  const session = await requireRole(["SUPER_ADMIN", "MODERATOR"]);
  const communityId = String(formData.get("communityId"));

  const community = await db.community.update({
    where: { id: communityId },
    data: { status: "BANNED" },
  });

  await logAudit({
    operatorId: session.user.id,
    action: "封禁社群",
    targetType: "Community",
    targetId: community.id,
    detail: community.name,
  });

  revalidatePath("/communities");
}

export async function unbanCommunity(formData: FormData) {
  const session = await requireRole(["SUPER_ADMIN", "MODERATOR"]);
  const communityId = String(formData.get("communityId"));

  const community = await db.community.update({
    where: { id: communityId },
    data: { status: "ACTIVE" },
  });

  await logAudit({
    operatorId: session.user.id,
    action: "解封社群",
    targetType: "Community",
    targetId: community.id,
    detail: community.name,
  });

  revalidatePath("/communities");
}

export async function dissolveCommunity(formData: FormData) {
  const session = await requireRole(["SUPER_ADMIN", "MODERATOR"]);
  const communityId = String(formData.get("communityId"));

  const community = await db.community.update({
    where: { id: communityId },
    data: { status: "DISSOLVED" },
  });

  await logAudit({
    operatorId: session.user.id,
    action: "解散社群",
    targetType: "Community",
    targetId: community.id,
    detail: community.name,
  });

  revalidatePath("/communities");
}
