import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { findCommunityAccess } from "@/lib/community-access";
import { resolvedStoragePath } from "@/lib/community-resource-storage";
import { getSessionUser } from "@/lib/current-user";
import { db } from "@/lib/db";

export const runtime = "nodejs";

type RouteParams = {
  params: Promise<{ communityId: string; resourceId: string }>;
};

function error(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status });
}

function safeDownloadName(value: string) {
  return value.replace(/[\r\n"]/g, "_");
}

export async function GET(request: Request, { params }: RouteParams) {
  const user = await getSessionUser();
  if (!user) return error("请先登录", 401);

  const { communityId: reference, resourceId } = await params;
  const access = await findCommunityAccess(user.id, reference);
  if (!access) return error("你还不是这个社群的成员", 403);

  const resource = await db.communityResource.findFirst({
    where: {
      id: resourceId,
      communityId: access.community.id,
      status: "ACTIVE",
      ...(access.isAdmin ? {} : { visibility: "MEMBERS" as const }),
    },
    select: {
      fileName: true,
      mimeType: true,
      storageKey: true,
    },
  });
  if (!resource?.storageKey) return error("文件不存在", 404);

  const reqRange = request.headers.get("range");
  if (!reqRange || reqRange.startsWith("bytes=0-")) {
    await db.$transaction([
      db.communityResource.update({
        where: { id: resourceId },
        data: { downloadCount: { increment: 1 } },
      }),
      db.communityAuditLog.create({
        data: {
          communityId: access.community.id,
          actorId: user.id,
          action: "RESOURCE_DOWNLOAD",
          targetType: "CommunityResource",
          targetId: resourceId,
          detail: { fileName: resource.fileName },
        },
      }),
    ]).catch((err) => console.error("Failed to log download count", err));
  }

  const absolutePath = resolvedStoragePath(resource.storageKey);
  if (!absolutePath) return error("文件路径无效", 400);

  let fileStat;
  try {
    fileStat = await stat(absolutePath);
  } catch {
    return error("文件暂时无法读取", 404);
  }

  const mimeType = resource.mimeType || "application/octet-stream";
  const fileName = safeDownloadName(resource.fileName || "download");
  const inline =
    mimeType.startsWith("image/") ||
    mimeType.startsWith("audio/") ||
    mimeType.startsWith("video/") ||
    mimeType.startsWith("text/") ||
    mimeType === "application/pdf";
  const commonHeaders = {
    "Accept-Ranges": "bytes",
    "Content-Type": mimeType,
    "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    "Cache-Control": "private, max-age=300",
    "X-Content-Type-Options": "nosniff",
  };
  const range = request.headers.get("range");
  if (range) {
    const match = range.match(/^bytes=(\d*)-(\d*)$/);
    if (!match) return new Response(null, { status: 416 });
    const start = match[1] ? Number(match[1]) : 0;
    const end = match[2]
      ? Math.min(Number(match[2]), fileStat.size - 1)
      : fileStat.size - 1;
    if (
      !Number.isSafeInteger(start) ||
      !Number.isSafeInteger(end) ||
      start < 0 ||
      end < start ||
      start >= fileStat.size
    ) {
      return new Response(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${fileStat.size}` },
      });
    }
    const stream = createReadStream(absolutePath, { start, end });
    return new Response(Readable.toWeb(stream) as ReadableStream, {
      status: 206,
      headers: {
        ...commonHeaders,
        "Content-Length": String(end - start + 1),
        "Content-Range": `bytes ${start}-${end}/${fileStat.size}`,
      },
    });
  }

  const stream = createReadStream(absolutePath);
  return new Response(Readable.toWeb(stream) as ReadableStream, {
    headers: {
      ...commonHeaders,
      "Content-Length": String(fileStat.size),
    },
  });
}
