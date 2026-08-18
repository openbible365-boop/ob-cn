import { readFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

// 使 /bible 路径同样托管新版的 web-app 前端静态资源
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
