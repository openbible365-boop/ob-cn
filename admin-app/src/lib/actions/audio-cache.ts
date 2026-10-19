"use server";

import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { requireRole } from "@/lib/authz";
import {
  clearAudioCache,
  getAudioCacheSettings,
  setAudioCacheSettings,
} from "@/lib/audio-cache";

async function requireAudioCacheOperator() {
  if (process.env.NODE_ENV !== "production" && !process.env.DATABASE_URL) {
    return { user: { id: "local-audio-cache-preview" } };
  }
  return requireRole(["SUPER_ADMIN"]);
}

export async function toggleAudioCache() {
  const session = await requireAudioCacheOperator();
  const settings = await getAudioCacheSettings();
  const enabled = !settings.enabled;
  await setAudioCacheSettings({ enabled });
  await logAudit({
    operatorId: session.user.id,
    action: "切换音频缓存",
    targetType: "AudioCache",
    targetId: "singleton",
    detail: enabled ? "已开启服务端音频缓存" : "已关闭服务端音频缓存",
  }).catch(() => undefined);
  revalidatePath("/admin/audio-cache");
}

export async function purgeAudioCache() {
  const session = await requireAudioCacheOperator();
  await clearAudioCache();
  await logAudit({
    operatorId: session.user.id,
    action: "清空音频缓存",
    targetType: "AudioCache",
    targetId: "singleton",
    detail: "已清空服务端音频缓存目录",
  }).catch(() => undefined);
  revalidatePath("/admin/audio-cache");
}
