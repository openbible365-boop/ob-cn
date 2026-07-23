import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import {
  countCommunityPlanResources,
  findCommunityAccess,
  isHttpUrl,
  textLength,
} from "@/lib/community-access";
import { getSessionUser } from "@/lib/current-user";
import { db } from "@/lib/db";

type RouteParams = { params: Promise<{ communityId: string }> };

type WorkspaceAction =
  | "CREATE_POST"
  | "TOGGLE_LIKE"
  | "TOGGLE_BOOKMARK"
  | "REPORT_POST"
  | "TOGGLE_PIN_POST"
  | "UPDATE_POST_STATUS"
  | "ADD_COMMENT"
  | "CREATE_EVENT"
  | "TOGGLE_SIGNUP"
  | "UPDATE_MEMBER_ROLE"
  | "REMOVE_MEMBER"
  | "CREATE_GROUP"
  | "CREATE_RESOURCE"
  | "UPDATE_RESOURCE_STATUS"
  | "UPDATE_COMMUNITY";

type WorkspaceInput = {
  action?: unknown;
  postId?: unknown;
  postType?: unknown;
  mediaType?: unknown;
  mediaUrl?: unknown;
  content?: unknown;
  reason?: unknown;
  verseRef?: unknown;
  eventId?: unknown;
  title?: unknown;
  description?: unknown;
  location?: unknown;
  startAt?: unknown;
  endAt?: unknown;
  capacity?: unknown;
  userId?: unknown;
  role?: unknown;
  name?: unknown;
  abbreviation?: unknown;
  avatarColor?: unknown;
  type?: unknown;
  url?: unknown;
  visibility?: unknown;
  resourceId?: unknown;
  status?: unknown;
};

const ACTIONS = new Set<WorkspaceAction>([
  "CREATE_POST",
  "TOGGLE_LIKE",
  "TOGGLE_BOOKMARK",
  "REPORT_POST",
  "TOGGLE_PIN_POST",
  "UPDATE_POST_STATUS",
  "ADD_COMMENT",
  "CREATE_EVENT",
  "TOGGLE_SIGNUP",
  "UPDATE_MEMBER_ROLE",
  "REMOVE_MEMBER",
  "CREATE_GROUP",
  "CREATE_RESOURCE",
  "UPDATE_RESOURCE_STATUS",
  "UPDATE_COMMUNITY",
]);

function valueString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function error(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status });
}

function eventState(startAt: Date, endAt: Date | null) {
  const now = Date.now();
  if ((endAt ?? startAt).getTime() < now) return "ENDED" as const;
  if (startAt.getTime() <= now) return "ACTIVE" as const;
  return "UPCOMING" as const;
}

async function audit(
  communityId: string,
  actorId: string,
  action: string,
  targetType: string,
  targetId: string,
  detail?: Prisma.InputJsonValue,
) {
  await db.communityAuditLog.create({
    data: { communityId, actorId, action, targetType, targetId, detail },
  });
}

