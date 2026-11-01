import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/current-user";
import { db } from "@/lib/db";

export const runtime = "nodejs";

const MAX_PLAN_DAYS = 90;

type PresetDay = { dayNumber: number; title: string | null; book: string; chapter: number; verseStart: number; verseEnd: number };

// 整卷逐章计划：每天一章，起止节按和合本各章实际节数（末节号用于阅读页的打卡判定）
function chapterPerDay(book: string, lastVerses: number[], titles: Record<number, string> = {}): PresetDay[] {
  return lastVerses.map((verseEnd, index) => ({
    dayNumber: index + 1,
    title: titles[index + 1] ?? null,
    book,
    chapter: index + 1,
    verseStart: 1,
    verseEnd,
  }));
}

// 官方精选计划目录：长短搭配，新手一周起步，资深一月一卷
const PRESET_PLANS: Array<{ id: string; title: string; description: string; days: PresetDay[] }> = [
  {
    id: "openbible-starter-gospel-7",
    title: "七天认识耶稣",
    description: "从约翰福音的七段核心经文开始，建立稳定、可完成的每日阅读节奏。",
    days: [
      { dayNumber: 1, title: "道成肉身", book: "jhn", chapter: 1, verseStart: 1, verseEnd: 18 },
      { dayNumber: 2, title: "重生与永生", book: "jhn", chapter: 3, verseStart: 1, verseEnd: 21 },
      { dayNumber: 3, title: "生命的活水", book: "jhn", chapter: 4, verseStart: 1, verseEnd: 26 },
      { dayNumber: 4, title: "生命的粮", book: "jhn", chapter: 6, verseStart: 25, verseEnd: 40 },
      { dayNumber: 5, title: "好牧人", book: "jhn", chapter: 10, verseStart: 1, verseEnd: 18 },
      { dayNumber: 6, title: "道路、真理、生命", book: "jhn", chapter: 14, verseStart: 1, verseEnd: 14 },
      { dayNumber: 7, title: "复活与差遣", book: "jhn", chapter: 20, verseStart: 1, verseEnd: 31 },
    ],
  },
  {
    id: "openbible-philippians-4",
    title: "腓立比书的喜乐",
    description: "保罗在捆锁中写下的喜乐书信，四天读完，学习在任何境遇里喜乐。",
    days: chapterPerDay("php", [30, 30, 21, 23], {
      1: "活着就是基督", 2: "基督的心肠", 3: "竭力面前", 4: "知足的秘诀",
    }),
  },
  {
    id: "openbible-psalms-14",
    title: "诗篇安静心灵",
    description: "十四篇历代圣徒最常诵读的诗篇，每天一篇，在祷告与赞美中安静下来。",
    days: ([
      [1, 6], [8, 9], [16, 11], [19, 14], [23, 6], [27, 14], [42, 11],
      [46, 11], [51, 19], [62, 12], [90, 17], [103, 22], [121, 8], [139, 24],
    ] as const).map(([chapter, verseEnd], index) => ({
      dayNumber: index + 1, title: `诗篇 ${chapter} 篇`, book: "psa", chapter, verseStart: 1, verseEnd,
    })),
  },
  {
    id: "openbible-mark-16",
    title: "马可福音纵览",
    description: "节奏最快的一卷福音书，十六天逐章走完耶稣的脚踪，从加利利直到空坟墓。",
    days: chapterPerDay("mrk", [45, 28, 35, 41, 43, 56, 37, 38, 50, 52, 33, 44, 37, 72, 47, 20]),
  },
  {
    id: "openbible-proverbs-31",
    title: "箴言智慧之路",
    description: "箴言正好三十一章，一天一章，用一个月把智慧的言语存在心里。",
    days: chapterPerDay("pro", [
      33, 22, 35, 27, 23, 35, 27, 36, 18, 32, 31, 28, 25, 35, 33,
      33, 28, 24, 29, 30, 31, 29, 35, 34, 28, 28, 27, 28, 27, 33, 31,
    ]),
  },
];

