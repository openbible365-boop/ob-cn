"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { requireRole } from "@/lib/authz";

export async function muteUser(formData: FormData) {
  const session = await requireRole(["SUPER_ADMIN", "MODERATOR"]);
  const userId = String(formData.get("userId"));
  const mutedUntil = new Date();
  mutedUntil.setDate(mutedUntil.getDate() + 7);

  const user = await db.user.update({
    where: { id: userId },
    data: { status: "MUTED", mutedUntil },
  });

  await logAudit({
    operatorId: session.user.id,
    action: "禁言用户",
    targetType: "User",
    targetId: user.id,
    detail: `${user.name} · 禁言至 ${mutedUntil.toISOString().slice(0, 10)}`,
  });

  revalidatePath("/users");
}

export async function banUser(formData: FormData) {
  const session = await requireRole(["SUPER_ADMIN", "MODERATOR"]);
  const userId = String(formData.get("userId"));
  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) throw new Error("封禁需要填写原因");

  const user = await db.user.update({
    where: { id: userId },
    data: { status: "BANNED", banReason: reason },
  });

  await logAudit({
    operatorId: session.user.id,
    action: "封禁用户",
    targetType: "User",
    targetId: user.id,
    detail: `${user.name} · 原因：${reason}`,
  });

  revalidatePath("/users");
}

export async function unbanUser(formData: FormData) {
  const session = await requireRole(["SUPER_ADMIN", "MODERATOR"]);
  const userId = String(formData.get("userId"));

  const user = await db.user.update({
    where: { id: userId },
    data: { status: "ACTIVE", banReason: null, mutedUntil: null },
  });

  await logAudit({
    operatorId: session.user.id,
    action: "解封用户",
    targetType: "User",
    targetId: user.id,
    detail: user.name,
  });

  revalidatePath("/users");
}