export async function GET(_request: Request, { params }: RouteParams) {
  const user = await getSessionUser();
  if (!user) return error("请先登录", 401);

  const { communityId: reference } = await params;
  const access = await findCommunityAccess(user.id, reference);
  if (!access) return error("你还不是这个社群的成员", 403);
  const { community, role, isAdmin, isOwner, entitlements, billingCommunityId } = access;

  const [posts, events, members, groups, resources, counts] = await Promise.all([
    db.post.findMany({
      where: { communityId: community.id, status: "VISIBLE" },
      select: {
        id: true,
        postType: true,
        title: true,
        content: true,
        verseRef: true,
        mediaType: true,
        mediaUrl: true,
        pinnedAt: true,
        likeCount: true,
        commentCount: true,
        createdAt: true,
        author: {
          select: { id: true, name: true, avatarColor: true, avatarUrl: true },
        },
        likes: { where: { userId: user.id }, select: { id: true }, take: 1 },
        bookmarks: { where: { userId: user.id }, select: { id: true }, take: 1 },
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
      take: 50,
    }),
    db.event.findMany({
      where: { communityId: community.id },
      select: {
        id: true,
        title: true,
        description: true,
        location: true,
        startAt: true,
        endAt: true,
        createdAt: true,
        capacity: true,
        signupCount: true,
        signups: { where: { userId: user.id }, select: { id: true }, take: 1 },
      },
      orderBy: { startAt: "asc" },
      take: 100,
    }),
    db.membership.findMany({
      where: { communityId: community.id },
      select: {
        role: true,
        joinedAt: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarColor: true,
            avatarUrl: true,
            status: true,
          },
        },
      },
      orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
      take: 1_000,
    }),
    db.community.findMany({
      where: { parentId: community.id, status: "ACTIVE" },
      select: {
        id: true,
        name: true,
        abbreviation: true,
        description: true,
        avatarColor: true,
        _count: { select: { memberships: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    db.communityResource.findMany({
      where: {
        communityId: community.id,
        status: "ACTIVE",
        ...(isAdmin ? {} : { visibility: "MEMBERS" as const }),
      },
      select: {
        id: true,
        title: true,
        description: true,
        type: true,
        url: true,
        visibility: true,
        createdAt: true,
        uploader: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    Promise.all([
      db.membership.count({ where: { communityId: community.id } }),
      db.community.count({ where: { parentId: community.id, status: "ACTIVE" } }),
      countCommunityPlanResources(billingCommunityId),
    ]),
  ]);

  return NextResponse.json({
    ok: true,
    community: {
      id: community.id,
      name: community.name,
      abbreviation: community.abbreviation,
      description: community.description,
      avatarColor: community.avatarColor,
      tier: community.tier,
    },
    access: {
      role,
      isAdmin,
      isOwner,
      canPublish: user.status === "ACTIVE",
      canManageMembers: isAdmin,
      canManageRoles: isOwner,
      canCreateGroups: isAdmin && !community.parentId,
      canManageResources: isAdmin,
    },
    entitlements,
    usage: { members: counts[0], groups: counts[1], resources: counts[2] },
    posts: posts.map(({ likes, bookmarks, comments, ...post }) => ({
      ...post,
      likedByMe: likes.length > 0,
      bookmarkedByMe: bookmarks.length > 0,
      comments: [...comments].reverse(),
    })),
    events: events.map(({ signups, ...event }) => ({
      ...event,
      state: eventState(event.startAt, event.endAt),
      signedUpByMe: signups.length > 0,
    })),
    members: members.map((member) => ({
      ...member,
      user: {
        ...member.user,
        email: isAdmin ? member.user.email : null,
      },
    })),
    groups: groups.map(({ _count, ...group }) => ({
      ...group,
      memberCount: _count.memberships,
    })),
    resources,
  });
}

export async function POST(request: Request, { params }: RouteParams) {
  const user = await getSessionUser();
  if (!user) return error("请先登录", 401);
  if (user.status !== "ACTIVE") return error("当前账号暂时不能执行此操作", 403);

  const { communityId: reference } = await params;
  const access = await findCommunityAccess(user.id, reference);
  if (!access) return error("你还不是这个社群的成员", 403);
  const { community, role, isAdmin, isOwner, entitlements, billingCommunityId } = access;

  let body: WorkspaceInput;
  try {
    body = await request.json();
  } catch {
    return error("请求格式错误");
  }
  const action = valueString(body.action) as WorkspaceAction;
  if (!ACTIONS.has(action)) return error("不支持的社群操作");

  if (action === "CREATE_POST") {
    const postType = valueString(body.postType) || "POST";
    const title = valueString(body.title);
    const content = valueString(body.content);
    const verseRef = valueString(body.verseRef);
    const mediaType = valueString(body.mediaType);
    const mediaUrl = valueString(body.mediaUrl);
    if (!["POST", "ARTICLE", "NOTICE", "MEDIA"].includes(postType)) return error("动态类型不正确");
    if (postType === "NOTICE" && !isAdmin) return error("只有群主或管理员可以发布通知", 403);
    const contentLimit = postType === "ARTICLE" ? 10_000 : 2_000;
    if (!content || textLength(content) > contentLimit) return error(`内容须为 1 到 ${contentLimit} 个字`);
    if ((postType === "ARTICLE" || postType === "NOTICE") && !title) return error(`${postType === "ARTICLE" ? "文章" : "通知"}需要填写标题`);
    if (textLength(title) > 120) return error("标题不能超过 120 个字");
    if (textLength(verseRef) > 100) return error("经文引用不能超过 100 个字");
    if (mediaUrl && !isHttpUrl(mediaUrl)) return error("请输入有效的 http 或 https 媒体链接");
    if (postType === "MEDIA" && !mediaUrl) return error("影音动态需要填写媒体链接");
    if (mediaUrl && !["IMAGE", "AUDIO", "VIDEO"].includes(mediaType)) return error("请选择正确的媒体类型");
    if (postType !== "MEDIA" && mediaUrl && mediaType !== "IMAGE") return error("图文或文章目前仅支持图片链接");
    if (postType === "NOTICE" && mediaUrl) return error("通知暂不添加媒体，请使用图文或影音动态");

    const sensitiveWords = await db.sensitiveWord.findMany({
      select: { word: true, level: true },
    });
    const reviewText = `${title}\n${content}`;
    const hits = sensitiveWords.filter(({ word }) => reviewText.includes(word));
    if (hits.some(({ level }) => level === "BLOCK")) return error("内容包含不适合发布的词语，请修改后重试", 422);
    const requiresReview = hits.some(({ level }) => level === "REVIEW");

    const post = await db.post.create({
      data: {
        communityId: community.id,
        authorId: user.id,
        postType: postType as "POST" | "ARTICLE" | "NOTICE" | "MEDIA",
        title: title || null,
        content,
        verseRef: verseRef || null,
        mediaType: mediaUrl ? mediaType as "IMAGE" | "AUDIO" | "VIDEO" : null,
        mediaUrl: mediaUrl || null,
        status: requiresReview ? "HIDDEN" : "VISIBLE",
      },
      select: { id: true },
    });
    if (hits.length) {
      await db.report.create({
        data: {
          postId: post.id,
          communityId: community.id,
          contentSnapshot: reviewText.trim(),
          reason: `敏感词命中：${hits.map(({ word }) => word).join("、")}`,
          hitLevel: requiresReview ? "REVIEW" : "LOG",
        },
      });
    }
    if (postType === "NOTICE") {
      await audit(community.id, user.id, "NOTICE_CREATE", "Post", post.id, { title });
    }
    return NextResponse.json({
      ok: true,
      message: requiresReview
        ? "内容已提交审核，审核通过后公开"
        : postType === "NOTICE"
          ? "通知已发布"
          : postType === "ARTICLE"
            ? "文章已发布"
            : postType === "MEDIA"
              ? "影音动态已发布"
              : "群动态已发布",
      refresh: !requiresReview,
    });
  }

  if (action === "UPDATE_COMMUNITY") {
    if (!isAdmin) return error("只有群主或管理员可以修改社群资料", 403);
    const name = valueString(body.name);
    const description = valueString(body.description);
    if (!name || textLength(name) > 30) return error("社群名称须为 1 到 30 个字");
    if (textLength(description) > 200) return error("社群简介不能超过 200 个字");
    await db.community.update({
      where: { id: community.id },
      data: { name, description: description || null },
    });
    await audit(community.id, user.id, "COMMUNITY_UPDATE", "Community", community.id, { name });
    return NextResponse.json({ ok: true, message: "社群资料已保存" });
  }

  if (action === "TOGGLE_LIKE") {
    const postId = valueString(body.postId);
    const post = await db.post.findFirst({ where: { id: postId, communityId: community.id, status: "VISIBLE" }, select: { id: true } });
    if (!post) return error("这条分享不存在或已下架", 404);
    const liked = await db.$transaction(async (tx) => {
      const existing = await tx.postLike.findUnique({ where: { postId_userId: { postId, userId: user.id } } });
      if (existing) {
        await tx.postLike.delete({ where: { id: existing.id } });
        await tx.post.update({ where: { id: postId }, data: { likeCount: { decrement: 1 } } });
        return false;
      }
      await tx.postLike.create({ data: { postId, userId: user.id } });
      await tx.post.update({ where: { id: postId }, data: { likeCount: { increment: 1 } } });
      return true;
    });
    return NextResponse.json({ ok: true, message: liked ? "已点赞" : "已取消点赞" });
  }

  if (action === "TOGGLE_BOOKMARK") {
    const postId = valueString(body.postId);
    const post = await db.post.findFirst({
      where: { id: postId, communityId: community.id, status: "VISIBLE" },
      select: { id: true },
    });
    if (!post) return error("这条内容不存在或已下架", 404);
    const bookmarked = await db.$transaction(async (tx) => {
      const existing = await tx.postBookmark.findUnique({
        where: { postId_userId: { postId, userId: user.id } },
      });
      if (existing) {
        await tx.postBookmark.delete({ where: { id: existing.id } });
        return false;
      }
      await tx.postBookmark.create({ data: { postId, userId: user.id } });
      return true;
    });
    return NextResponse.json({ ok: true, message: bookmarked ? "已收藏" : "已取消收藏" });
  }

  if (action === "REPORT_POST") {
    const postId = valueString(body.postId);
    const reason = valueString(body.reason);
    if (!reason || textLength(reason) > 100) return error("请选择或填写举报原因");
    const post = await db.post.findFirst({
      where: { id: postId, communityId: community.id, status: "VISIBLE" },
      select: { id: true, title: true, content: true },
    });
    if (!post) return error("这条内容不存在或已下架", 404);
    const existing = await db.report.findFirst({
      where: { postId, reporterId: user.id, status: "PENDING" },
      select: { id: true },
    });
    if (existing) return error("你已经举报过这条内容，我们正在处理", 409);
    const report = await db.report.create({
      data: {
        postId,
        reporterId: user.id,
        communityId: community.id,
        contentSnapshot: [post.title, post.content].filter(Boolean).join("\n"),
        reason,
        hitLevel: "REVIEW",
      },
      select: { id: true },
    });
    await audit(community.id, user.id, "POST_REPORT", "Report", report.id, { postId, reason });
    return NextResponse.json({ ok: true, message: "举报已提交，平台将尽快处理", refresh: false });
  }

  if (action === "TOGGLE_PIN_POST") {
    if (!isAdmin) return error("只有群主或管理员可以置顶内容", 403);
    const postId = valueString(body.postId);
    const post = await db.post.findFirst({
      where: { id: postId, communityId: community.id, status: "VISIBLE" },
      select: { id: true, pinnedAt: true },
    });
    if (!post) return error("这条内容不存在或已下架", 404);
    const pinnedAt = post.pinnedAt ? null : new Date();
    await db.post.update({ where: { id: postId }, data: { pinnedAt } });
    await audit(community.id, user.id, pinnedAt ? "POST_PIN" : "POST_UNPIN", "Post", postId);
    return NextResponse.json({ ok: true, message: pinnedAt ? "内容已置顶" : "已取消置顶" });
  }

  if (action === "UPDATE_POST_STATUS") {
    if (!isAdmin) return error("只有群主或管理员可以管理群内容", 403);
    const postId = valueString(body.postId);
    const status = valueString(body.status);
    if (status !== "HIDDEN" && status !== "DELETED") return error("内容状态不正确");
    const post = await db.post.findFirst({
      where: { id: postId, communityId: community.id },
      select: { id: true },
    });
    if (!post) return error("这条内容不存在", 404);
    await db.post.update({ where: { id: postId }, data: { status, pinnedAt: null } });
    await audit(community.id, user.id, "POST_STATUS_UPDATE", "Post", postId, { status });
    return NextResponse.json({ ok: true, message: status === "HIDDEN" ? "内容已隐藏" : "内容已删除" });
  }

  if (action === "ADD_COMMENT") {
    const postId = valueString(body.postId);
    const content = valueString(body.content);
    if (!content || textLength(content) > 500) return error("评论须为 1 到 500 个字");
    const commentWords = await db.sensitiveWord.findMany({
      where: { level: { in: ["BLOCK", "REVIEW"] } },
      select: { word: true },
    });
    if (commentWords.some(({ word }) => content.includes(word))) {
      return error("评论包含需要修改的词语，请调整后重试", 422);
    }
    const post = await db.post.findFirst({ where: { id: postId, communityId: community.id, status: "VISIBLE" }, select: { id: true } });
    if (!post) return error("这条分享不存在或已下架", 404);
    await db.$transaction([
      db.postComment.create({ data: { postId, authorId: user.id, content } }),
      db.post.update({ where: { id: postId }, data: { commentCount: { increment: 1 } } }),
    ]);
    return NextResponse.json({ ok: true, message: "评论已发布" });
  }

  if (action === "CREATE_EVENT") {
    if (!isAdmin) return error("只有群主或管理员可以创建活动", 403);
    const title = valueString(body.title);
    const description = valueString(body.description);
    const location = valueString(body.location);
    const startAt = new Date(valueString(body.startAt));
    const endAtRaw = valueString(body.endAt);
    const endAt = endAtRaw ? new Date(endAtRaw) : null;
    const capacity = typeof body.capacity === "number" ? Math.floor(body.capacity) : null;
    if (!title || textLength(title) > 80) return error("活动标题须为 1 到 80 个字");
    if (Number.isNaN(startAt.getTime())) return error("请选择正确的开始时间");
    if (endAt && (Number.isNaN(endAt.getTime()) || endAt <= startAt)) return error("结束时间必须晚于开始时间");
    if (capacity !== null && (capacity < 1 || capacity > 100_000)) return error("活动名额须为 1 到 100000");
    const event = await db.event.create({
      data: { communityId: community.id, title, description: description || null, location: location || null, startAt, endAt, capacity },
      select: { id: true },
    });
    await audit(community.id, user.id, "EVENT_CREATE", "Event", event.id, { title });
    return NextResponse.json({ ok: true, message: "活动已创建" });
  }

  if (action === "TOGGLE_SIGNUP") {
    const eventId = valueString(body.eventId);
    const event = await db.event.findFirst({ where: { id: eventId, communityId: community.id }, select: { id: true, startAt: true, endAt: true, capacity: true, signupCount: true } });
    if (!event) return error("活动不存在", 404);
    if (eventState(event.startAt, event.endAt) === "ENDED") return error("活动已经结束", 409);
    const signedUp = await db.$transaction(async (tx) => {
      const existing = await tx.eventSignup.findUnique({ where: { eventId_userId: { eventId, userId: user.id } } });
      if (existing) {
        await tx.eventSignup.delete({ where: { id: existing.id } });
        await tx.event.update({ where: { id: eventId }, data: { signupCount: { decrement: 1 } } });
        return false;
      }
      const fresh = await tx.event.findUniqueOrThrow({ where: { id: eventId }, select: { capacity: true, signupCount: true } });
      if (fresh.capacity !== null && fresh.signupCount >= fresh.capacity) throw new Error("CAPACITY_FULL");
      await tx.eventSignup.create({ data: { eventId, userId: user.id } });
      await tx.event.update({ where: { id: eventId }, data: { signupCount: { increment: 1 } } });
      return true;
    }).catch((cause: unknown) => cause instanceof Error && cause.message === "CAPACITY_FULL" ? null : Promise.reject(cause));
    if (signedUp === null) return error("活动名额已满", 409);
    return NextResponse.json({ ok: true, message: signedUp ? "报名成功" : "已取消报名" });
  }

  if (action === "UPDATE_MEMBER_ROLE") {
    if (!isOwner) return error("只有群主可以调整管理员", 403);
    const userId = valueString(body.userId);
    const nextRole = valueString(body.role);
    if (nextRole !== "ADMIN" && nextRole !== "MEMBER") return error("请选择正确的成员角色");
    const membership = await db.membership.findUnique({ where: { userId_communityId: { userId, communityId: community.id } } });
    if (!membership) return error("成员不存在", 404);
    if (membership.role === "OWNER") return error("不能修改群主角色", 409);
    await db.membership.update({ where: { id: membership.id }, data: { role: nextRole } });
    await audit(community.id, user.id, "MEMBER_ROLE_UPDATE", "User", userId, { from: membership.role, to: nextRole });
    return NextResponse.json({ ok: true, message: nextRole === "ADMIN" ? "已设为管理员" : "已改为普通成员" });
  }

  if (action === "REMOVE_MEMBER") {
    if (!isAdmin) return error("只有群主或管理员可以移除成员", 403);
    const userId = valueString(body.userId);
    if (userId === user.id) return error("不能在这里移除自己", 409);
    const membership = await db.membership.findUnique({ where: { userId_communityId: { userId, communityId: community.id } } });
    if (!membership) return error("成员不存在", 404);
    if (membership.role === "OWNER" || (!isOwner && membership.role === "ADMIN")) return error("你没有权限移除此成员", 403);
    await db.membership.delete({ where: { id: membership.id } });
    await audit(community.id, user.id, "MEMBER_REMOVE", "User", userId, { role: membership.role });
    return NextResponse.json({ ok: true, message: "成员已移除" });
  }

  if (action === "CREATE_GROUP") {
    if (!isAdmin) return error("只有群主或管理员可以创建小组", 403);
    if (community.parentId) return error("暂不支持在小组中继续建立下级小组", 409);
    const currentCount = await db.community.count({ where: { parentId: community.id, status: "ACTIVE" } });
    if (entitlements.groupLimit !== null && currentCount >= entitlements.groupLimit) return error(`当前方案最多创建 ${entitlements.groupLimit} 个小组`, 409);
    const name = valueString(body.name);
    const abbreviation = valueString(body.abbreviation).normalize("NFC");
    const description = valueString(body.description);
    const avatarColor = valueString(body.avatarColor) || "#FFD465";
    if (!name || textLength(name) > 30) return error("小组名称须为 1 到 30 个字");
    if (!abbreviation || textLength(abbreviation) > 2 || /\s/u.test(abbreviation)) return error("小组简称须为 1 到 2 个字");
    try {
      const group = await db.community.create({
        data: {
          parentId: community.id,
          name,
          abbreviation,
          description: description || null,
          avatarColor,
          joinPolicy: "APPROVAL",
          tier: community.tier,
          memberships: { create: { userId: user.id, role } },
        },
        select: { id: true },
      });
      await audit(community.id, user.id, "GROUP_CREATE", "Community", group.id, { name });
      return NextResponse.json({ ok: true, message: "小组已创建" });
    } catch (cause) {
      if (cause instanceof Prisma.PrismaClientKnownRequestError && cause.code === "P2002") return error("这个小组简称已被使用，请换一个", 409);
      throw cause;
    }
  }

  if (action === "CREATE_RESOURCE") {
    if (!isAdmin) return error("只有群主或管理员可以添加资料", 403);
    const currentCount = await countCommunityPlanResources(billingCommunityId);
    if (entitlements.resourceLimit !== null && currentCount >= entitlements.resourceLimit) return error(`当前方案最多保存 ${entitlements.resourceLimit} 份资料`, 409);
    const title = valueString(body.title);
    const description = valueString(body.description);
    const url = valueString(body.url);
    const type = valueString(body.type) || "LINK";
    const visibility = valueString(body.visibility) || "MEMBERS";
    if (!title || textLength(title) > 100) return error("资料标题须为 1 到 100 个字");
    if (!isHttpUrl(url)) return error("请输入有效的 http 或 https 链接");
    if (!["LINK", "DOCUMENT", "AUDIO", "VIDEO", "IMAGE"].includes(type)) return error("资料类型不正确");
    if (visibility !== "MEMBERS" && visibility !== "ADMINS") return error("资料可见范围不正确");
    const resource = await db.communityResource.create({
      data: {
        communityId: community.id,
        uploaderId: user.id,
        title,
        description: description || null,
        url,
        type: type as "LINK" | "DOCUMENT" | "AUDIO" | "VIDEO" | "IMAGE",
        visibility: visibility as "MEMBERS" | "ADMINS",
      },
      select: { id: true },
    });
    await audit(community.id, user.id, "RESOURCE_CREATE", "CommunityResource", resource.id, { title, type, visibility });
    return NextResponse.json({ ok: true, message: "资料已添加" });
  }

  if (action === "UPDATE_RESOURCE_STATUS") {
    if (!isAdmin) return error("只有群主或管理员可以管理资料", 403);
    const resourceId = valueString(body.resourceId);
    const status = valueString(body.status);
    if (status !== "ACTIVE" && status !== "HIDDEN" && status !== "DELETED") return error("资料状态不正确");
    const updated = await db.communityResource.updateMany({ where: { id: resourceId, communityId: community.id }, data: { status } });
    if (!updated.count) return error("资料不存在", 404);
    await audit(community.id, user.id, "RESOURCE_STATUS_UPDATE", "CommunityResource", resourceId, { status });
    return NextResponse.json({ ok: true, message: status === "ACTIVE" ? "资料已恢复" : "资料已下架" });
  }

  return error("不支持的社群操作");
}
