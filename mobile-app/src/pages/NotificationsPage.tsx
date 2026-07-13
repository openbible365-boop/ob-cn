import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../components/Icon";
import { NOTIFICATION_PREFS, getPrefs, togglePref } from "../data/profile";

// 通知管理（design 5c）— toggles persist to localStorage.
export function NotificationsPage() {
  const navigate = useNavigate();
  const [prefs, setPrefs] = useState(getPrefs);

  const toggle = (key: string) => {
    togglePref(key);
    setPrefs(getPrefs());
  };

  return (
    <div className="screen" style={{ background: "var(--surface)" }}>
      <div className="page-header">
        <button className="icon-btn" onClick={() => navigate("/me")}><Icon name="chevron-left" size={18} /></button>
        <div className="title">通知管理</div>
      </div>

      <div className="screen-scroll" style={{ padding: "16px 16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="card" style={{ padding: "4px 0" }}>
          {NOTIFICATION_PREFS.map((p, i) => {
            const on = prefs[p.key];
            return (
              <div key={p.key} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderTop: i > 0 ? "1px solid var(--surface-2)" : "none" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>{p.title}</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--body)" }}>{p.desc}</div>
                </div>
                <button
                  onClick={() => toggle(p.key)}
                  role="switch"
                  aria-checked={on}
                  style={{
                    flex: "none", width: 48, height: 28, borderRadius: 100, padding: 2,
                    background: on ? "var(--purple)" : "var(--surface-2)",
                    border: "1px solid var(--line)", transition: "background .15s ease",
                  }}
                >
                  <div style={{ width: 22, height: 22, background: "#fff", borderRadius: 100, boxShadow: "var(--shadow-card)", transform: on ? "translateX(20px)" : "translateX(0)", transition: "transform .15s ease" }} />
                </button>
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--surface-2)", borderRadius: 12, padding: "12px 14px" }}>
          <Icon name="bell" size={15} />
          <div style={{ flex: 1, fontSize: 12, fontWeight: 600, color: "var(--body)", lineHeight: 1.6 }}>
            设置保存在本机。打包为 App 后，将结合系统推送权限生效。
          </div>
        </div>
      </div>
    </div>
  );
}
