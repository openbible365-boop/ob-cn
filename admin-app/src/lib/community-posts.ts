import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";

// 群动态的查询与序列化：工作台首屏和「加载更多」分页共用同一套，
// 避免两处对可见范围或字段的处理出现分歧。
export const COMMUNITY_POST_PAGE_SIZE = 20;

type PostScope = {
  communityId: string;
  role: "OWNER" | "ADMIN" | "MEMBER" | "GUEST";
  isAdmin: boolean;
  viewerId?: string;
};

export function communityPostVisibilityFilter({
  role,
  isAdmin,
}: Pick<PostScope, "role" | "isAdmin">): Prisma.PostWhereInput {
  if (role === "GUEST") return { visibility: "PUBLIC" };
  if (isAdmin) return {};
  return { visibility: { in: ["PUBLIC", "MEMBERS"] } };
}

export async function findCommunityPosts(
  scope: PostScope,
  options: { take: number; cursor?: string | null },
) {
  const { communityId, viewerId } = scope;
  return db.post.findMany({
    where: {
      communityId,
      status: "VISIBLE",
      ...communityPostVisibilityFilter(scope),
    },
    select: {
      id: true,
      postType: true,
      title: true,
      content: true,
      verseRef: true,
      mediaType: true,
      mediaUrl: true,
      visibility: true,
      pinnedAt: true,
      likeCount: true,
      commentCount: true,
      createdAt: true,
      author: {
        select: { id: true, name: true, avatarColor: true, avatarUrl: true },
      },
      likes: viewerId
        ? { where: { userId: viewerId }, select: { id: true }, take: 1 }
        : false,
      bookmarks: viewerId
        ? { where: { userId: viewerId }, select: { id: true }, take: 1 }
        : false,
      comments: {
        orderBy: { createdAt: "desc" },
        take: 2,
        select: {
          id: true,
          content: true,
          createdAt: true,
          author: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: [{ pinnedAt: "desc" }, { createdAt: "desc" }],
    take: options.take,
    ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
  });
}

type RawPost = Awaited<ReturnType<typeof findCommunityPosts>>[number];

export function serializeCommunityPost(post: RawPost) {
  const likes = "likes" in post && Array.isArray(post.likes) ? post.likes : [];
  const bookmarks =
    "bookmarks" in post && Array.isArray(post.bookmarks) ? post.bookmarks : [];
  const { comments, ...rest } = post;
  const clean = { ...rest } as Record<string, unknown>;
  delete clean.likes;
  delete clean.bookmarks;
  return {
    ...clean,
    likedByMe: likes.length > 0,
    bookmarkedByMe: bookmarks.length > 0,
    comments: [...comments].reverse(),
  };
}
