import { Prisma, UserNotificationType } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { defaultFor } from "@/lib/notification-prefs";

type NotificationInput = {
  userId: string;
  preferenceKey: string;
  type: UserNotificationType;
  title: string;
  body: string;
  href?: string | null;
  uniqueKey?: string | null;
};

export async function notificationEnabled(userId: string, key: string) {
  const setting = await db.notificationSetting.findUnique({
    where: { userId_key: { userId, key } },
    select: { enabled: true },
  });
  return setting?.enabled ?? defaultFor(key);
}

export async function createUserNotification(input: NotificationInput) {
  if (!(await notificationEnabled(input.userId, input.preferenceKey))) return null;
  const data = {
    userId: input.userId,
    type: input.type,
    title: input.title.slice(0, 100),
    body: input.body.slice(0, 500),
    href: input.href ?? null,
    uniqueKey: input.uniqueKey ?? null,
  } satisfies Prisma.UserNotificationUncheckedCreateInput;

  if (input.uniqueKey) {
    return db.userNotification.upsert({
      where: { uniqueKey: input.uniqueKey },
      update: {},
      create: data,
    });
  }
  return db.userNotification.create({ data });
}

function utcDayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export async function materializeDueNotifications(userId: string) {
  const now = new Date();
  const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);

  if (await notificationEnabled(userId, "daily_verse")) {
    await createUserNotification({
      userId,
      preferenceKey: "daily_verse",
      type: "DAILY_VERSE",
      title: "今日金句",
      body: "你的话是我脚前的灯，是我路上的光。— 诗篇 119:105",
      href: "/bible?t=cuv&bk=psa&c=119&v=105",
      uniqueKey: `daily-verse:${userId}:${utcDayKey(now)}`,
    });
  }

  if (!(await notificationEnabled(userId, "event_reminder"))) return;
  const signups = await db.eventSignup.findMany({
    where: {
      userId,
      event: { startAt: { gt: now, lte: twoHoursFromNow } },
    },
    select: {
      event: {
        select: {
          id: true,
          title: true,
          startAt: true,
          community: { select: { id: true, name: true } },
        },
      },
    },
  });
  for (const { event } of signups) {
    const time = new Intl.DateTimeFormat("zh-CN", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Asia/Shanghai",
    }).format(event.startAt);
    await createUserNotification({
      userId,
      preferenceKey: "event_reminder",
      type: "EVENT_REMINDER",
      title: "活动即将开始",
      body: `「${event.title}」将于 ${time} 开始 · ${event.community.name}`,
      href: `/community/${event.community.id}?tab=events`,
      uniqueKey: `event-reminder:${userId}:${event.id}`,
    });
  }
}