async function ensurePresetPlans() {
  for (const preset of PRESET_PLANS) {
    await db.readingPlan.upsert({
      where: { id: preset.id },
      // 文案以代码目录为准，可随版本修订；日程不动，不影响已有进度
      update: { title: preset.title, description: preset.description },
      create: {
        id: preset.id,
        title: preset.title,
        description: preset.description,
        scope: "PUBLIC",
        totalDays: preset.days.length,
        days: {
          create: preset.days.map((day) => ({ ...day, translation: "cuv" })),
        },
      },
    });
  }
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, message: "请先登录" }, { status: 401 });
  }

  await ensurePresetPlans();
  const memberships = await db.membership.findMany({
    where: { userId: user.id, community: { status: "ACTIVE" } },
    select: { communityId: true },
  });
  const communityIds = memberships.map((membership) => membership.communityId);
  const plans = await db.readingPlan.findMany({
    where: {
      OR: [
        { scope: "PUBLIC" },
        { creatorId: user.id },
        ...(communityIds.length
          ? [{ scope: "COMMUNITY" as const, communityId: { in: communityIds } }]
          : []),
      ],
    },
    include: {
      community: { select: { id: true, name: true, abbreviation: true } },
      days: { orderBy: { dayNumber: "asc" } },
      enrollments: {
        where: { userId: user.id },
        select: {
          id: true,
          completedDays: true,
          startedAt: true,
          lastReadAt: true,
          completedAt: true,
        },
      },
    },
    orderBy: [{ scope: "asc" }, { createdAt: "desc" }],
  });

  return NextResponse.json({
    ok: true,
    plans: plans.map((plan) => {
      const enrollment = plan.enrollments[0] ?? null;
      const completedDays = Math.min(enrollment?.completedDays ?? 0, plan.totalDays);
      const today = plan.days[Math.min(completedDays, plan.days.length - 1)] ?? null;
      return {
        id: plan.id,
        title: plan.title,
        description: plan.description,
        scope: plan.scope,
        totalDays: plan.totalDays,
        community: plan.community,
        enrolled: Boolean(enrollment),
        completedDays,
        completedAt: enrollment?.completedAt ?? null,
        today,
        // 完整日程：客户端据此展开「全部 N 天」并逐日跳转到对应经文
        days: plan.days.map((day) => ({
          dayNumber: day.dayNumber,
          title: day.title,
          book: day.book,
          chapter: day.chapter,
          verseStart: day.verseStart,
          verseEnd: day.verseEnd,
        })),
      };
    }),
  });
}

type ReadingInput = {
  title?: unknown;
  translation?: unknown;
  book?: unknown;
  chapter?: unknown;
  verseStart?: unknown;
  verseEnd?: unknown;
};

type RequestBody = {
  action?: unknown;
  planId?: unknown;
  title?: unknown;
  description?: unknown;
  communityId?: unknown;
  readings?: unknown;
};

