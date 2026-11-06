// Current session user for the mobile app (401 when logged out).
import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import {
  avatarExtensionFor,
  avatarFileNameFromPublicPath,
  avatarPublicPath,
  avatarUploadRoot,
  MAX_AVATAR_BYTES,
  resolvedAvatarPath,
} from "@/lib/avatar-storage";
import {
  appleIosClientId,
  exchangeAppleNativeCode,
  revokeAppleToken,
  verifyAppleIdToken,
} from "@/lib/apple";
import {
  COMMUNITY_ENTITLEMENTS,
  countCommunityPlanMembers,
  countCommunityPlanResources,
} from "@/lib/community-access";
import { resolvedStoragePath } from "@/lib/community-resource-storage";
import { destroySession, getSessionUser } from "@/lib/current-user";
import { db } from "@/lib/db";

// 头像写盘需要 Node 运行时。
export const runtime = "nodejs";

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
  const [groupAccounts, authAccounts, highlightCount, noteCount, conversationCount, eventSignupCount] = await Promise.all([
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
    db.authAccount.findMany({
      where: { userId: user.id },
      select: { provider: true },
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
      authProviders: authAccounts.map((account) => account.provider),
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

type DeleteAccountBody = {
  confirmation?: unknown;
  appleAuthorizationCode?: unknown;
};

export async function DELETE(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, message: "未登录" }, { status: 401 });
  }

  let body: DeleteAccountBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "请求格式不正确" }, { status: 400 });
  }
  if (body.confirmation !== "DELETE") {
    return NextResponse.json(
      { ok: false, message: "请输入 DELETE 确认永久删除账号" },
      { status: 400 },
    );
  }

  const account = await db.user.findUnique({
    where: { id: user.id },
    select: {
      email: true,
      avatarUrl: true,
      authAccounts: {
        where: { provider: "APPLE" },
        select: { providerAccountId: true },
      },
    },
  });
  if (!account) {
    await destroySession();
    return NextResponse.json({ ok: true, message: "账号已删除" });
  }

  // iOS asks the user to authenticate with Apple again immediately before
  // deletion. Exchange that one-time code, ensure it belongs to this account,
  // then revoke Apple's token before removing our local account record.
  const appleAccount = account.authAccounts[0];
  const appleCode = typeof body.appleAuthorizationCode === "string"
    ? body.appleAuthorizationCode.trim()
    : "";
  if (appleAccount?.providerAccountId && appleCode) {
    try {
      const tokens = await exchangeAppleNativeCode(appleCode);
      const claims = await verifyAppleIdToken(tokens.id_token, {
        audience: appleIosClientId(),
      });
      if (claims.sub !== appleAccount.providerAccountId) {
        return NextResponse.json(
          { ok: false, message: "Apple 身份与当前账号不一致" },
          { status: 403 },
        );
      }
      const tokenToRevoke = tokens.refresh_token || tokens.access_token;
      if (tokenToRevoke) await revokeAppleToken(tokenToRevoke);
    } catch (error) {
      console.error("[account-delete] Apple 授权撤销失败：", error);
      return NextResponse.json(
        { ok: false, message: "Apple 身份确认失败，请重试" },
        { status: 401 },
      );
    }
  }

  const [resources, comments, likes, signups, ownPosts] = await Promise.all([
    db.communityResource.findMany({
      where: { uploaderId: user.id },
      select: { storageKey: true },
    }),
    db.postComment.findMany({ where: { authorId: user.id }, select: { postId: true } }),
    db.postLike.findMany({ where: { userId: user.id }, select: { postId: true } }),
    db.eventSignup.findMany({ where: { userId: user.id }, select: { eventId: true } }),
    db.post.findMany({ where: { authorId: user.id }, select: { id: true } }),
  ]);
  const ownPostIds = new Set(ownPosts.map((post) => post.id));
  const affectedPostIds = [...new Set([...comments, ...likes].map((item) => item.postId))]
    .filter((id) => !ownPostIds.has(id));
  const affectedEventIds = [...new Set(signups.map((item) => item.eventId))];

  await db.$transaction(async (tx) => {
    // Feedback is intentionally retained for support history, but all account
    // identifiers and contact snapshots are removed.
    await tx.feedback.updateMany({
      where: { userId: user.id },
      data: { userId: null, userEmail: null, userName: null, contact: null },
    });
    if (account.email) {
      await tx.verificationCode.deleteMany({ where: { email: account.email } });
    }
    await tx.community.updateMany({
      where: { ownerId: user.id },
      data: { ownerId: null },
    });
    // Post.author is intentionally RESTRICT in the schema; delete the user's
    // shared content before deleting the user record. Child data cascades.
    await tx.post.deleteMany({ where: { authorId: user.id } });
    await tx.user.delete({ where: { id: user.id } });

    if (affectedPostIds.length > 0) {
      const [commentCounts, likeCounts] = await Promise.all([
        tx.postComment.groupBy({
          by: ["postId"],
          where: { postId: { in: affectedPostIds } },
          _count: { _all: true },
        }),
        tx.postLike.groupBy({
          by: ["postId"],
          where: { postId: { in: affectedPostIds } },
          _count: { _all: true },
        }),
      ]);
      const commentByPost = new Map(commentCounts.map((item) => [item.postId, item._count._all]));
      const likeByPost = new Map(likeCounts.map((item) => [item.postId, item._count._all]));
      await Promise.all(affectedPostIds.map((postId) => tx.post.updateMany({
        where: { id: postId },
        data: {
          commentCount: commentByPost.get(postId) ?? 0,
          likeCount: likeByPost.get(postId) ?? 0,
        },
      })));
    }
    if (affectedEventIds.length > 0) {
      const signupCounts = await tx.eventSignup.groupBy({
        by: ["eventId"],
        where: { eventId: { in: affectedEventIds } },
        _count: { _all: true },
      });
      const signupByEvent = new Map(signupCounts.map((item) => [item.eventId, item._count._all]));
      await Promise.all(affectedEventIds.map((eventId) => tx.event.updateMany({
        where: { id: eventId },
        data: { signupCount: signupByEvent.get(eventId) ?? 0 },
      })));
    }
  });

  await destroySession();

  const avatarFile = avatarFileNameFromPublicPath(account.avatarUrl);
  const avatarPath = avatarFile ? resolvedAvatarPath(avatarFile) : null;
  if (avatarPath) await unlink(avatarPath).catch((error) => {
    console.error("[account-delete] 删除头像文件失败：", error);
  });
  await Promise.all(resources.map(async ({ storageKey }) => {
    const storagePath = storageKey ? resolvedStoragePath(storageKey) : null;
    if (!storagePath) return;
    await unlink(storagePath).catch((error) => {
      console.error("[account-delete] 删除用户上传文件失败：", error);
    });
  }));

  return NextResponse.json({ ok: true, message: "账号和关联数据已永久删除" });
}

