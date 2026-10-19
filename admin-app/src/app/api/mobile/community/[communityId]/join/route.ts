import { NextResponse } from "next/server";
import { countCommunityPlanMembers, COMMUNITY_ENTITLEMENTS } from "@/lib/community-access";
import { getSessionUser } from "@/lib/current-user";
import { db } from "@/lib/db";
import { createUserNotification } from "@/lib/user-notifications";

type RouteParams = { params: Promise<{ communityId: string }> };

export async function POST(_request: Request, { params }: RouteParams) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, message: "请先登录后加入社群" }, { status: 401 });
  }
  if (user.status !== "ACTIVE") {
    return NextResponse.json({ ok: false, message: "当前账号暂时不能加入社群" }, { status: 403 });
  }

  const { communityId } = await params;
  const community = await db.community.findFirst({
    where: { id: communityId, status: "ACTIVE", isOfficial: false },
    select: { id: true, name: true, parentId: true, joinPolicy: true, tier: true },
  });
  if (!community) {
    return NextResponse.json({ ok: false, message: "这个社群不存在或已经关闭" }, { status: 404 });
  }
  const existing = await db.membership.findUnique({
    where: { userId_communityId: { userId: user.id, communityId } },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json({ ok: true, state: "JOINED", message: `你已经是「${community.name}」的成员` });
  }
  if (community.joinPolicy === "INVITE_ONLY") {
    return NextResponse.json({ ok: false, message: "这个社群目前仅限受邀用户加入" }, { status: 403 });
  }

  const memberLimit = COMMUNITY_ENTITLEMENTS[community.tier].memberLimit;
  if (memberLimit !== null) {
    const memberCount = await countCommunityPlanMembers(community.parentId ?? community.id);
    if (memberCount >= memberLimit) {
      return NextResponse.json({ ok: false, message: "这个社群的成员名额已满" }, { status: 409 });
    }
  }

  if (community.joinPolicy === "OPEN") {
    await db.membership.create({ data: { userId: user.id, communityId } });
    return NextResponse.json({ ok: true, state: "JOINED", message: `已加入「${community.name}」` });
  }

  const joinRequest = await db.communityJoinRequest.upsert({
    where: { userId_communityId: { userId: user.id, communityId } },
    update: { status: "PENDING", reviewerId: null, reviewedAt: null },
    create: { userId: user.id, communityId, status: "PENDING" },
    select: { id: true, updatedAt: true },
  });
  const reviewers = await db.membership.findMany({
    where: { communityId, role: { in: ["OWNER", "ADMIN"] } },
    select: { userId: true },
  });
  for (const { userId } of reviewers) {
    await createUserNotification({
        userId,
        preferenceKey: "join_updates",
        type: "JOIN_REQUEST",
        title: "收到新的入群申请",
        body: `${user.name} 申请加入「${community.name}」`,
        href: `/community/${community.id}/settings`,
        uniqueKey: `join-request:${joinRequest.id}:${joinRequest.updatedAt.toISOString()}`,
      }).catch((cause) => console.error("Create join request notification failed", cause));
  }
  return NextResponse.json({ ok: true, state: "PENDING", message: `已提交加入「${community.name}」的申请` });
}
