// 把历史上以 base64 data URI 存在 User.avatarUrl 的头像迁移到文件存储。
// 用法：DATABASE_URL=... npx tsx scripts/migrate-avatars.ts
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import {
  avatarExtensionFor,
  avatarPublicPath,
  avatarUploadRoot,
  resolvedAvatarPath,
} from "../src/lib/avatar-storage";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL 未配置，无法迁移头像");
}

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main() {
  const users = await db.user.findMany({
    where: { avatarUrl: { startsWith: "data:image/" } },
    select: { id: true, name: true, avatarUrl: true },
  });
  if (users.length === 0) {
    console.log("没有需要迁移的 base64 头像");
    return;
  }
  await mkdir(avatarUploadRoot(), { recursive: true });

  let migrated = 0;
  let skipped = 0;
  for (const user of users) {
    const match = user.avatarUrl?.match(
      /^data:image\/([a-z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/i,
    );
    const extension = match ? avatarExtensionFor(match[1].toLowerCase()) : null;
    if (!match || !extension) {
      console.warn(`跳过 ${user.name}：头像格式无法识别`);
      skipped += 1;
      continue;
    }
    const fileName = `${randomUUID()}.${extension}`;
    const targetPath = resolvedAvatarPath(fileName);
    if (!targetPath) {
      console.warn(`跳过 ${user.name}：目标路径无效`);
      skipped += 1;
      continue;
    }
    await writeFile(targetPath, Buffer.from(match[2], "base64"));
    await db.user.update({
      where: { id: user.id },
      data: { avatarUrl: avatarPublicPath(fileName) },
    });
    migrated += 1;
  }
  console.log(`头像迁移完成：成功 ${migrated} 个，跳过 ${skipped} 个`);
}

main()
  .catch((cause) => {
    console.error(cause);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
