import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/current-user";
import { db } from "@/lib/db";

type RouteParams = {
  params: Promise<{ communityId: string }>;
};

type ReviewInput = {
  requestId?: unknown;
  decision?: unknown;
};

async function canReviewJoinRequests(userId: string, communityId: string) {
  return db.community.findFirst({
    where: {
      id: communityId,
      status: "ACTIVE",
      memberships: {
        some: {
          userId,
          role: { in: ["OWNER", "ADMIN"] },
        },
      },
    },
    select: { id: true },
  });
}

export async function GET(_request: Request, { params }: RouteParams) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, message: "请先登录" },
      { status: 401 },
    );
  }

  const { communityId } = await params;
  if (!(await canReviewJoinRequests(user.id, communityId))) {
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

  const { communityId } = await params;
  if (!(await canReviewJoinRequests(user.id, communityId))) {
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

    return joinRequest;
  });

  if (!result) {
    return NextResponse.json(
      { ok: false, message: "这项申请已被处理，请刷新后查看" },
      { status: 409 },
    );
  }

  return NextResponse.json({
    ok: true,
    message: decision === "APPROVE" ? "已批准加入社群" : "已拒绝加入申请",
  });
}
