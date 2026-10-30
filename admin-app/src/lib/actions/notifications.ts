"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { requireRole } from "@/lib/authz";
import { sendPushToDevices } from "@/lib/push";

export type NotificationSendState = {
  kind: "success" | "warning" | "error";
  message: string;
} | null;

export async function sendAdminNotification(
  _previousState: NotificationSendState,
  formData: FormData,
): Promise<NotificationSendState> {
  const session = await requireRole(["SUPER_ADMIN"]);
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const deviceIds = Array.from(new Set(
    formData.getAll("deviceId").map((value) => String(value).trim()).filter(Boolean),
  ));

  if (!title || title.length > 60) {
    return { kind: "error", message: "通知标题必填，且不能超过 60 个字" };
  }
  if (!body || body.length > 300) {
    return { kind: "error", message: "通知内容必填，且不能超过 300 个字" };
  }
  if (deviceIds.length === 0) {
    return { kind: "error", message: "请至少选择一台接收手机" };
  }
  if (deviceIds.length > 5000) {
    return { kind: "error", message: "单次最多选择 5000 台手机" };
  }

  const devices = await db.devicePushToken.findMany({
    where: { id: { in: deviceIds }, enabled: true },
    select: { token: true, platform: true, userId: true },
  });
  if (devices.length === 0) {
    return { kind: "error", message: "所选手机已失效或未启用通知" };
  }

  const result = await sendPushToDevices(
    devices.map(({ token, platform }) => ({ token, platform })),
    {
      title,
      body,
      path: "/me/notifications",
      data: { kind: "admin_broadcast" },
    },
  );

  const userCount = new Set(devices.map((device) => device.userId)).size;
  await logAudit({
    operatorId: session.user.id,
    action: "发送推送通知",
    targetType: "PushBroadcast",
    targetId: randomUUID(),
    detail: `${title} · ${userCount} 名用户 / ${result.delivered} of ${result.attempted} 台送达`,
  });

  revalidatePath("/admin/notifications");

  if (result.delivered === 0) {
    const firstError = result.deliveries.find((item) => item.error)?.error;
    return {
      kind: "error",
      message: `发送失败：${firstError ?? "推送服务未能送达通知"}`,
    };
  }
  if (result.delivered < result.attempted) {
    return {
      kind: "warning",
      message: `已送达 ${result.delivered} 台，另有 ${result.attempted - result.delivered} 台发送失败`,
    };
  }
  return {
    kind: "success",
    message: `发送成功：已向 ${userCount} 名用户的 ${result.delivered} 台手机推送`,
  };
}
