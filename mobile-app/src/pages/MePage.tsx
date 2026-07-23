import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CompactToolbar } from "../components/CompactToolbar";
import { Icon } from "../components/Icon";
import { HIGHLIGHTS_CHANGED_EVENT } from "../data/annotations";
import { fetchMe, logout, type SessionUser } from "../data/profile";

// 我的首页（design 5a）— real backend session; stats still from local stores.
export function MePage() {
  const navigate = useNavigate();
  // undefined = checking the session, null = logged out.
  const [user, setUser] = useState<SessionUser | null | undefined>(undefined);
  const [, refreshHighlights] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchMe().then((u) => { if (!cancelled) setUser(u); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const refresh = () => refreshHighlights((value) => value + 1);
    window.addEventListener(HIGHLIGHTS_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(HIGHLIGHTS_CHANGED_EVENT, refresh);
  }, []);

  if (user === undefined) {
    return (
      <div className="screen" style={{ background: "var(--surface)" }}>
        <CompactToolbar ariaLabel="个人中心" primary="我的" secondary="个人" />
        <div className="screen-scroll" style={{ padding: "40px 24px", display: "flex", justifyContent: "center" }}>
          <div style={{ fontSize: 13, color: "var(--body)" }}>加载中…</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="screen" style={{ background: "var(--surface)" }}>
        <CompactToolbar
          ariaLabel="个人中心"
          primary="我的"
          secondary="个人"
          actions={(
            <button
              className="bible-toolbar-action"
              type="button"
              aria-label="登录或注册"
              title="登录或注册"
              onClick={() => navigate("/me/login")}
            >
              <Icon name="user" size={18} />
            </button>
          )}
        />
        <div className="screen-scroll" style={{ padding: "40px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 78,
                height: 78,
                color: "var(--ink)",
              }}
              aria-label="慧读圣经"
            >
              <svg
                viewBox="16 8 88 88"
                xmlns="http://www.w3.org/2000/svg"
                width="78"
                height="78"
                role="img"
                aria-hidden="true"
                style={{ overflow: "visible" }}
              >
                <polygon points="60,9 63.2,15.8 72,19 63.2,22.2 60,31 56.8,22.2 48,19 56.8,15.8" fill="#E89A2C" />
                <polygon points="43.6,25.6 45.5,30.1 50,32 45.5,33.9 43.6,38.4 41.7,33.9 37.2,32 41.7,30.1" fill="currentColor" />
                <polygon points="77.9,23.6 79.8,28.1 84.3,30 79.8,31.9 77.9,36.4 76,31.9 71.5,30 76,28.1" fill="currentColor" />
                <path d="M60 53 C 50 45, 34 45, 26 52 L 26 88 C 34 79, 50 79, 60 88 Z" fill="#F2C96D" stroke="currentColor" strokeWidth="5" strokeLinejoin="round" />
                <path d="M60 53 C 70 45, 86 45, 94 52 L 94 88 C 86 79, 70 79, 60 88 Z" fill="#F2C96D" stroke="currentColor" strokeWidth="5" strokeLinejoin="round" />
                <line x1="60" y1="53" x2="60" y2="88" stroke="currentColor" strokeWidth="4" />
              </svg>
            </div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>
              <span style={{ color: "#E89A2C" }}>慧读</span>
              <span>圣经</span>
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--body)" }}>智慧 · 读经 · 社群 · 共勉</div>
          </div>
          <div style={{ margin: "50px 0", fontSize: 20, fontWeight: 800, textAlign: "center" }}>尚未登录</div>
          <div style={{ fontSize: 13, fontWeight: 500, color: "var(--body)", textAlign: "center", lineHeight: 1.7 }}>
            无需登录也能在本机保存高亮；<br />登录后可跨设备同步高亮。
          </div>
          <button className="btn-primary" style={{ width: "100%" }} onClick={() => navigate("/me/login")}>
            登录 / 注册
          </button>
        </div>
      </div>
    );
  }

  const stats = [
    { label: "高亮", value: user.counts.highlights, to: "/me/content?t=highlights" },
    { label: "笔记", value: user.counts.notes, to: "/me/content?t=notes" },
    { label: "慧读对话", value: user.counts.conversations, to: "/huidu" },
    { label: "活动报名", value: user.counts.eventSignups, to: "/community" },
  ];

  const settingsRows = [
    { icon: "align-justify" as const, label: "我的内容", desc: "高亮 · 笔记 · 帖子", to: "/me/content" },
    { icon: "bell" as const, label: "通知管理", desc: "推送与提醒偏好", to: "/me/notifications" },
    { icon: "sun" as const, label: "阅读偏好", desc: "即将开放", to: null },
    { icon: "lock" as const, label: "隐私与安全", desc: "即将开放", to: null },
  ];

  return (
    <div className="screen" style={{ background: "var(--surface)" }}>
      <CompactToolbar
        ariaLabel="个人中心"
        primary="我的"
        secondary="个人"
        actions={(
          <>
            <button
              className="bible-toolbar-action"
              type="button"
              aria-label="我的内容"
              title="我的内容"
              onClick={() => navigate("/me/content")}
            >
              <Icon name="align-justify" size={18} />
            </button>
            <button
              className="bible-toolbar-action"
              type="button"
              aria-label="通知管理"
              title="通知管理"
              onClick={() => navigate("/me/notifications")}
            >
              <Icon name="bell" size={18} />
            </button>
          </>
        )}
      />

      <div className="screen-scroll" style={{ padding: "16px 16px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
        {/* profile card */}
        <div className="card" style={{ display: "flex", alignItems: "center", gap: 14, padding: 16 }}>
          <div style={{ position: "relative", overflow: "hidden", flex: "none", display: "flex", alignItems: "center", justifyContent: "center", width: 56, height: 56, background: user.avatarColor, border: "1px solid var(--line)", borderRadius: 100, fontSize: 20, fontWeight: 800 }}>
            {user.name.slice(0, 1)}
            {user.avatarUrl && (
              <img
                src={user.avatarUrl}
                alt=""
                referrerPolicy="no-referrer"
                onError={(event) => { event.currentTarget.style.display = "none"; }}
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
              />
            )}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 3 }}>{user.name}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--body)" }}>{user.email ?? "已登录用户"} · {user.entitlements.label}</div>
          </div>
          <button className="icon-btn" type="button" disabled aria-label="编辑资料即将开放" title="编辑资料即将开放"><Icon name="edit" size={16} /></button>
        </div>

        {/* personal and group account contexts */}
        <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", color: "var(--body)", fontSize: 11, fontWeight: 800, letterSpacing: ".06em" }}>
            <span>账户与团体</span><span>{user.groupAccounts.length} 个管理中的团体</span>
          </div>
          <div className="card" style={{ display: "flex", alignItems: "center", gap: 11, padding: "13px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 38, height: 38, borderRadius: 11, background: "var(--yellow)", fontWeight: 800 }}>我</div>
            <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 800 }}>个人账户</div><div style={{ marginTop: 2, color: "var(--body)", fontSize: 10, fontWeight: 650 }}>{user.entitlements.label} · 个人内容与慧读记录</div></div>
            <div style={{ padding: "3px 7px", borderRadius: 7, background: "var(--surface-2)", color: "var(--body)", fontSize: 10, fontWeight: 800 }}>当前</div>
          </div>
          {user.groupAccounts.map((account) => (
            <button key={account.id} className="card" onClick={() => navigate(`/community/${account.id}`)} style={{ display: "flex", alignItems: "center", gap: 11, padding: "13px 14px", textAlign: "left" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 38, height: 38, borderRadius: 11, background: account.avatarColor, fontWeight: 800 }}>{account.abbreviation}</div>
              <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 800 }}>{account.name}</div><div style={{ marginTop: 2, color: "var(--body)", fontSize: 10, fontWeight: 650 }}>{account.role === "OWNER" ? "群主" : "管理员"} · {account.entitlements.label} · {account.usage.members} 成员</div></div>
              <Icon name="chevron-right" size={16} />
            </button>
          ))}
        </section>

        {/* sync card */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, background: "rgba(191,120,246,.14)", border: "1px solid var(--line)", borderRadius: 16, padding: "12px 14px" }}>
          <div style={{ flex: "none", color: "var(--purple)" }}><Icon name="cloud" size={18} /></div>
          <div style={{ flex: 1, fontSize: 12, fontWeight: 600, color: "var(--body)", lineHeight: 1.6 }}>
            高亮已与当前账号同步；笔记和慧读记录目前仅保存在本机。
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
              type="button"
              disabled={!r.to}
              aria-label={!r.to ? `${r.label}即将开放` : r.label}
              onClick={() => r.to && navigate(r.to)}
              style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "13px 16px", textAlign: "left", borderTop: i > 0 ? "1px solid var(--surface-2)" : "none", opacity: r.to ? 1 : 0.55, cursor: r.to ? "pointer" : "not-allowed" }}
            >
              <div style={{ flex: "none", display: "flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, background: "var(--surface-2)", borderRadius: 10 }}>
                <Icon name={r.icon} size={16} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 1 }}>{r.label}</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--body)" }}>{r.desc}</div>
              </div>
              {r.to && <div style={{ color: "var(--body)" }}><Icon name="chevron-right" size={16} /></div>}
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
