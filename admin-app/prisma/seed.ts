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

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
