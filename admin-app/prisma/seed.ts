import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });

async function main() {
  const passwordHash = await bcrypt.hash("admin12345", 10);
  await db.operator.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      username: "admin",
      passwordHash,
      name: "运营 · 超级管理员",
      role: "SUPER_ADMIN",
    },
  });

  const moderatorPasswordHash = await bcrypt.hash("moderator123", 10);
  await db.operator.upsert({
    where: { username: "moderator" },
    update: {},
    create: {
      username: "moderator",
      passwordHash: moderatorPasswordHash,
      name: "内容审核员",
      role: "MODERATOR",
    },
  });

  const alreadySeeded = (await db.user.count()) > 0;
  if (!alreadySeeded) {
    await seedUsersCommunitiesAndMemberships();
  }

  await seedAiAndDashboard();
  await seedContentModerationEventsAudit();
  await seedBibleAndCommentary();

  console.log("Seed complete.");
}

async function ensureUser(name: string, data: Parameters<typeof db.user.create>[0]["data"]) {
  const existing = await db.user.findFirst({ where: { name } });
  if (existing) return existing;
  return db.user.create({ data });
}

async function ensureMembership(userId: string, communityId: string) {
  await db.membership.upsert({
    where: { userId_communityId: { userId, communityId } },
    update: {},
    create: { userId, communityId, role: "MEMBER" },
  });
}

async function seedUsersCommunitiesAndMemberships() {
  const users = {
    platform: await db.user.create({
      data: { name: "平台运营", avatarColor: "#EEEFF4" },
    }),
    wang: await db.user.create({
      data: {
        name: "王弟兄",
        avatarColor: "#FFD465",
        authAccounts: {
          create: [{ provider: "EMAIL" }, { provider: "APPLE" }],
        },
      },
    }),
    chen: await db.user.create({
      data: {
        name: "陈姊妹",
        avatarColor: "#E9B7A5",
        authAccounts: {
          create: [{ provider: "EMAIL" }, { provider: "GOOGLE" }],
        },
      },
    }),
    li: await db.user.create({
      data: {
        name: "李弟兄",
        avatarColor: "#D9C2F0",
        authAccounts: { create: [{ provider: "EMAIL" }] },
      },
    }),
    zhang: await db.user.create({
      data: {
        name: "张长老",
        avatarColor: "#D9C2F0",
        authAccounts: { create: [{ provider: "EMAIL" }] },
      },
    }),
    liu: await db.user.create({
      data: {
        name: "刘姊妹",
        avatarColor: "#F0C7B7",
        authAccounts: { create: [{ provider: "EMAIL" }] },
      },
    }),
    zhao: await db.user.create({
      data: {
        name: "赵某",
        avatarColor: "#EEEFF4",
        status: "BANNED",
        banReason: "垃圾广告",
        authAccounts: { create: [{ provider: "EMAIL" }] },
      },
    }),
  };

  const huidu = await db.community.create({
    data: {
      name: "慧读总群",
      avatarColor: "#D9C2F0",
      isOfficial: true,
      tier: "OFFICIAL_FREE",
      tierPriceCents: 0,
      ownerId: users.platform.id,
      dailyActivity: 2140,
    },
  });

  const youth = await db.community.create({
    data: {
      name: "青年查经小组",
      avatarColor: "#FFD465",
      tier: "MID",
      tierPriceCents: 500,
      ownerId: users.wang.id,
      dailyActivity: 486,
      aiTokensToday: 182_000,
    },
  });

  const grace = await db.community.create({
    data: {
      name: "恩典读经群",
      avatarColor: "#D9C2F0",
      tier: "HIGH",
      tierPriceCents: 1000,
      ownerId: users.zhang.id,
      dailyActivity: 352,
      aiTokensToday: 121_000,
    },
  });

  const prayer = await db.community.create({
    data: {
      name: "姊妹祷告会",
      avatarColor: "#F0C7B7",
      tier: "BASIC_FREE",
      tierPriceCents: 0,
      ownerId: users.liu.id,
      warningCount: 1,
      dailyActivity: 291,
      aiTokensToday: 34_000,
    },
  });

  const workplace = await db.community.create({
    data: {
      name: "职场灵修站",
      avatarColor: "#F0C7B7",
      tier: "BASIC_FREE",
      tierPriceCents: 0,
      ownerId: users.li.id,
      dailyActivity: 204,
      aiTokensToday: 21_000,
    },
  });

  await db.membership.createMany({
    data: [
      { userId: users.platform.id, communityId: huidu.id, role: "OWNER" },
      { userId: users.wang.id, communityId: huidu.id, role: "MEMBER" },
      { userId: users.chen.id, communityId: huidu.id, role: "MEMBER" },
      { userId: users.li.id, communityId: huidu.id, role: "MEMBER" },
      { userId: users.zhang.id, communityId: huidu.id, role: "MEMBER" },
      { userId: users.liu.id, communityId: huidu.id, role: "MEMBER" },

      { userId: users.wang.id, communityId: youth.id, role: "OWNER" },
      { userId: users.chen.id, communityId: youth.id, role: "MEMBER" },
      { userId: users.li.id, communityId: youth.id, role: "MEMBER" },

      { userId: users.zhang.id, communityId: grace.id, role: "OWNER" },

      { userId: users.liu.id, communityId: prayer.id, role: "OWNER" },
      { userId: users.zhao.id, communityId: prayer.id, role: "MEMBER" },

      { userId: users.li.id, communityId: workplace.id, role: "OWNER" },
      { userId: users.wang.id, communityId: workplace.id, role: "MEMBER" },
    ],
  });
}

