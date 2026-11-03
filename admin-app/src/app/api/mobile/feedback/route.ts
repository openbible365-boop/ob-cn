import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/current-user";
import { db } from "@/lib/db";

export const runtime = "nodejs";

// 意见反馈：App 内表单提交，允许匿名；已登录则快照用户信息便于后台定位。
// 防滥用：按 IP 内存限频（1 分钟 1 条、每天 10 条）+ 全局上限，单实例部署足够。
// 注意 XFF 最左值可被客户端伪造，按它建 key 可被换 IP 绕过——所以再加一道
// 不依赖 IP 的全局闸（每分钟 30 条封顶），伪造者最多把全局额度打满，写不穿表。
const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const RECENT_MAX_KEYS = 2000;
const recent = new Map<string, number[]>();
let globalWindow: number[] = [];

function rateLimited(ip: string): boolean {
  const now = Date.now();
  // 全局闸：所有来源合计每分钟最多 30 条（IP 可伪造，这道不看 IP）
  globalWindow = globalWindow.filter((t) => now - t < MINUTE_MS);
  if (globalWindow.length >= 30) return true;

  const list = (recent.get(ip) ?? []).filter((t) => now - t < DAY_MS);
  if (list.length >= 10) return true;
  if (list.length > 0 && now - list[list.length - 1] < MINUTE_MS) return true;

  // 防 Map 被伪造 IP 灌爆：超上限时先清掉已全部过期的 key，仍超则整体重置
  if (!recent.has(ip) && recent.size >= RECENT_MAX_KEYS) {
    for (const [key, stamps] of recent) {
      if (!stamps.some((t) => now - t < DAY_MS)) recent.delete(key);
    }
    if (recent.size >= RECENT_MAX_KEYS) recent.clear();
  }
  list.push(now);
  recent.set(ip, list);
  globalWindow.push(now);
  return false;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { content?: unknown; contact?: unknown }
    | null;
  const content = typeof body?.content === "string" ? body.content.trim() : "";
  const contact = typeof body?.contact === "string" ? body.contact.trim().slice(0, 120) : "";
  if (content.length < 5) {
    return NextResponse.json({ ok: false, message: "留言至少写 5 个字" }, { status: 400 });
  }
  if (content.length > 2000) {
    return NextResponse.json({ ok: false, message: "留言最长 2000 字" }, { status: 400 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (rateLimited(ip)) {
    return NextResponse.json({ ok: false, message: "提交太频繁了，请稍后再试" }, { status: 429 });
  }

  const user = await getSessionUser();
  await db.feedback.create({
    data: {
      content,
      contact: contact || null,
      userId: user?.id ?? null,
      userEmail: user?.email ?? null,
      userName: user?.name ?? null,
    },
  });
  return NextResponse.json({ ok: true, message: "已收到，感谢你的反馈！" });
}
