import { NextResponse } from "next/server";
import { countCommunityPlanMembers, findCommunityAccess } from "@/lib/community-access";
import { getSessionUser } from "@/lib/current-user";
import { db } from "@/lib/db";
import { createUserNotification } from "@/lib/user-notifications";

type RouteParams = {
  params: Promise<{ communityId: string }>;
};

type ReviewInput = {
  requestId?: unknown;
  decision?: unknown;
};

export async function GET(_request: Request, { params }: RouteParams) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, message: "请先登录" },
      { status: 401 },
    );
  }
  if (user.status !== "ACTIVE") {
    return NextResponse.json(
      { ok: false, message: "当前账号暂时不能执行此操作" },
      { status: 403 },
    );
  }

  const { communityId } = await params;
  const access = await findCommunityAccess(user.id, communityId);
  if (!access?.isAdmin) {
    return NextResponse.json(
      { ok: false, message: "只有群主或管理员可以处理加入申请" },
      { status: 403 },
    );
  }

  const requests = await db.communityJoinRequest.findMany({
    where: { communityId, status: "PENDING" },
    select: {
      id: true,
      message: true,
      createdAt: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          avatarColor: true,
          avatarUrl: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ ok: true, requests });
}

export async function POST(request: Request, { params }: RouteParams) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, message: "请先登录" },
      { status: 401 },
    );
  }
  if (user.status !== "ACTIVE") {
    return NextResponse.json(
      { ok: false, message: "当前账号暂时不能执行此操作" },
      { status: 403 },
    );
  }

  const { communityId } = await params;
  const access = await findCommunityAccess(user.id, communityId);
  if (!access?.isAdmin) {
    return NextResponse.json(
      { ok: false, message: "只有群主或管理员可以处理加入申请" },
      { status: 403 },
    );
  }

  let body: ReviewInput;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, message: "请求格式错误" },
      { status: 400 },
    );
  }

  const requestId =
    typeof body.requestId === "string" ? body.requestId.trim() : "";
  const decision = body.decision;
  if (!requestId || (decision !== "APPROVE" && decision !== "REJECT")) {
    return NextResponse.json(
      { ok: false, message: "请选择批准或拒绝" },
      { status: 400 },
    );
  }

  if (decision === "APPROVE" && access.entitlements.memberLimit !== null) {
    const memberCount = await countCommunityPlanMembers(access.billingCommunityId);
    if (memberCount >= access.entitlements.memberLimit) {
      return NextResponse.json(
        { ok: false, message: `当前方案最多允许 ${access.entitlements.memberLimit} 名成员，请先升级方案或移除闲置成员` },
        { status: 409 },
      );
    }
  }

  const result = await db.$transaction(async (transaction) => {
    const joinRequest = await transaction.communityJoinRequest.findFirst({
      where: { id: requestId, communityId, status: "PENDING" },
      select: { id: true, userId: true },
    });
    if (!joinRequest) return null;

    const update = await transaction.communityJoinRequest.updateMany({
      where: { id: requestId, communityId, status: "PENDING" },
      data: {
        status: decision === "APPROVE" ? "APPROVED" : "REJECTED",
        reviewerId: user.id,
        reviewedAt: new Date(),
      },
    });
    if (update.count !== 1) return null;

    if (decision === "APPROVE") {
      await transaction.membership.upsert({
        where: {
          userId_communityId: {
            userId: joinRequest.userId,
            communityId,
          },
        },
        update: {},
        create: {
          userId: joinRequest.userId,
          communityId,
          role: "MEMBER",
        },
      });
    }

    await transaction.communityAuditLog.create({
      data: {
        communityId: access.community.id,
        actorId: user.id,
        action: decision === "APPROVE" ? "MEMBER_JOIN_APPROVE" : "MEMBER_JOIN_REJECT",
        targetType: "User",
        targetId: joinRequest.userId,
        detail: { requestId },
      },
    });

    return joinRequest;
  });

  if (!result) {
    return NextResponse.json(
      { ok: false, message: "这项申请已被处理，请刷新后查看" },
      { status: 409 },
    );
  }

  await createUserNotification({
    userId: result.userId,
    preferenceKey: "join_updates",
    type: "JOIN_REVIEW",
    title: decision === "APPROVE" ? "入群申请已通过" : "入群申请未通过",
    body:
      decision === "APPROVE"
        ? `你已成为「${access.community.name}」的成员`
        : `你加入「${access.community.name}」的申请未通过`,
    href: decision === "APPROVE" ? `/community/${access.community.id}` : "/community",
    uniqueKey: `join-review:${requestId}:${decision}`,
  }).catch((cause) => console.error("Create join review notification failed", cause));

  return NextResponse.json({
    ok: true,
    message: decision === "APPROVE" ? "已批准加入社群" : "已拒绝加入申请",
  });
}