async function seedAiAndDashboard() {
  const tokenTotals: Record<string, number> = {
    青年查经小组: 182_000,
    恩典读经群: 121_000,
    姊妹祷告会: 34_000,
    职场灵修站: 21_000,
  };
  for (const [name, aiTokensToday] of Object.entries(tokenTotals)) {
    await db.community.updateMany({ where: { name }, data: { aiTokensToday } });
  }

  await db.aiSettings.upsert({
    where: { id: "singleton" },
    update: {},
    create: {
      id: "singleton",
      autoFallbackEnabled: true,
      rateLimited: false,
      monthLabel: "7 月",
      monthlyBudgetCents: 60_000,
      monthSpendCents: 37_200,
    },
  });

  await db.aiModel.upsert({
    where: { role: "PRIMARY" },
    update: {},
    create: {
      role: "PRIMARY",
      provider: "Anthropic",
      modelName: "claude-sonnet-4-5",
      temperature: 0.4,
      status: "NORMAL",
    },
  });

  await db.aiModel.upsert({
    where: { role: "BACKUP" },
    update: {},
    create: {
      role: "BACKUP",
      provider: "Zhipu",
      modelName: "glm-4.7",
      temperature: 0.4,
      status: "STANDBY",
    },
  });

  await db.promptVersion.upsert({
    where: { version: "v3.0" },
    update: {},
    create: {
      version: "v3.0",
      description: "初版三段式释经 Prompt",
      status: "ARCHIVED",
      rolloutPercent: 0,
      likeRatePct: 88.2,
      dislikeRatePct: 3.1,
    },
  });
  await db.promptVersion.upsert({
    where: { version: "v3.1" },
    update: {},
    create: {
      version: "v3.1",
      description: "增加免责声明注入与敏感话题绕行",
      status: "GA",
      rolloutPercent: 80,
      likeRatePct: 90.7,
      dislikeRatePct: 2.4,
    },
  });
  await db.promptVersion.upsert({
    where: { version: "v3.2" },
    update: {},
    create: {
      version: "v3.2",
      description: "强化三段式结构 + 释经框架约束收紧",
      status: "CANARY",
      rolloutPercent: 20,
      likeRatePct: 93.1,
      dislikeRatePct: 1.8,
    },
  });

  // ---------- Daily snapshots for the dashboard ----------
  // No real event pipeline yet (mobile/web clients are still static
  // prototypes) — this backfills 30 days of plausible history so the
  // dashboard reads from a real table instead of hardcoded numbers. A
  // future aggregation job can write into DailyMetric the same way.
  const DAYS = 30;
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const dauAt = (i: number) => {
    if (i <= 22) return 11000 * Math.pow(11537 / 11000, i / 22);
    return 11537 * Math.pow(12483 / 11537, (i - 22) / 7);
  };

  for (let i = 0; i < DAYS; i += 1) {
    const date = new Date(today);
    date.setUTCDate(date.getUTCDate() - (DAYS - 1 - i));

    const dau = Math.round(dauAt(i));
    const mau = Math.round(dau * 3.117);
    const wobble = Math.sin(i / 3) * 0.6;

    await db.dailyMetric.upsert({
      where: { date },
      update: {},
      create: {
        date,
        dau,
        mau,
        retentionD1Pct: Number((43.6 + wobble).toFixed(1)),
        retentionD7Pct: Number((27.4 + wobble * 0.5).toFixed(1)),
        retentionD30Pct: Number((18.9 + wobble * 0.3).toFixed(1)),
        huiduPenetrationPct: Number((37.8 + wobble * 0.4).toFixed(1)),
        avgRoundsPerSession: Number((3.4 + wobble * 0.05).toFixed(1)),
        bibleReadingPct: 46,
        huiduPct: 27,
        communityPct: 19,
        annotationPct: 8,
        aiCallCount: Math.round(dau * 0.658),
        aiTokenCount: Math.round(dau * 0.658 * 511),
        aiAvgFirstTokenMs: 1400 + Math.round(wobble * 20),
        aiLikeRatePct: Number((91 + wobble * 0.3).toFixed(1)),
      },
    });
  }

  await db.hotTopic.deleteMany({ where: { date: today } });
  await db.hotTopic.createMany({
    data: [
      { date: today, label: "重生的含义", rank: 1 },
      { date: today, label: "安息日", rank: 2 },
      { date: today, label: "希腊文原意", rank: 3 },
    ],
  });
}

