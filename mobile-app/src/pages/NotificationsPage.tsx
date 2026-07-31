import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../components/Icon";
import { UnifiedHeader } from "../components/UnifiedHeader";
import { VerseShareSheet } from "../components/VerseShareSheet";
import { NOTIFICATION_PREFS, getPrefs, togglePref } from "../data/profile";

// 通知管理（design 5c）— toggles persist to localStorage.
export function NotificationsPage() {
  const navigate = useNavigate();
  const [prefs, setPrefs] = useState(getPrefs);
  const [dailyVersePreviewOpen, setDailyVersePreviewOpen] = useState(false);
  const dailyVerse = {
    verseText: "你的话是我脚前的灯，是我路上的光。",
    reference: "诗篇 119:105",
    versionLabel: "和合本",
    shareUrl: `${window.location.origin}${window.location.pathname}#/bible?t=cuv&bk=psa&c=119&v=105`,
  };
  const dailyVerseDate = new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(new Date());

  const toggle = (key: string) => {
    togglePref(key);
    setPrefs(getPrefs());
  };

  return (
    <div className="screen" style={{ background: "var(--surface)" }}>
      <UnifiedHeader title="通知管理" subtitle="本机测试" ariaLabel="通知管理" onBack={() => navigate("/me")} backLabel="返回我的" />

      <div className="screen-scroll" style={{ padding: "16px 16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="card" style={{ padding: "4px 0" }}>
          {NOTIFICATION_PREFS.map((p, i) => {
            const on = prefs[p.key];
            return (
              <button
                key={p.key}
                type="button"
                role="switch"
                aria-checked={on}
                aria-label={`${p.title}，${on ? "已开启" : "已关闭"}`}
                onClick={() => toggle(p.key)}
                style={{ display: "flex", width: "100%", alignItems: "center", gap: 12, padding: "14px 16px", borderTop: i > 0 ? "1px solid var(--surface-2)" : "none", textAlign: "left" }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>{p.title}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--body)" }}>{p.desc}</div>
                </div>
                <span
                  aria-hidden="true"
                  style={{
                    display: "block", flex: "none", width: 48, height: 28, borderRadius: 100, padding: 2,
                    background: on ? "var(--purple)" : "var(--surface-2)",
                    border: "1px solid var(--line)", transition: "background .15s ease",
                  }}
                >
                  <div style={{ width: 22, height: 22, background: "#fff", borderRadius: 100, boxShadow: "var(--shadow-card)", transform: on ? "translateX(20px)" : "translateX(0)", transition: "transform .15s ease" }} />
                </span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          className="notification-daily-verse-demo"
          onClick={() => setDailyVersePreviewOpen(true)}
          aria-label="预览今日金句分享图片"
        >
          <span className="notification-daily-verse-kicker">今日金句 · {dailyVerseDate}</span>
          <strong>“{dailyVerse.verseText}”</strong>
          <span className="notification-daily-verse-reference">{dailyVerse.reference} · {dailyVerse.versionLabel}</span>
          <span className="notification-daily-verse-action">
            预览分享图片 <Icon name="chevron-right" size={15} />
          </span>
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--surface-2)", borderRadius: 12, padding: "12px 14px" }}>
          <Icon name="bell" size={15} />
          <div style={{ flex: 1, fontSize: 12, fontWeight: 600, color: "var(--body)", lineHeight: 1.6 }}>
            当前仅保存本机开关偏好，尚未接入系统推送；不会向其他设备发送通知。
          </div>
        </div>
      </div>

      {dailyVersePreviewOpen && (
        <VerseShareSheet
          data={dailyVerse}
          onClose={() => setDailyVersePreviewOpen(false)}
        />
      )}
    </div>
  );
}
