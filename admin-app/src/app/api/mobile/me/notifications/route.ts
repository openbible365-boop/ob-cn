import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/current-user";
import { db } from "@/lib/db";
import { NOTIFICATION_PREFS } from "@/lib/notification-prefs";
import { materializeDueNotifications } from "@/lib/user-notifications";

type NotificationInput = {
  action?: unknown;
  key?: unknown;
  enabled?: unknown;
  notificationId?: unknown;
};

function unauthorized() {
  return NextResponse.json({ ok: false, message: "请先登录" }, { status: 401 });
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  await materializeDueNotifications(user.id);
  // PGlite runs on a single connection in local development, so keep these
  // reads sequential to avoid intermittent prepared-statement collisions.
  const overrides = await db.notificationSetting.findMany({ where: { userId: user.id } });
  const notifications = await db.userNotification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const unreadCount = await db.userNotification.count({
    where: { userId: user.id, readAt: null },
  });
  const overrideMap = new Map(overrides.map((item) => [item.key, item.enabled]));
  const preferences = Object.fromEntries(
    NOTIFICATION_PREFS.map((item) => [
      item.key,
      overrideMap.get(item.key) ?? item.defaultEnabled,
    ]),
  );
  return NextResponse.json({ ok: true, preferences, notifications, unreadCount });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  let body: NotificationInput;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "请求格式错误" }, { status: 400 });
  }

  if (body.action === "UPDATE_PREFERENCE") {
    const key = typeof body.key === "string" ? body.key : "";
    if (!NOTIFICATION_PREFS.some((item) => item.key === key) || typeof body.enabled !== "boolean") {
      return NextResponse.json({ ok: false, message: "通知设置不正确" }, { status: 400 });
    }
    await db.notificationSetting.upsert({
      where: { userId_key: { userId: user.id, key } },
      update: { enabled: body.enabled },
      create: { userId: user.id, key, enabled: body.enabled },
    });
    return NextResponse.json({ ok: true, message: "通知设置已同步" });
  }

  if (body.action === "MARK_READ") {
    const notificationId = typeof body.notificationId === "string" ? body.notificationId : "";
    await db.userNotification.updateMany({
      where: { id: notificationId, userId: user.id },
      data: { readAt: new Date() },
    });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "MARK_ALL_READ") {
    await db.userNotification.updateMany({
      where: { userId: user.id, readAt: null },
      data: { readAt: new Date() },
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, message: "不支持的通知操作" }, { status: 400 });
}