async function seedContentModerationEventsAudit() {
  const chen = await db.user.findFirstOrThrow({ where: { name: "陈姊妹" } });
  const li = await db.user.findFirstOrThrow({ where: { name: "李弟兄" } });
  const zhao = await db.user.findFirstOrThrow({ where: { name: "赵某" } });
  const sun = await ensureUser("孙弟兄", {
    name: "孙弟兄",
    avatarColor: "#8FB8E8",
    authAccounts: { create: [{ provider: "EMAIL" }] },
  });

  const youth = await db.community.findFirstOrThrow({ where: { name: "青年查经小组" } });
  const grace = await db.community.findFirstOrThrow({ where: { name: "恩典读经群" } });
  const prayer = await db.community.findFirstOrThrow({ where: { name: "姊妹祷告会" } });
  const workplace = await db.community.findFirstOrThrow({ where: { name: "职场灵修站" } });

  await ensureMembership(sun.id, youth.id);
  await ensureMembership(zhao.id, grace.id);

  // ---------- Posts ----------
  const postsAlreadySeeded = (await db.post.count()) > 0;
  let postZhao: Awaited<ReturnType<typeof db.post.create>>;
  let postSun: Awaited<ReturnType<typeof db.post.create>>;

  if (!postsAlreadySeeded) {
    await db.post.create({
      data: {
        communityId: youth.id,
        authorId: chen.id,
        content: "今天重读这节，被「甚至」两个字击中——神的爱不是抽象的，是舍己的行动。",
        verseRef: "约翰福音 3:16 · 和合本",
        likeCount: 24,
        commentCount: 8,
      },
    });
    await db.post.create({
      data: {
        communityId: youth.id,
        authorId: li.id,
        content: "周五查经前建议大家先读完 3 章，把不明白的地方先问问慧读，带着问题来。",
        likeCount: 11,
        commentCount: 3,
      },
    });
    postZhao = await db.post.create({
      data: {
        communityId: grace.id,
        authorId: zhao.id,
        content: "加我微信购买特效保健品，包治百病，仅限今日！",
        likeCount: 0,
        commentCount: 0,
      },
    });
    postSun = await db.post.create({
      data: {
        communityId: youth.id,
        authorId: sun.id,
        content: "你们这群人懂什么，全都是异端，我看不下去了。",
        likeCount: 0,
        commentCount: 2,
      },
    });
  } else {
    postZhao = await db.post.findFirstOrThrow({ where: { authorId: zhao.id, communityId: grace.id } });
    postSun = await db.post.findFirstOrThrow({ where: { authorId: sun.id } });
  }

  // ---------- Sensitive word tiers ----------
  const wordTiers: [string, "BLOCK" | "REVIEW" | "LOG"][] = [
    ["加我微信", "BLOCK"], ["微商代理", "BLOCK"], ["刷单兼职", "BLOCK"],
    ["投资理财骗局", "BLOCK"], ["代购渠道", "BLOCK"], ["私自转账", "BLOCK"],
    ["免费领取活动", "BLOCK"], ["扫码领取奖品", "BLOCK"], ["贷款办理", "BLOCK"],
    ["彩票内幕", "BLOCK"], ["保健品推销", "BLOCK"], ["传销话术", "BLOCK"],
    ["异端指控", "REVIEW"], ["极端言论", "REVIEW"], ["挑衅性用语", "REVIEW"],
    ["煽动性内容", "REVIEW"], ["人身攻击用语", "REVIEW"], ["仇恨言论", "REVIEW"],
    ["轻微粗口", "LOG"], ["敏感政治词", "LOG"], ["待观察用语", "LOG"], ["争议性话题", "LOG"],
  ];
  for (const [word, level] of wordTiers) {
    await db.sensitiveWord.upsert({ where: { word }, update: {}, create: { word, level } });
  }

  // ---------- Reports ----------
  const reportsAlreadySeeded = (await db.report.count()) > 0;
  if (!reportsAlreadySeeded) {
    await db.report.create({
      data: {
        postId: postZhao.id,
        communityId: grace.id,
        contentSnapshot: postZhao.content,
        reason: "垃圾广告",
        hitLevel: "BLOCK",
      },
    });
    await db.report.create({
      data: {
        postId: postSun.id,
        communityId: youth.id,
        contentSnapshot: postSun.content,
        reason: "人身攻击",
        hitLevel: "REVIEW",
      },
    });
    await db.report.create({
      data: {
        postId: null,
        communityId: workplace.id,
        contentSnapshot: "活动「免费圣地旅游，先交定金」",
        reason: "虚假活动",
        hitLevel: "BLOCK",
      },
    });
  }

  // ---------- Events ----------
  const eventsAlreadySeeded = (await db.event.count()) > 0;
  if (!eventsAlreadySeeded) {
    const now = new Date();
    const inDays = (d: number) => new Date(now.getTime() + d * 86_400_000);

    await db.event.createMany({
      data: [
        { communityId: youth.id, title: "约翰福音 3 章共读", startAt: inDays(2), endAt: inDays(2.06), signupCount: 12 },
        { communityId: youth.id, title: "四福音 40 天通读", startAt: inDays(-18), endAt: inDays(22), signupCount: 20 },
        { communityId: grace.id, title: "一年读经计划 · 7 月主题分享", startAt: inDays(5), signupCount: 34 },
        { communityId: prayer.id, title: "晨祷接力", startAt: inDays(-1), endAt: inDays(-1), signupCount: 21 },
        { communityId: workplace.id, title: "职场伦理专题分享", startAt: inDays(-10), endAt: inDays(-10), signupCount: 9 },
      ],
    });
  }

  // ---------- Sample audit log history ----------
  const auditAlreadySeeded = (await db.auditLog.count()) > 0;
  if (!auditAlreadySeeded) {
    const admin = await db.operator.findUniqueOrThrow({ where: { username: "admin" } });
    await db.auditLog.createMany({
      data: [
        { operatorId: admin.id, action: "封禁用户", targetType: "User", targetId: zhao.id, detail: "赵某 · 原因：垃圾广告" },
        { operatorId: admin.id, action: "警告社群", targetType: "Community", targetId: prayer.id, detail: "姊妹祷告会 · 累计警告 1 次" },
      ],
    });
  }
}