const ALLOWED_AVATAR_TYPES = new Set(["jpeg", "jpg", "png", "webp"]);

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

  // 落盘保存，数据库只记访问路径；旧的 base64 头像文件不存在，直接忽略。
  const extension = avatarExtensionFor(imageType);
  if (!extension) {
    return NextResponse.json(
      { ok: false, message: "仅支持 JPG、PNG 或 WebP 图片" },
      { status: 400 },
    );
  }
  const previous = await db.user.findUnique({
    where: { id: user.id },
    select: { avatarUrl: true },
  });
  const fileName = `${randomUUID()}.${extension}`;
  const targetPath = resolvedAvatarPath(fileName);
  if (!targetPath) {
    return NextResponse.json(
      { ok: false, message: "头像保存失败，请稍后重试" },
      { status: 500 },
    );
  }
  await mkdir(avatarUploadRoot(), { recursive: true });
  await writeFile(targetPath, imageBytes);

  const updated = await db.user.update({
    where: { id: user.id },
    data: { avatarUrl: avatarPublicPath(fileName) },
    select: { avatarUrl: true },
  });

  const previousFile = avatarFileNameFromPublicPath(previous?.avatarUrl);
  if (previousFile && previousFile !== fileName) {
    const previousPath = resolvedAvatarPath(previousFile);
    if (previousPath) await unlink(previousPath).catch(() => undefined);
  }

  return NextResponse.json({
    ok: true,
    message: "头像已更新",
    avatarUrl: updated.avatarUrl,
  });
}
