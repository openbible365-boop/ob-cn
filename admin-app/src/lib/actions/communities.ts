"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { requireRole } from "@/lib/authz";
import {
  COMMUNITY_ENTITLEMENTS,
  countCommunityPlanMembers,
  countCommunityPlanResources,
} from "@/lib/community-access";

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

  revalidatePath("/admin/communities");
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

  revalidatePath("/admin/communities");
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

  revalidatePath("/admin/communities");
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

  revalidatePath("/admin/communities");
}

export async function changeCommunityTier(formData: FormData) {
  const session = await requireRole(["SUPER_ADMIN"]);
  const communityId = String(formData.get("communityId"));
  const tier = String(formData.get("tier"));
  if (tier !== "BASIC_FREE" && tier !== "MID" && tier !== "HIGH") {
    throw new Error("无效的团体会员方案");
  }

  const community = await db.community.findUniqueOrThrow({
    where: { id: communityId },
    select: {
      id: true,
      name: true,
      parentId: true,
      isOfficial: true,
      tier: true,
      _count: { select: { memberships: true, groups: true } },
    },
  });
  if (community.isOfficial || community.parentId) {
    throw new Error("只能调整非官方顶层社群的会员方案");
  }

  const entitlements = COMMUNITY_ENTITLEMENTS[tier];
  const [memberCount, resourceCount] = await Promise.all([
    countCommunityPlanMembers(community.id),
    countCommunityPlanResources(community.id),
  ]);
  if (
    (entitlements.memberLimit !== null && memberCount > entitlements.memberLimit) ||
    (entitlements.groupLimit !== null && community._count.groups > entitlements.groupLimit) ||
    (entitlements.resourceLimit !== null && resourceCount > entitlements.resourceLimit)
  ) {
    throw new Error("当前成员、小组或资料数量超过目标方案额度，暂时不能降级");
  }

  await db.$transaction([
    db.community.update({
      where: { id: community.id },
      data: {
        tier,
        tierPriceCents: entitlements.priceMonthlyCents,
        aiTokenDailyLimit: null,
      },
    }),
    db.community.updateMany({
      where: { parentId: community.id },
      data: { tier, tierPriceCents: entitlements.priceMonthlyCents },
    }),
  ]);

  await logAudit({
    operatorId: session.user.id,
    action: "调整团体会员方案",
    targetType: "Community",
    targetId: community.id,
    detail: `${community.name} · ${community.tier} → ${tier}`,
  });
  revalidatePath("/admin/communities");
}
