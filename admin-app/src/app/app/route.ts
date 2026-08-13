import { readFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

// App 端整合入口：托管 mobile-app 的构建产物。
//
// 网页版（/read）在窄屏时会跳到这里，让手机用户拿到原生感的 App 界面。
// 静态资源通过 public/assets 软链指向 mobile-app/dist/assets；
// 经文数据走 public/data（与网页版、后台共用根目录的 data/）。
//
// App 是 hash 路由的 SPA（#/bible、#/me …），所以这里只需返回 index.html。
export async function GET() {
  const indexPath = path.join(process.cwd(), "..", "mobile-app", "dist", "index.html");
  try {
    const html = await readFile(indexPath, "utf8");
    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return new Response(
      "App 端构建产物缺失：请先在 mobile-app 目录执行 npm run build",
      { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } },
    );
  }
}
