import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { AVATAR_MIME_BY_TYPE, resolvedAvatarPath } from "@/lib/avatar-storage";

export const runtime = "nodejs";

type RouteParams = { params: Promise<{ fileName: string }> };

// 头像文件名是随机 UUID，猜不到也不含个人信息；这里不要求登录，
// 未登录浏览公共社群时同样能看到作者头像。
export async function GET(_request: Request, { params }: RouteParams) {
  const { fileName } = await params;
  const absolutePath = resolvedAvatarPath(fileName);
  if (!absolutePath) {
    return NextResponse.json({ ok: false, message: "头像不存在" }, { status: 404 });
  }

  let bytes: Buffer;
  try {
    bytes = await readFile(absolutePath);
  } catch {
    return NextResponse.json({ ok: false, message: "头像不存在" }, { status: 404 });
  }

  const extension = path.extname(fileName).slice(1).toLowerCase();
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": AVATAR_MIME_BY_TYPE[extension] ?? "application/octet-stream",
      // 换头像会生成新文件名，所以内容可以长期缓存。
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
