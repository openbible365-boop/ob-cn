import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { NotificationComposer } from "@/components/NotificationComposer";
import { db } from "@/lib/db";
import { ADMIN_TIMEZONE } from "@/lib/format";

// 本地时区格式化（禁止 ISO slice：那是 UTC 时间，会与运营者的钟差好几个小时）
const dateFormat = new Intl.DateTimeFormat("zh-CN", {
  timeZone: ADMIN_TIMEZONE,
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

function formatDate(date: Date) {
  return dateFormat.format(date);
}

export default async function NotificationsManagementPage() {
  const session = await auth();
  if (session?.user?.role !== "SUPER_ADMIN") redirect("/admin/dashboard");

  const devices = await db.devicePushToken.findMany({
    include: {
      user: {
        select: {
          name: true,
          email: true,
          uid: true,
        },
      },
    },
    orderBy: [
      { enabled: "desc" },
      { lastSeenAt: "desc" },
    ],
  });

  // 最近发送记录：来自审计日志的 PushBroadcast 条目（发送动作本身就会落审计）
  const recentSends = await db.auditLog.findMany({
    where: { targetType: "PushBroadcast" },
    orderBy: { createdAt: "desc" },
    take: 10,
    include: { operator: { select: { name: true } } },
  });

  const activeDevices = devices.filter((device) => device.enabled);
  const activeUsers = new Set(activeDevices.map((device) => device.userId)).size;
  const iosCount = activeDevices.filter((device) => device.platform === "IOS").length;
  const androidCount = activeDevices.length - iosCount;

  return (
    <>
      <div className="admin-header">
        <div className="title">通知推送</div>
        <div className="meta">
          {activeUsers} 名用户 · {activeDevices.length} 台已启用手机
        </div>
        <div style={{ flex: 1 }} />
        <div className="notification-summary">
          <span>iPhone {iosCount}</span>
          <span>Android {androidCount}</span>
        </div>
      </div>

      <NotificationComposer
        recentSends={recentSends.map((entry) => ({
          id: entry.id,
          detail: entry.detail,
          operator: entry.operator.name,
          at: formatDate(entry.createdAt),
        }))}
        devices={devices.map((device) => ({
          id: device.id,
          userName: device.user.name,
          email: device.user.email,
          uid: device.user.uid,
          platform: device.platform,
          appVersion: device.appVersion,
          enabled: device.enabled,
          ipAddress: device.ipAddress,
          country: device.country,
          region: device.region,
          city: device.city,
          lastSeenAt: formatDate(device.lastSeenAt),
          createdAt: formatDate(device.createdAt),
        }))}
      />
    </>
  );
}