function parseReading(value: ReadingInput, index: number) {
  const book = typeof value.book === "string" ? value.book.trim().toLowerCase() : "";
  const translation =
    typeof value.translation === "string" ? value.translation.trim().toLowerCase() : "cuv";
  const chapter = Number(value.chapter);
  const verseStart = Number(value.verseStart);
  const verseEnd = Number(value.verseEnd ?? value.verseStart);
  if (
    !/^[a-z0-9_-]{2,20}$/.test(book) ||
    !/^[a-z0-9_-]{2,20}$/.test(translation) ||
    !Number.isInteger(chapter) || chapter < 1 || chapter > 200 ||
    !Number.isInteger(verseStart) || verseStart < 1 || verseStart > 300 ||
    !Number.isInteger(verseEnd) || verseEnd < verseStart || verseEnd > 300
  ) return null;
  return {
    dayNumber: index + 1,
    title: typeof value.title === "string" ? value.title.trim().slice(0, 80) || null : null,
    translation,
    book,
    chapter,
    verseStart,
    verseEnd,
  };
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, message: "请先登录" }, { status: 401 });
  }

  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "请求格式不正确" }, { status: 400 });
  }

  const action = typeof body.action === "string" ? body.action : "";
  const planId = typeof body.planId === "string" ? body.planId.trim() : "";

  if (action === "ENROLL") {
    const plan = await db.readingPlan.findFirst({
      where: {
        id: planId,
        OR: [
          { scope: "PUBLIC" },
          { creatorId: user.id },
          {
            scope: "COMMUNITY",
            community: { memberships: { some: { userId: user.id } } },
          },
        ],
      },
      select: { id: true },
    });
    if (!plan) {
      return NextResponse.json({ ok: false, message: "读经计划不存在或无权加入" }, { status: 404 });
    }
    await db.readingPlanEnrollment.upsert({
      where: { planId_userId: { planId, userId: user.id } },
      update: {},
      create: { planId, userId: user.id },
    });
    return NextResponse.json({ ok: true, message: "已加入读经计划" });
  }

  if (action === "COMPLETE_TODAY") {
    const enrollment = await db.readingPlanEnrollment.findUnique({
      where: { planId_userId: { planId, userId: user.id } },
      include: { plan: { select: { totalDays: true } } },
    });
    if (!enrollment) {
      return NextResponse.json({ ok: false, message: "请先加入这个计划" }, { status: 404 });
    }
    const nextCompleted = Math.min(enrollment.completedDays + 1, enrollment.plan.totalDays);
    await db.readingPlanEnrollment.update({
      where: { id: enrollment.id },
      data: {
        completedDays: nextCompleted,
        lastReadAt: new Date(),
        completedAt: nextCompleted >= enrollment.plan.totalDays ? new Date() : null,
      },
    });
    return NextResponse.json({
      ok: true,
      message: nextCompleted >= enrollment.plan.totalDays ? "计划已完成，愿你继续持守阅读" : "今天的阅读已完成",
    });
  }

  if (action !== "CREATE") {
    return NextResponse.json({ ok: false, message: "不支持的读经计划操作" }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title.trim().slice(0, 80) : "";
  const description =
    typeof body.description === "string" ? body.description.trim().slice(0, 300) || null : null;
  const communityId =
    typeof body.communityId === "string" ? body.communityId.trim() || null : null;
  const rawReadings = Array.isArray(body.readings) ? body.readings.slice(0, MAX_PLAN_DAYS) : [];
  const readings = rawReadings.map((reading, index) =>
    reading && typeof reading === "object"
      ? parseReading(reading as ReadingInput, index)
      : null,
  );
  if (!title || !readings.length || readings.some((reading) => !reading)) {
    return NextResponse.json({ ok: false, message: "请填写计划名称和有效的每日经文" }, { status: 400 });
  }

  if (communityId) {
    const membership = await db.membership.findFirst({
      where: {
        userId: user.id,
        communityId,
        role: { in: ["OWNER", "ADMIN"] },
        community: { status: "ACTIVE" },
      },
      select: { id: true },
    });
    if (!membership) {
      return NextResponse.json({ ok: false, message: "只有群主或管理员可以创建群读经计划" }, { status: 403 });
    }
  }

  const plan = await db.readingPlan.create({
    data: {
      creatorId: user.id,
      communityId,
      title,
      description,
      scope: communityId ? "COMMUNITY" : "PERSONAL",
      totalDays: readings.length,
      days: { create: readings.filter((reading): reading is NonNullable<typeof reading> => Boolean(reading)) },
      enrollments: {
        create: { userId: user.id },
      },
    },
    select: { id: true },
  });
  return NextResponse.json({ ok: true, message: "读经计划已创建", planId: plan.id });
}
