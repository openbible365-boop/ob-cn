// 为账号开通 / 重置账号密码登录（商店审核、内部测试用）。
// 登录名不存在时会新建一个 App 用户；已存在则只重置密码。
//
// 用法（密码通过环境变量传入，避免出现在命令历史与仓库里）：
//   LOGIN_PASSWORD='...' npx tsx scripts/set-user-password.ts <登录名> [显示名]
// 生产容器内：
//   docker exec -e LOGIN_PASSWORD='...' ob-cn-admin npx tsx scripts/set-user-password.ts TestUser
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { loadEnv } from "./load-env";

loadEnv();

const MIN_PASSWORD_LENGTH = 8;
const LOGIN_NAME_RE = /^[a-z0-9][a-z0-9._-]{2,31}$/;

async function main(): Promise<void> {
  const [rawLoginName = "", rawDisplayName = ""] = process.argv.slice(2);
  const loginName = rawLoginName.trim().toLowerCase();
  const displayName = rawDisplayName.trim() || rawLoginName.trim();
  const password = process.env.LOGIN_PASSWORD ?? "";

  if (!LOGIN_NAME_RE.test(loginName)) {
    throw new Error("登录名需为 3–32 位字母、数字或 . _ -，且以字母或数字开头");
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`请通过 LOGIN_PASSWORD 环境变量提供至少 ${MIN_PASSWORD_LENGTH} 位的密码`);
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL 未配置");
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const existing = await db.userPassword.findUnique({ where: { loginName } });
    if (existing) {
      await db.userPassword.update({ where: { loginName }, data: { passwordHash } });
      process.stdout.write(`已重置密码：${loginName}（用户 ${existing.userId}）\n`);
      return;
    }

    const user = await db.user.create({
      data: {
        name: displayName,
        password: { create: { loginName, passwordHash } },
      },
    });
    process.stdout.write(`已创建账号：${loginName}（用户 ${user.id}，显示名 ${user.name}）\n`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
