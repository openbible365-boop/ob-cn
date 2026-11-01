import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/current-user";
import { db } from "@/lib/db";
import { notificationEnabled } from "@/lib/user-notifications";

// 祷告墙：全站代祷请求（postType=PRAYER）的聚合视图。
// 读取对所有人开放（墙的意义就是被看见、被代祷）；发布与「阿们」需要登录。
// 发布的代祷落在系统社群「祷告墙」里——Post 模型要求 communityId，
// 用一个官方社群承接，社群功能恢复后这些帖子也能在群内正常显示。

const WALL_ABBREVIATION = "祷告墙";
const MAX_CONTENT_LENGTH = 300;

async function ensureWallCommunity() {
  const existing = await db.community.findUnique({ where: { abbreviation: WALL_ABBREVIATION } });
  if (existing) return existing;
  return db.community.create({
    data: {
      name: "祷告墙",
      abbreviation: WALL_ABBREVIATION,
      description: "全体弟兄姊妹的代祷墙",
      isOfficial: true,
      joinPolicy: "OPEN",
    },
  });
}

export async function GET() {
  const user = await getSessionUser();
  // PGlite 单连接：保持顺序查询（同 community route 的注释）
  const posts = await db.post.findMany({
    where: { postType: "PRAYER", status: "VISIBLE" },
    orderBy: { createdAt: "desc" },
    take: 120,
    select: {
      id: true,
      content: true,
      createdAt: true,
      likeCount: true,
      author: { select: { name: true, avatarColor: true } },
      likes: user ? { where: { userId: user.id }, select: { id: true }, take: 1 } : false,
    },
  });
  return NextResponse.json({
    ok: true,
    loggedIn: Boolean(user),
    prayers: posts.map((post) => ({
      id: post.id,
      content: post.content,
      createdAt: post.createdAt.toISOString(),
      amenCount: post.likeCount,
      amenByMe: user ? post.likes.length > 0 : false,
      author: { name: post.author.name, avatarColor: post.author.avatarColor },
    })),
  });
}

type WallInput = { action?: unknown; content?: unknown; postId?: unknown };

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, message: "请先登录" }, { status: 401 });
  }

  let input: WallInput;
  try {
    input = (await request.json()) as WallInput;
  } catch {
    return NextResponse.json({ ok: false, message: "请求格式不正确" }, { status: 400 });
  }

  if (input.action === "create") {
    const content = typeof input.content === "string" ? input.content.trim() : "";
    if (!content) {
      return NextResponse.json({ ok: false, message: "请写下代祷事项" }, { status: 400 });
    }
    if (Array.from(content).length > MAX_CONTENT_LENGTH) {
      return NextResponse.json({ ok: false, message: `代祷内容请控制在 ${MAX_CONTENT_LENGTH} 字以内` }, { status: 400 });
    }
    const wall = await ensureWallCommunity();
    const post = await db.post.create({
      data: {
        communityId: wall.id,
        authorId: user.id,
        postType: "PRAYER",
        content,
        visibility: "PUBLIC",
      },
      select: { id: true, content: true, createdAt: true },
    });
    return NextResponse.json({
      ok: true,
      prayer: {
        id: post.id,
        content: post.content,
        createdAt: post.createdAt.toISOString(),
        amenCount: 0,
        amenByMe: false,
        author: { name: user.name, avatarColor: user.avatarColor },
      },
    });
  }

  if (input.action === "amen") {
    const postId = typeof input.postId === "string" ? input.postId : "";
    const post = await db.post.findFirst({
      where: { id: postId, postType: "PRAYER", status: "VISIBLE" },
      select: { id: true, authorId: true, content: true },
    });
    if (!post) {
      return NextResponse.json({ ok: false, message: "这条代祷不存在或已删除" }, { status: 404 });
    }
    const result = await db.$transaction(async (tx) => {
      const existing = await tx.postLike.findUnique({
        where: { postId_userId: { postId, userId: user.id } },
      });
      if (existing) {
        await tx.postLike.delete({ where: { id: existing.id } });
        const updated = await tx.post.update({
          where: { id: postId },
          data: { likeCount: { decrement: 1 } },
          select: { likeCount: true },
        });
        return { amenByMe: false, amenCount: Math.max(0, updated.likeCount) };
      }
      await tx.postLike.create({ data: { postId, userId: user.id } });
      const updated = await tx.post.update({
        where: { id: postId },
        data: { likeCount: { increment: 1 } },
        select: { likeCount: true },
      });
      return { amenByMe: true, amenCount: updated.likeCount };
    });

    // 给作者发站内反馈：同一条代祷每天聚合为一条通知（再有人阿们就更新计数并重新置为未读），
    // 自己阿们自己的不发，取消阿们不发；作者可在「通知设置 → 代祷阿们提醒」里关闭。
    if (result.amenByMe && post.authorId !== user.id) {
      try {
        if (await notificationEnabled(post.authorId, "prayer_amen")) {
          const dayKey = new Date().toISOString().slice(0, 10);
          const dayStart = new Date(`${dayKey}T00:00:00.000Z`);
          const todayCount = await db.postLike.count({
            where: { postId, createdAt: { gte: dayStart }, userId: { not: post.authorId } },
          });
          const excerpt = Array.from(post.content).slice(0, 18).join("") + (Array.from(post.content).length > 18 ? "…" : "");
          const body = todayCount > 1
            ? `今天已有 ${todayCount} 位弟兄姊妹为你的代祷「${excerpt}」按下阿们`
            : `有弟兄姊妹为你的代祷「${excerpt}」按下了阿们`;
          const uniqueKey = `prayer-amen:${postId}:${dayKey}`;
          await db.userNotification.upsert({
            where: { uniqueKey },
            update: { body, readAt: null },
            create: {
              userId: post.authorId,
              type: "PRAYER_AMEN",
              title: "🙏 你的代祷有人同心",
              body,
              href: "/prayer-wall",
              uniqueKey,
            },
          });
        }
      } catch {
        // 通知失败不影响阿们本身
      }
    }
    return NextResponse.json({ ok: true, ...result });
  }

  return NextResponse.json({ ok: false, message: "不支持的操作" }, { status: 400 });
}
