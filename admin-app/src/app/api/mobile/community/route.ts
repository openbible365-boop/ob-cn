import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { getSessionUser } from "@/lib/current-user";
import { db } from "@/lib/db";

const AVATAR_COLORS = new Set(["#FFD465", "#BF78F6", "#E98264", "#E1317D"]);

type CreateCommunityInput = {
  name?: unknown;
  abbreviation?: unknown;
  description?: unknown;
  avatarColor?: unknown;
};

function characterCount(value: string) {
  return Array.from(value).length;
}

export async function GET() {
  const user = await getSessionUser();
  const [communities, ownedCommunityCount] = await Promise.all([
    db.community.findMany({
      where: {
        status: "ACTIVE",
        OR: user
          ? [
              { isOfficial: true },
              { memberships: { some: { userId: user.id } } },
            ]
          : [{ isOfficial: true }],
      },
      select: {
        id: true,
        name: true,
        abbreviation: true,
        description: true,
        avatarColor: true,
        tier: true,
        isOfficial: true,
        memberships: user
          ? {
              where: { userId: user.id },
              select: { role: true },
              take: 1,
            }
          : false,
        _count: {
          select: {
            memberships: true,
            joinRequests: { where: { status: "PENDING" } },
          },
        },
      },
      orderBy: [{ isOfficial: "desc" }, { createdAt: "asc" }],
    }),
    user
      ? db.community.count({ where: { ownerId: user.id } })
      : Promise.resolve(0),
  ]);

  return NextResponse.json({
    ok: true,
    authenticated: Boolean(user),
    canCreateCommunity: Boolean(user) && ownedCommunityCount === 0,
    communities: communities.map((community) => ({
      id: community.isOfficial ? "official" : community.id,
      name: community.name,
      abbreviation: community.abbreviation,
      description: community.description,
      avatarColor: community.avatarColor,
      tier: community.tier,
      isOfficial: community.isOfficial,
      membershipRole:
        "memberships" in community
          ? community.memberships[0]?.role ?? null
          : null,
      memberCount: community._count.memberships,
      pendingJoinRequestCount:
        "memberships" in community &&
        ["OWNER", "ADMIN"].includes(community.memberships[0]?.role ?? "")
          ? community._count.joinRequests
          : 0,
    })),
  });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, message: "请先登录后创建社群" },
      { status: 401 },
    );
  }
  if (user.status !== "ACTIVE") {
    return NextResponse.json(
      { ok: false, message: "当前账号暂时无法创建社群" },
      { status: 403 },
    );
  }

  const ownedCommunity = await db.community.findFirst({
    where: { ownerId: user.id },
    select: { id: true },
  });
  if (ownedCommunity) {
    return NextResponse.json(
      { ok: false, message: "每位用户只能创建一个社群" },
      { status: 409 },
    );
  }

  let body: CreateCommunityInput;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, message: "请求格式错误" },
      { status: 400 },
    );
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const abbreviation =
    typeof body.abbreviation === "string"
      ? body.abbreviation.trim().normalize("NFC")
      : "";
  const description =
    typeof body.description === "string" ? body.description.trim() : "";
  const avatarColor =
    typeof body.avatarColor === "string" && AVATAR_COLORS.has(body.avatarColor)
      ? body.avatarColor
      : "#FFD465";

  if (!name || characterCount(name) > 20) {
    return NextResponse.json(
      { ok: false, message: "社群名称须为 1 到 20 个字" },
      { status: 400 },
    );
  }
  if (
    characterCount(abbreviation) < 1 ||
    characterCount(abbreviation) > 2 ||
    /\s/u.test(abbreviation)
  ) {
    return NextResponse.json(
      { ok: false, message: "社群简称须为 1 到 2 个字，且不能包含空格" },
      { status: 400 },
    );
  }
  if (characterCount(description) > 60) {
    return NextResponse.json(
      { ok: false, message: "社群简介不能超过 60 个字" },
      { status: 400 },
    );
  }

  try {
    const community = await db.community.create({
      data: {
        name,
        abbreviation,
        description: description || null,
        avatarColor,
        ownerId: user.id,
        tier: "BASIC_FREE",
        tierPriceCents: 0,
        memberships: {
          create: { userId: user.id, role: "OWNER" },
        },
      },
      select: {
        id: true,
        name: true,
        abbreviation: true,
        description: true,
        avatarColor: true,
        tier: true,
      },
    });

    return NextResponse.json({
      ok: true,
      message: "社群创建成功",
      community: { ...community, memberCount: 1 },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const alreadyOwnsCommunity = await db.community.count({
        where: { ownerId: user.id },
      });
      return NextResponse.json(
        {
          ok: false,
          message: alreadyOwnsCommunity
            ? "每位用户只能创建一个社群"
            : "这个社群简称已被使用，请换一个",
        },
        { status: 409 },
      );
    }
    console.error("Create community failed", error);
    return NextResponse.json(
      { ok: false, message: "社群创建失败，请稍后重试" },
      { status: 500 },
    );
  }
}
