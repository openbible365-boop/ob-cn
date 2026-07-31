"use server";

import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { requireRole } from "@/lib/authz";
import { isShareCardTemplateId } from "@/lib/share-card-templates";
import {
  getShareCardSettings,
  updateShareCardSettings,
} from "@/lib/share-card-settings-store";

const SETTINGS_ID = "singleton";

async function requireShareCardOperator() {
  if (process.env.NODE_ENV !== "production" && !process.env.DATABASE_URL) {
    return { user: { id: "local-share-card-preview" } };
  }
  return requireRole(["SUPER_ADMIN", "MODERATOR"]);
}

export async function selectShareCardTemplate(formData: FormData) {
  const session = await requireShareCardOperator();
  const template = String(formData.get("template") ?? "");
  if (!isShareCardTemplateId(template)) throw new Error("无效的分享模板");

  await updateShareCardSettings({ activeTemplate: template });
  await logAudit({
    operatorId: session.user.id,
    action: "切换分享模板",
    targetType: "ShareCardSettings",
    targetId: SETTINGS_ID,
    detail: `当前模板：${template}`,
  }).catch(() => undefined);
  revalidatePath("/admin/share-cards");
}

export async function toggleShareCardRotation() {
  const session = await requireShareCardOperator();
  const current = await getShareCardSettings();
  const autoRotate = !current.autoRotate;
  await updateShareCardSettings({ autoRotate });
  await logAudit({
    operatorId: session.user.id,
    action: "切换分享模板自动轮换",
    targetType: "ShareCardSettings",
    targetId: SETTINGS_ID,
    detail: autoRotate ? "开启自动轮换" : "关闭自动轮换",
  }).catch(() => undefined);
  revalidatePath("/admin/share-cards");
}

export async function updateShareCardRotationDays(formData: FormData) {
  const session = await requireShareCardOperator();
  const rotationDays = Number(formData.get("rotationDays"));
  if (![1, 3, 7, 14, 30].includes(rotationDays)) throw new Error("无效的轮换周期");

  await updateShareCardSettings({ rotationDays });
  await logAudit({
    operatorId: session.user.id,
    action: "调整分享模板轮换周期",
    targetType: "ShareCardSettings",
    targetId: SETTINGS_ID,
    detail: `每 ${rotationDays} 天轮换`,
  }).catch(() => undefined);
  revalidatePath("/admin/share-cards");
}
