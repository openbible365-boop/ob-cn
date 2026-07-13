import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/current-user";
import { NOTIFICATION_PREFS } from "@/lib/notification-prefs";
import { toggleNotification } from "@/lib/actions/site/me";

export default async function NotificationsPage() {
  const user = await requireUser();

  const rows = await db.notificationSetting.findMany({ where: { userId: user.id } });
  const overrides = new Map(rows.map((r) => [r.key, r.enabled]));

  return (
    <div style={{ flex: 1, overflow: "auto", padding: "24px 28px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <Link href="/me" className="icon-btn" style={{ width: 40, height: 40, textDecoration: "none" }}>‹</Link>
          <div style={{ fontSize: 17, fontWeight: 800 }}>通知管理</div>
        </div>

        <div className="card" style={{ overflow: "hidden" }}>
          {NOTIFICATION_PREFS.map((pref, i) => {
            const enabled = overrides.get(pref.key) ?? pref.defaultEnabled;
            return (
              <div
                key={pref.key}
                style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "15px 16px",
                  borderBottom: i < NOTIFICATION_PREFS.length - 1 ? "1px solid var(--surface-2)" : undefined,
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>{pref.title}</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--body)" }}>{pref.desc}</div>
                </div>
                <form action={toggleNotification}>
                  <input type="hidden" name="key" value={pref.key} />
                  <button
                    type="submit"
                    title={enabled ? "点击关闭" : "点击开启"}
                    style={{
                      display: "flex", justifyContent: enabled ? "flex-end" : "flex-start",
                      width: 46, height: 28, background: enabled ? "var(--purple)" : "var(--surface-2)",
                      borderRadius: 100, padding: 3, border: "none", cursor: "pointer",
                    }}
                  >
                    <div style={{ width: 22, height: 22, background: "var(--white)", borderRadius: 100, boxShadow: "var(--shadow-card)", ...(enabled ? {} : { border: "1px solid var(--line)" }) }} />
                  </button>
                </form>
              </div>
            );
          })}
        </div>

        <div style={{ textAlign: "center", fontSize: 10, fontWeight: 600, color: "var(--body)", padding: "14px 12px 0" }}>
          默认配置遵循「最小打扰」原则，开关即时生效并全端同步
        </div>
      </div>
    </div>
  );
}
