import { readFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

// 网页版整合入口：admin-app 直接托管 web-app 的前端页面，
// 与 /api/web/* 同源，省掉跨域与 Cookie 的麻烦。
// 静态资源（/js /css /images /data）通过 public/ 下的软链指向同一份源文件。
export async function GET() {
  const indexPath = path.join(process.cwd(), "..", "web-app", "index.html");
  try {
    const html = await readFile(indexPath, "utf8");
    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return new Response("网页版前端文件缺失", { status: 404 });
  }
}
