// Current session user for the mobile app (401 when logged out).
import { NextResponse } from "next/server";
import {
  COMMUNITY_ENTITLEMENTS,
  countCommunityPlanMembers,
  countCommunityPlanResources,
} from "@/lib/community-access";
import { getSessionUser } from "@/lib/current-user";
import { db } from "@/lib/db";

const PERSONAL_ENTITLEMENTS = {
  BASIC_FREE: { label: "个人免费", savedItems: 500, aiDailyTokenLimit: 20_000 },
  MID: { label: "个人进阶", savedItems: 5_000, aiDailyTokenLimit: 200_000 },
  HIGH: { label: "个人专业", savedItems: null, aiDailyTokenLimit: 1_000_000 },
} as const;

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, message: "未登录" }, { status: 401 });
  }
  const [groupAccounts, highlightCount, noteCount, conversationCount, eventSignupCount] = await Promise.all([
    db.membership.findMany({
      where: {
        userId: user.id,
        role: { in: ["OWNER", "ADMIN"] },
        community: { parentId: null, status: "ACTIVE", isOfficial: false },
      },
      select: {
        role: true,
        community: {
          select: {
            id: true,
            name: true,
            abbreviation: true,
            avatarColor: true,
            tier: true,
            _count: { select: { groups: true } },
          },
        },
      },
      orderBy: { joinedAt: "asc" },
    }),
    db.highlight.count({ where: { userId: user.id } }),
    db.note.count({ where: { userId: user.id } }),
    db.conversation.count({ where: { userId: user.id } }),
    db.eventSignup.count({ where: { userId: user.id } }),
  ]);
  const groupUsage = await Promise.all(
    groupAccounts.map(async ({ community }) => ({
      members: await countCommunityPlanMembers(community.id),
      groups: community._count.groups,
      resources: await countCommunityPlanResources(community.id),
    })),
  );

  return NextResponse.json({
    ok: true,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      avatarColor: user.avatarColor,
      avatarUrl: user.avatarUrl,
      tier: user.tier,
      tierPriceCents: user.tierPriceCents,
      accountType: "PERSONAL",
      entitlements: PERSONAL_ENTITLEMENTS[user.tier],
      counts: {
        highlights: highlightCount,
        notes: noteCount,
        conversations: conversationCount,
        eventSignups: eventSignupCount,
      },
      groupAccounts: groupAccounts.map(({ community, role }, index) => ({
        id: community.id,
        name: community.name,
        abbreviation: community.abbreviation,
        avatarColor: community.avatarColor,
        role,
        tier: community.tier,
        entitlements: COMMUNITY_ENTITLEMENTS[community.tier],
        usage: groupUsage[index],
      })),
    },
  });
}
