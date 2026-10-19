import { NextResponse } from "next/server";
import { findCommunityAccess } from "@/lib/community-access";
import { getSessionUser } from "@/lib/current-user";
import { db } from "@/lib/db";

// 工作台接口每条动态只带最新两条评论，这里按游标分页返回全部评论。
type RouteParams = { params: Promise<{ communityId: string; postId: string }> };

const PAGE_SIZE = 20;

function error(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status });
}

export async function GET(request: Request, { params }: RouteParams) {
  const user = await getSessionUser();
  const { communityId: reference, postId } = await params;
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
  const isAdmin = memberAccess?.isAdmin ?? false;

  // 评论只能读到当前身份本来就能看到的动态。
  const post = await db.post.findFirst({
    where: {
      id: postId,
      communityId,
      status: "VISIBLE",
      ...(memberAccess
        ? isAdmin
          ? {}
          : { visibility: { in: ["PUBLIC", "MEMBERS"] as const } }
        : { visibility: "PUBLIC" as const }),
    },
    select: { id: true, commentCount: true },
  });
  if (!post) return error("动态不存在或已被隐藏", 404);

  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor");
  const comments = await db.postComment.findMany({
    where: { postId: post.id },
    orderBy: { createdAt: "asc" },
    take: PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      content: true,
      createdAt: true,
      // 头像目前以 base64 存库，评论列表不带头像以免每条多出几 KB。
      author: { select: { id: true, name: true } },
    },
  });
  const hasMore = comments.length > PAGE_SIZE;
  const page = hasMore ? comments.slice(0, PAGE_SIZE) : comments;

  return NextResponse.json({
    ok: true,
    comments: page,
    total: post.commentCount,
    nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null,
  });
}
