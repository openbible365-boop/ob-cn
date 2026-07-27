import { NextResponse } from "next/server";
import { findCommunityAccess } from "@/lib/community-access";
import { getSessionUser } from "@/lib/current-user";
import { db } from "@/lib/db";

export const runtime = "nodejs";

type RouteParams = { params: Promise<{ communityId: string }> };

const ONLINE_WINDOW_MS = 90_000;
const STALE_PRESENCE_MS = 24 * 60 * 60 * 1_000;

function error(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status });
}

export async function POST(_request: Request, { params }: RouteParams) {
  const user = await getSessionUser();
  if (!user) return error("请先登录", 401);
  if (user.status !== "ACTIVE") return error("当前账号暂时不能进入社群", 403);

  const { communityId: reference } = await params;
  const access = await findCommunityAccess(user.id, reference);
  if (!access) return error("你还不是这个社群的成员", 403);

  const now = new Date();
  const onlineSince = new Date(now.getTime() - ONLINE_WINDOW_MS);
  const staleBefore = new Date(now.getTime() - STALE_PRESENCE_MS);

  await db.communityPresence.upsert({
    where: {
      userId_communityId: {
        userId: user.id,
        communityId: access.community.id,
      },
    },
    create: {
      userId: user.id,
      communityId: access.community.id,
      lastSeenAt: now,
    },
    update: { lastSeenAt: now },
  });

  const [, onlineCount] = await Promise.all([
    db.communityPresence.deleteMany({
      where: { lastSeenAt: { lt: staleBefore } },
    }),
    db.communityPresence.count({
      where: {
        communityId: access.community.id,
        lastSeenAt: { gte: onlineSince },
      },
    }),
  ]);

  return NextResponse.json({
    ok: true,
    onlineCount,
    sampledAt: now.toISOString(),
    expiresInSeconds: ONLINE_WINDOW_MS / 1_000,
  });
}