async function seedBibleAndCommentary() {
  // Verse text is authentic public-domain 和合本 (新标点和合本，简体) sourced
  // from bolls.life and committed at prisma/data/john-cuv.json — not hand-typed.
  const versesAlreadySeeded = (await db.verse.count()) > 0;
  if (!versesAlreadySeeded) {
    const raw = readFileSync(join(__dirname, "data", "john-cuv.json"), "utf-8");
    const parsed = JSON.parse(raw) as {
      translation: string;
      book: string;
      bookOrder: number;
      verses: { chapter: number; verse: number; text: string }[];
    };

    await db.verse.createMany({
      data: parsed.verses.map((v) => ({
        translation: parsed.translation,
        book: parsed.book,
        bookOrder: parsed.bookOrder,
        chapter: v.chapter,
        verse: v.verse,
        text: v.text,
      })),
    });
  }

  // Study-Bible commentary is our own editorial content (matches the design's
  // 精读本注释), keyed to verse ranges within John 3.
  const commentaryAlreadySeeded = (await db.commentary.count()) > 0;
  if (!commentaryAlreadySeeded) {
    await db.commentary.createMany({
      data: [
        {
          book: "约翰福音",
          chapter: 3,
          rangeStart: 1,
          rangeEnd: 8,
          title: "3:1–8 · 重生的对话",
          body: "尼哥底母是法利赛人、犹太公会的成员，夜里来见耶稣，既出于谨慎，也暗示他尚在黑暗中摸索。「重生」原文亦作「从上头生」：不是道德修补，而是圣灵所赐的全新生命。「风随着意思吹」以风喻灵，指明重生是神主权的工作。",
        },
        {
          book: "约翰福音",
          chapter: 3,
          rangeStart: 9,
          rangeEnd: 15,
          title: "3:9–15 · 举蛇的预表",
          body: "耶稣引用民数记 21 章旷野举铜蛇的事件：百姓仰望铜蛇便得医治，预表人子将被举起在十字架上——凡仰望信靠他的，就得永生。「举起」在约翰福音中兼指被钉与得荣耀。",
        },
        {
          book: "约翰福音",
          chapter: 3,
          rangeStart: 16,
          rangeEnd: 17,
          title: "3:16–17 · 福音中的福音",
          highlight: true,
          body: "本段是整卷约翰福音信息的浓缩。「爱」（agapaō）指神主动、舍己的爱；「世人」表明这爱临到普世众人。「独生子」（monogenēs）强调基督与父独一无二的关系；「赐给」呼应 3:14 被举起的人子——爱在十字架上成为具体行动。定罪不是神差子的目的（3:17），信而得生才是。",
        },
        {
          book: "约翰福音",
          chapter: 3,
          rangeStart: 18,
          rangeEnd: 21,
          title: "3:18–21 · 光与黑暗的分野",
          body: "信与不信在此刻已分出结局：不信者「罪已经定了」。光来到世间成为试金石——人对光的态度显明其行为的本相；行真理的必来就光。",
        },
      ],
    });
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
