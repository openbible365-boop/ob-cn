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

const ALLOWED_AVATAR_TYPES = new Set(["jpeg", "jpg", "png", "webp"]);
const MAX_AVATAR_BYTES = 320 * 1024;

export async function PATCH(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, message: "未登录" }, { status: 401 });
  }

  let body: { avatarUrl?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "请求格式不正确" }, { status: 400 });
  }

  if (typeof body.avatarUrl !== "string") {
    return NextResponse.json({ ok: false, message: "请选择头像图片" }, { status: 400 });
  }
  const match = body.avatarUrl.match(
    /^data:image\/([a-z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/i,
  );
  const imageType = match?.[1]?.toLowerCase() ?? "";
  if (!match || !ALLOWED_AVATAR_TYPES.has(imageType)) {
    return NextResponse.json(
      { ok: false, message: "仅支持 JPG、PNG 或 WebP 图片" },
      { status: 400 },
    );
  }
  const imageBytes = Buffer.from(match[2], "base64");
  if (imageBytes.length === 0 || imageBytes.length > MAX_AVATAR_BYTES) {
    return NextResponse.json(
      { ok: false, message: "处理后的头像不能超过 320KB" },
      { status: 413 },
    );
  }

  const updated = await db.user.update({
    where: { id: user.id },
    data: { avatarUrl: body.avatarUrl },
    select: { avatarUrl: true },
  });
  return NextResponse.json({
    ok: true,
    message: "头像已更新",
    avatarUrl: updated.avatarUrl,
  });
}
