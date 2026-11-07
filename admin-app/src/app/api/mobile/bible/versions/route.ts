import { NextResponse } from "next/server";
import { listPublicVersions } from "@/lib/bible-versions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// App 启动时拉取的圣经版本清单（公开、无需登录）。
// 后台「圣经版本」页改动后，用户下次打开 App 生效。
export async function GET() {
  try {
    const versions = await listPublicVersions();
    return NextResponse.json(
      { ok: true, versions },
      { headers: { "Cache-Control": "no-cache" } },
    );
  } catch {
    return NextResponse.json({ ok: false, message: "版本清单暂不可用" }, { status: 503 });
  }
}
