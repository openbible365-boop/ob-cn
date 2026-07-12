"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/lib/db";

async function requireOperator() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  return session;
}

export async function toggleAutoFallback() {
  await requireOperator();
  const settings = await db.aiSettings.findUniqueOrThrow({ where: { id: "singleton" } });
  await db.aiSettings.update({
    where: { id: "singleton" },
    data: { autoFallbackEnabled: !settings.autoFallbackEnabled },
  });
  revalidatePath("/ai");
}

export async function toggleRateLimit() {
  await requireOperator();
  const settings = await db.aiSettings.findUniqueOrThrow({ where: { id: "singleton" } });
  await db.aiSettings.update({
    where: { id: "singleton" },
    data: { rateLimited: !settings.rateLimited },
  });
  revalidatePath("/ai");
}

export async function updateApiKey(formData: FormData) {
  await requireOperator();
  const modelId = String(formData.get("modelId"));
  const newKey = String(formData.get("newKey") ?? "").trim();
  if (newKey.length < 8) throw new Error("API Key 长度不足");

  await db.aiModel.update({
    where: { id: modelId },
    data: { apiKeyLast4: newKey.slice(-4), apiKeyUpdatedAt: new Date() },
  });
  revalidatePath("/ai");
}

export async function createPromptVersion(formData: FormData) {
  await requireOperator();
  const version = String(formData.get("version") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  if (!version || !description) throw new Error("版本号和说明不能为空");

  await db.promptVersion.create({
    data: { version, description, status: "CANARY", rolloutPercent: 10 },
  });
  revalidatePath("/ai");
}

export async function expandCanary(formData: FormData) {
  await requireOperator();
  const id = String(formData.get("id"));
  const current = await db.promptVersion.findUniqueOrThrow({ where: { id } });
  const nextRollout = Math.min(100, current.rolloutPercent + 20);

  if (nextRollout >= 100) {
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
  revalidatePath("/ai");
}

export async function editPromptVersion(formData: FormData) {
  await requireOperator();
  const id = String(formData.get("id"));
  const description = String(formData.get("description") ?? "").trim();
  const rolloutPercent = Number(formData.get("rolloutPercent"));
  if (!description) throw new Error("说明不能为空");
  if (!Number.isFinite(rolloutPercent) || rolloutPercent < 0 || rolloutPercent > 100) {
    throw new Error("灰度比例需在 0-100 之间");
  }

  await db.promptVersion.update({
    where: { id },
    data: { description, rolloutPercent },
  });
  revalidatePath("/ai");
}

export async function rollbackToVersion(formData: FormData) {
  await requireOperator();
  const id = String(formData.get("id"));

  await db.promptVersion.updateMany({
    where: { status: "GA" },
    data: { status: "ARCHIVED", rolloutPercent: 0 },
  });
  await db.promptVersion.update({
    where: { id },
    data: { status: "GA", rolloutPercent: 100 },
  });
  revalidatePath("/ai");
}

export async function updateCommunityTokenLimit(formData: FormData) {
  await requireOperator();
  const communityId = String(formData.get("communityId"));
  const raw = String(formData.get("limit") ?? "").trim();
  const limit = raw === "" ? null : Number(raw);
  if (limit !== null && (!Number.isFinite(limit) || limit < 0)) {
    throw new Error("限额需为非负数字");
  }

  await db.community.update({
    where: { id: communityId },
    data: { aiTokenDailyLimit: limit },
  });
  revalidatePath("/ai");
}
