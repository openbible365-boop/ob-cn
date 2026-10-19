import { NextResponse } from "next/server";
import { findCommunityAccess } from "@/lib/community-access";
import {
  COMMUNITY_POST_PAGE_SIZE,
  findCommunityPosts,
  serializeCommunityPost,
} from "@/lib/community-posts";
import { getSessionUser } from "@/lib/current-user";
import { db } from "@/lib/db";

// 工作台首屏只带第一页动态，这里按游标继续往后翻。
type RouteParams = { params: Promise<{ communityId: string }> };

function error(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status });
}

export async function GET(request: Request, { params }: RouteParams) {
  const user = await getSessionUser();
  const { communityId: reference } = await params;
  const memberAccess = user ? await findCommunityAccess(user.id, reference) : null;
  const publicCommunity = memberAccess
    ? null
    : await db.community.findFirst({
        where:
          reference === "official"
            ? { isOfficial: true, status: "ACTIVE" }
            : { id: reference, isOfficial: true, status: "ACTIVE" },
        select: { id: true },
      });
  if (!memberAccess && !publicCommunity) {
    return error(user ? "你还不是这个社群的成员" : "请先登录", user ? 403 : 401);
  }

  const communityId = memberAccess?.community.id ?? publicCommunity!.id;
  const role = memberAccess?.role ?? ("GUEST" as const);
  const isAdmin = memberAccess?.isAdmin ?? false;
  const cursor = new URL(request.url).searchParams.get("cursor");

  const posts = await findCommunityPosts(
    { communityId, role, isAdmin, viewerId: user?.id },
    { take: COMMUNITY_POST_PAGE_SIZE, cursor },
  );

  return NextResponse.json({
    ok: true,
    posts: posts.map(serializeCommunityPost),
    nextCursor:
      posts.length === COMMUNITY_POST_PAGE_SIZE ? posts[posts.length - 1].id : null,
  });
}
