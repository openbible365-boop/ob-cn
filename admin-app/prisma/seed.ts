import "dotenv/config";
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

  const alreadySeeded = (await db.user.count()) > 0;
  if (!alreadySeeded) {
    await seedUsersCommunitiesAndMemberships();
  }

  await seedAiAndDashboard();

  console.log("Seed complete.");
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

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
