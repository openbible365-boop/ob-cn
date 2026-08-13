import { config } from "dotenv";

// 按 Next.js 的优先级加载环境文件，让脚本看到的配置与应用运行时完全一致。
// 顺序即优先级（dotenv 不覆盖已存在的值，所以先加载的胜出）：
//   .env.<NODE_ENV>.local  →  .env.local  →  .env.<NODE_ENV>  →  .env
// 少读 .env.<NODE_ENV>.local 会踩坑：本地 `prisma dev` 把 PGlite 的 DATABASE_URL
// 写在那里，只读 .env 会连到另一个根本没跑的库上。
export function loadEnv() {
  const mode = process.env.NODE_ENV ?? "development";
  const files = [`.env.${mode}.local`, ".env.local", `.env.${mode}`, ".env"];
  // 与 Next.js 一致：test 环境不读 .env.local，避免开发配置污染测试
  const ordered = mode === "test" ? files.filter((f) => f !== ".env.local") : files;
  for (const path of ordered) config({ path, quiet: true });
}
