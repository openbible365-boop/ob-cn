import { db } from "@/lib/db";

export const COMMUNITY_ENTITLEMENTS = {
  OFFICIAL_FREE: {
    label: "官方",
    priceMonthlyCents: 0,
    memberLimit: null,
    groupLimit: null,
    resourceLimit: null,
    aiDailyTokenLimit: null,
  },
  BASIC_FREE: {
    label: "初阶",
    priceMonthlyCents: 0,
    memberLimit: 50,
    groupLimit: 3,
    resourceLimit: 50,
    aiDailyTokenLimit: 50_000,
  },
  MID: {
    label: "中阶",
    priceMonthlyCents: 3_000,
    memberLimit: 200,
    groupLimit: 20,
    resourceLimit: 500,
    aiDailyTokenLimit: 300_000,
  },
  HIGH: {
    label: "高阶",
    priceMonthlyCents: 9_800,
    memberLimit: 1_000,
    groupLimit: 100,
    resourceLimit: 5_000,
    aiDailyTokenLimit: 2_000_000,
  },
} as const;

export type CommunityAccessRole = "OWNER" | "ADMIN" | "MEMBER";

export async function findCommunityAccess(userId: string, reference: string) {
  const community = await db.community.findFirst({
    where:
      reference === "official"
        ? { isOfficial: true, status: "ACTIVE" }
        : { id: reference, status: "ACTIVE" },
    select: {
      id: true,
      parentId: true,
      name: true,
      abbreviation: true,
      description: true,
      avatarColor: true,
      isOfficial: true,
      tier: true,
      aiTokenDailyLimit: true,
      memberships: {
        where: { userId },
        select: { role: true },
        take: 1,
      },
      parent: {
        select: {
          id: true,
          tier: true,
          aiTokenDailyLimit: true,
          memberships: {
            where: { userId },
            select: { role: true },
            take: 1,
          },
        },
      },
    },
  });

  if (!community) return null;
  const directRole = community.memberships[0]?.role;
  const inheritedRole = community.parent?.memberships[0]?.role;
  const role = (directRole ?? inheritedRole ?? (community.isOfficial ? "MEMBER" : null)) as
    | CommunityAccessRole
    | null;
  if (!role) return null;
  const billingCommunityId = community.parent?.id ?? community.id;
  const planTier = community.parent?.tier ?? community.tier;

  return {
    community,
    role,
    isAdmin: role === "OWNER" || role === "ADMIN",
    isOwner: role === "OWNER",
    isDirectMember: Boolean(directRole),
    billingCommunityId,
    planTier,
    entitlements: {
      ...COMMUNITY_ENTITLEMENTS[planTier],
      aiDailyTokenLimit:
        community.parent?.aiTokenDailyLimit ??
        community.aiTokenDailyLimit ??
        COMMUNITY_ENTITLEMENTS[planTier].aiDailyTokenLimit,
    },
  };
}

export function textLength(value: string) {
  return Array.from(value).length;
}

export function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export async function countCommunityPlanMembers(billingCommunityId: string) {
  const members = await db.membership.findMany({
    where: {
      community: {
        OR: [{ id: billingCommunityId }, { parentId: billingCommunityId }],
      },
    },
    distinct: ["userId"],
    select: { userId: true },
  });
  return members.length;
}

export async function countCommunityPlanResources(billingCommunityId: string) {
  return db.communityResource.count({
    where: {
      status: "ACTIVE",
      community: {
        OR: [{ id: billingCommunityId }, { parentId: billingCommunityId }],
      },
    },
  });
}
