import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../components/Icon";
import { getHighlights, getNotes } from "../data/annotations";
import { getConversations } from "../data/huidu";
import { getGroups, getMySignups } from "../data/community";
import { fetchMe, logout, type SessionUser } from "../data/profile";

// 我的首页（design 5a）— real backend session; stats still from local stores.
export function MePage() {
  const navigate = useNavigate();
  // undefined = checking the session, null = logged out.
  const [user, setUser] = useState<SessionUser | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    fetchMe().then((u) => { if (!cancelled) setUser(u); });
    return () => { cancelled = true; };
  }, []);

  if (user === undefined) {
    return (
      <div className="screen" style={{ background: "var(--surface)" }}>
        <div style={{ flex: "none", padding: "10px 16px 14px", background: "var(--white)", borderBottom: "1px solid var(--line)" }}>
          <div style={{ fontSize: 20, fontWeight: 800 }}>我的</div>
        </div>
        <div className="screen-scroll" style={{ padding: "40px 24px", display: "flex", justifyContent: "center" }}>
          <div style={{ fontSize: 13, color: "var(--body)" }}>加载中…</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="screen" style={{ background: "var(--surface)" }}>
        <div style={{ flex: "none", padding: "10px 16px 14px", background: "var(--white)", borderBottom: "1px solid var(--line)" }}>
          <div style={{ fontSize: 20, fontWeight: 800 }}>我的</div>
        </div>
        <div className="screen-scroll" style={{ padding: "40px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 72, height: 72, background: "var(--surface-2)", borderRadius: 100 }}>
            <Icon name="user" size={30} />
          </div>
          <div style={{ fontSize: 16, fontWeight: 800 }}>尚未登录</div>
          <div style={{ fontSize: 13, fontWeight: 500, color: "var(--body)", textAlign: "center", lineHeight: 1.7 }}>
            登录后即可同步高亮、笔记与慧读记录，<br />并加入社群参与共读。
          </div>
          <button className="btn-primary" style={{ width: "100%" }} onClick={() => navigate("/me/login")}>
            登录 / 注册
          </button>
        </div>
      </div>
    );
  }

  const stats = [
    { label: "高亮", value: getHighlights().length, to: "/me/content?t=highlights" },
    { label: "笔记", value: getNotes().length, to: "/me/content?t=notes" },
    { label: "慧读对话", value: getConversations().length, to: "/huidu" },
    { label: "活动报名", value: getMySignups().length, to: "/community" },
  ];

  const myGroups = getGroups().filter((g) => g.badgeStyle === "owner").length;

  const settingsRows = [
    { icon: "align-justify" as const, label: "我的内容", desc: "高亮 · 笔记 · 帖子", to: "/me/content" },
    { icon: "bell" as const, label: "通知管理", desc: "推送与提醒偏好", to: "/me/notifications" },
    { icon: "sun" as const, label: "阅读偏好", desc: "字号 · 夜间模式（开发中）", to: null },
    { icon: "lock" as const, label: "隐私与安全", desc: "账号与数据（开发中）", to: null },
  ];

  return (
    <div className="screen" style={{ background: "var(--surface)" }}>
      <div style={{ flex: "none", padding: "10px 16px 14px", background: "var(--white)", borderBottom: "1px solid var(--line)" }}>
        <div style={{ fontSize: 20, fontWeight: 800 }}>我的</div>
      </div>

      <div className="screen-scroll" style={{ padding: "16px 16px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
        {/* profile card */}
        <div className="card" style={{ display: "flex", alignItems: "center", gap: 14, padding: 16 }}>
          <div style={{ flex: "none", display: "flex", alignItems: "center", justifyContent: "center", width: 56, height: 56, background: user.avatarColor, border: "1px solid var(--line)", borderRadius: 100, fontSize: 20, fontWeight: 800 }}>
            {user.name.slice(0, 1)}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 3 }}>{user.name}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--body)" }}>{user.email ?? `群主 ×${myGroups}`}</div>
          </div>
          <button className="icon-btn" title="编辑资料"><Icon name="edit" size={16} /></button>
        </div>

        {/* sync card */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, background: "rgba(191,120,246,.14)", border: "1px solid var(--line)", borderRadius: 16, padding: "12px 14px" }}>
          <div style={{ flex: "none", color: "var(--purple)" }}><Icon name="cloud" size={18} /></div>
          <div style={{ flex: 1, fontSize: 12, fontWeight: 600, color: "var(--body)", lineHeight: 1.6 }}>
            数据保存在本机。接入账号服务后将自动云端同步。
          </div>
        </div>

        {/* stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
          {stats.map((s) => (
            <button key={s.label} className="card" onClick={() => navigate(s.to)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "14px 4px" }}>
              <div style={{ fontSize: 20, fontWeight: 800 }}>{s.value}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--body)" }}>{s.label}</div>
            </button>
          ))}
        </div>

        {/* settings list */}
        <div className="card" style={{ padding: "4px 0" }}>
          {settingsRows.map((r, i) => (
            <button
              key={r.label}
              onClick={() => r.to && navigate(r.to)}
              style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "13px 16px", textAlign: "left", borderTop: i > 0 ? "1px solid var(--surface-2)" : "none", opacity: r.to ? 1 : 0.55 }}
            >
              <div style={{ flex: "none", display: "flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, background: "var(--surface-2)", borderRadius: 10 }}>
                <Icon name={r.icon} size={16} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 1 }}>{r.label}</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--body)" }}>{r.desc}</div>
              </div>
              <div style={{ color: "var(--body)" }}><Icon name="chevron-right" size={16} /></div>
            </button>
          ))}
        </div>

        {/* logout */}
        <button
          onClick={async () => { await logout(); setUser(null); }}
          className="card"
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "14px 16px", color: "var(--pink)", fontSize: 14, fontWeight: 800 }}
        >
          <Icon name="log-out" size={16} /> 退出登录
        </button>

        <div className="disclaimer">OpenBible v0.1</div>
      </div>
    </div>
  );
}
