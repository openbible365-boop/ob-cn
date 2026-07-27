import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import {
  countCommunityPlanResources,
  findCommunityAccess,
  textLength,
} from "@/lib/community-access";
import {
  communityUploadRoot,
  extractPlainText,
  MAX_COMMUNITY_KNOWLEDGE_CHARS,
  MAX_COMMUNITY_RESOURCE_BYTES,
  resourceTypeForFile,
  safeUploadName,
} from "@/lib/community-resource-storage";
import { getSessionUser } from "@/lib/current-user";
import { db } from "@/lib/db";

export const runtime = "nodejs";

type RouteParams = { params: Promise<{ communityId: string }> };

function error(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status });
}

function formString(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request, { params }: RouteParams) {
  const user = await getSessionUser();
  if (!user) return error("请先登录", 401);
  if (user.status !== "ACTIVE") return error("当前账号暂时不能上传资料", 403);

  const { communityId: reference } = await params;
  const access = await findCommunityAccess(user.id, reference);
  if (!access) return error("你还不是这个社群的成员", 403);
  if (!access.isAdmin) return error("只有群主或管理员可以上传资料", 403);

  const currentCount = await countCommunityPlanResources(
    access.billingCommunityId,
  );
  if (
    access.entitlements.resourceLimit !== null &&
    currentCount >= access.entitlements.resourceLimit
  ) {
    return error(
      `当前方案最多保存 ${access.entitlements.resourceLimit} 份资料`,
      409,
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return error("上传格式不正确");
  }

  const uploaded = form.get("file");
  if (!(uploaded instanceof File) || uploaded.size === 0) {
    return error("请选择要上传的文件");
  }
  if (uploaded.size > MAX_COMMUNITY_RESOURCE_BYTES) {
    return error("单个文件不能超过 50 MB", 413);
  }

  const fileName = safeUploadName(uploaded.name);
  const title = formString(form, "title") || fileName;
  const description = formString(form, "description");
  const manualKnowledge = formString(form, "knowledgeText");
  const visibility = formString(form, "visibility") || "MEMBERS";
  if (!title || textLength(title) > 100) {
    return error("资料标题须为 1 到 100 个字");
  }
  if (textLength(description) > 1_000) {
    return error("资料说明不能超过 1000 个字");
  }
  if (textLength(manualKnowledge) > 30_000) {
    return error("供 AI 使用的文字不能超过 30000 个字");
  }
  if (visibility !== "MEMBERS" && visibility !== "ADMINS") {
    return error("资料可见范围不正确");
  }

  const mimeType = uploaded.type || "application/octet-stream";
  const bytes = new Uint8Array(await uploaded.arrayBuffer());
  const extractedText = extractPlainText(bytes, fileName, mimeType);
  const contentText = [manualKnowledge, extractedText]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, MAX_COMMUNITY_KNOWLEDGE_CHARS);
  const resourceType = resourceTypeForFile(fileName, mimeType);
  const resourceId = randomUUID();
  const storageKey = path.posix.join(
    access.community.id,
    `${resourceId}-${fileName}`,
  );
  const absolutePath = path.join(communityUploadRoot(), storageKey);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, bytes, { flag: "wx" });

  try {
    const url = `/api/mobile/community/${encodeURIComponent(access.community.id)}/resources/${encodeURIComponent(resourceId)}/content`;
    const resource = await db.communityResource.create({
      data: {
        id: resourceId,
        communityId: access.community.id,
        uploaderId: user.id,
        title,
        description: description || null,
        type: resourceType,
        url,
        contentText: contentText || null,
        fileName,
        mimeType,
        fileSize: uploaded.size,
        storageKey,
        indexedAt: contentText || description ? new Date() : null,
        visibility,
      },
      select: { id: true },
    });
    await db.communityAuditLog.create({
      data: {
        communityId: access.community.id,
        actorId: user.id,
        action: "RESOURCE_UPLOAD",
        targetType: "CommunityResource",
        targetId: resource.id,
        detail: {
          title,
          type: resourceType,
          visibility,
          fileName,
          fileSize: uploaded.size,
          indexed: Boolean(contentText || description),
        },
      },
    });
    return NextResponse.json({
      ok: true,
      message: contentText || description
        ? "文件已上传并加入本群知识库"
        : "文件已上传；补充资料说明后，AI 能更准确地使用它",
      resourceId: resource.id,
    });
  } catch (cause) {
    await unlink(absolutePath).catch(() => undefined);
    throw cause;
  }
}
