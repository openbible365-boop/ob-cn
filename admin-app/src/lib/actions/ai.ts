"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { requireRole } from "@/lib/authz";

export async function toggleAutoFallback() {
  const session = await requireRole(["SUPER_ADMIN"]);
  const settings = await db.aiSettings.findUniqueOrThrow({ where: { id: "singleton" } });
  const next = !settings.autoFallbackEnabled;
  await db.aiSettings.update({
    where: { id: "singleton" },
    data: { autoFallbackEnabled: next },
  });

  await logAudit({
    operatorId: session.user.id,
    action: "切换自动降级",
    targetType: "AiSettings",
    targetId: "singleton",
    detail: `主模型异常自动降级：${next ? "开启" : "关闭"}`,
  });

  revalidatePath("/admin/ai");
}

export async function toggleRateLimit() {
  const session = await requireRole(["SUPER_ADMIN"]);
  const settings = await db.aiSettings.findUniqueOrThrow({ where: { id: "singleton" } });
  const next = !settings.rateLimited;
  await db.aiSettings.update({
    where: { id: "singleton" },
    data: { rateLimited: next },
  });

  await logAudit({
    operatorId: session.user.id,
    action: "切换全局限流",
    targetType: "AiSettings",
    targetId: "singleton",
    detail: `全局限流：${next ? "开启" : "解除"}`,
  });

  revalidatePath("/admin/ai");
}

export async function updateApiKey(formData: FormData) {
  const session = await requireRole(["SUPER_ADMIN"]);
  const modelId = String(formData.get("modelId"));
  const newKey = String(formData.get("newKey") ?? "").trim();
  if (newKey.length < 8) throw new Error("API Key 长度不足");

  const model = await db.aiModel.update({
    where: { id: modelId },
    data: { apiKeyLast4: newKey.slice(-4), apiKeyUpdatedAt: new Date() },
  });

  await logAudit({
    operatorId: session.user.id,
    action: "更新 API Key",
    targetType: "AiModel",
    targetId: model.id,
    detail: `${model.modelName} · 末四位 ${model.apiKeyLast4}`,
  });

  revalidatePath("/admin/ai");
}

export async function createPromptVersion(formData: FormData) {
  const session = await requireRole(["SUPER_ADMIN"]);
  const version = String(formData.get("version") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  if (!version || !description) throw new Error("版本号和说明不能为空");

  const created = await db.promptVersion.create({
    data: { version, description, status: "CANARY", rolloutPercent: 10 },
  });

  await logAudit({
    operatorId: session.user.id,
    action: "新建 Prompt 版本",
    targetType: "PromptVersion",
    targetId: created.id,
    detail: `${version} · ${description}`,
  });

  revalidatePath("/admin/ai");
}

export async function expandCanary(formData: FormData) {
  const session = await requireRole(["SUPER_ADMIN"]);
  const id = String(formData.get("id"));
  const current = await db.promptVersion.findUniqueOrThrow({ where: { id } });
  const nextRollout = Math.min(100, current.rolloutPercent + 20);
  const promotedToGa = nextRollout >= 100;

  if (promotedToGa) {
    await db.promptVersion.updateMany({
      where: { status: "GA" },
      data: { status: "ARCHIVED", rolloutPercent: 0 },
    });
    await db.promptVersion.update({
      where: { id },
      data: { status: "GA", rolloutPercent: 100 },
    });
  } else {
    await db.promptVersion.update({
      where: { id },
      data: { rolloutPercent: nextRollout },
    });
  }

  await logAudit({
    operatorId: session.user.id,
    action: "扩大灰度",
    targetType: "PromptVersion",
    targetId: id,
    detail: promotedToGa
      ? `${current.version} 已转为全量`
      : `${current.version} 灰度扩大至 ${nextRollout}%`,
  });

  revalidatePath("/admin/ai");
}

export async function editPromptVersion(formData: FormData) {
  const session = await requireRole(["SUPER_ADMIN"]);
  const id = String(formData.get("id"));
  const description = String(formData.get("description") ?? "").trim();
  const rolloutPercent = Number(formData.get("rolloutPercent"));
  if (!description) throw new Error("说明不能为空");
  if (!Number.isFinite(rolloutPercent) || rolloutPercent < 0 || rolloutPercent > 100) {
    throw new Error("灰度比例需在 0-100 之间");
  }

  const updated = await db.promptVersion.update({
    where: { id },
    data: { description, rolloutPercent },
  });

  await logAudit({
    operatorId: session.user.id,
    action: "编辑 Prompt 版本",
    targetType: "PromptVersion",
    targetId: id,
    detail: `${updated.version} · ${description}（灰度 ${rolloutPercent}%）`,
  });

  revalidatePath("/admin/ai");
}

export async function rollbackToVersion(formData: FormData) {
  const session = await requireRole(["SUPER_ADMIN"]);
  const id = String(formData.get("id"));
  const target = await db.promptVersion.findUniqueOrThrow({ where: { id } });

  await db.promptVersion.updateMany({
    where: { status: "GA" },
    data: { status: "ARCHIVED", rolloutPercent: 0 },
  });
  await db.promptVersion.update({
    where: { id },
    data: { status: "GA", rolloutPercent: 100 },
  });

  await logAudit({
    operatorId: session.user.id,
    action: "回滚 Prompt 版本",
    targetType: "PromptVersion",
    targetId: id,
    detail: `回滚至 ${target.version}`,
  });

  revalidatePath("/admin/ai");
}

export async function updateCommunityTokenLimit(formData: FormData) {
  const session = await requireRole(["SUPER_ADMIN"]);
  const communityId = String(formData.get("communityId"));
  const raw = String(formData.get("limit") ?? "").trim();
  const limit = raw === "" ? null : Number(raw);
  if (limit !== null && (!Number.isFinite(limit) || limit < 0)) {
    throw new Error("限额需为非负数字");
  }

  const community = await db.community.update({
    where: { id: communityId },
    data: { aiTokenDailyLimit: limit },
  });

  await logAudit({
    operatorId: session.user.id,
    action: "调整社群 Token 限额",
    targetType: "Community",
    targetId: community.id,
    detail: `${community.name} · ${limit != null ? `${limit / 1000}K/日` : "不限"}`,
  });

  revalidatePath("/admin/ai");
}
