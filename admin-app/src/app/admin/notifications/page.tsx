import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { NotificationComposer } from "@/components/NotificationComposer";
import { db } from "@/lib/db";

function formatDate(date: Date) {
  return date.toISOString().slice(0, 16).replace("T", " ");
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

  const activeDevices = devices.filter((device) => device.enabled);
  const activeUsers = new Set(activeDevices.map((device) => device.userId)).size;
  const iosCount = activeDevices.filter((device) => device.platform === "IOS").length;
  const androidCount = activeDevices.length - iosCount;

  return (
    <>
      <div className="admin-header">
        <div className="title">通知管理</div>
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
