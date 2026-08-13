import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../components/Icon";
import { UnifiedHeader } from "../components/UnifiedHeader";
import { VerseShareSheet } from "../components/VerseShareSheet";
import {
  NOTIFICATION_PREFS,
  fetchNotificationCenter,
  getPrefs,
  markAccountNotificationRead,
  togglePref,
  updateAccountNotificationPreference,
  type AccountNotification,
} from "../data/profile";
import { useSessionUser } from "../hooks/useSessionUser";

export function NotificationsPage() {
  const navigate = useNavigate();
  const sessionUser = useSessionUser();
  const [prefs, setPrefs] = useState(getPrefs);
  const [notifications, setNotifications] = useState<AccountNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [dailyVersePreviewOpen, setDailyVersePreviewOpen] = useState(false);
  const [systemPermission, setSystemPermission] = useState<string>(() =>
    typeof Notification === "undefined" ? "unsupported" : Notification.permission,
  );
  const dailyVerse = useMemo(
    () => ({
      verseText: "你的话是我脚前的灯，是我路上的光。",
      reference: "诗篇 119:105",
      versionLabel: "和合本",
      shareUrl: `${window.location.origin}${window.location.pathname}#/bible?t=cuv&bk=psa&c=119&v=105`,
    }),
    [],
  );
  const dailyVerseDate = new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(new Date());

  useEffect(() => {
    if (!sessionUser) return;
    let active = true;
    setLoading(true);
    void fetchNotificationCenter().then((result) => {
      if (!active) return;
      setLoading(false);
      if (!result.ok) {
        setFeedback(result.message);
        return;
      }
      setPrefs(result.preferences);
      setNotifications(result.notifications);
      setUnreadCount(result.unreadCount);
    });
    return () => {
      active = false;
    };
  }, [sessionUser]);

  const toggle = async (key: string) => {
    const enabled = !prefs[key];
    setPrefs((current) => ({ ...current, [key]: enabled }));
    if (!sessionUser) {
      togglePref(key);
      setPrefs(getPrefs());
      return;
    }
    const result = await updateAccountNotificationPreference(key, enabled);
    if (!result.ok) {
      setPrefs((current) => ({ ...current, [key]: !enabled }));
      setFeedback(result.message);
    } else {
      setFeedback("通知偏好已同步到账号");
    }
  };

  const openNotification = async (item: AccountNotification) => {
    if (!item.readAt && (await markAccountNotificationRead(item.id))) {
      setNotifications((items) =>
        items.map((candidate) =>
          candidate.id === item.id ? { ...candidate, readAt: new Date().toISOString() } : candidate,
        ),
      );
      setUnreadCount((count) => Math.max(0, count - 1));
    }
    if (item.href) navigate(item.href);
  };

  const markAllRead = async () => {
    if (!(await markAccountNotificationRead())) return;
    const now = new Date().toISOString();
    setNotifications((items) => items.map((item) => ({ ...item, readAt: item.readAt ?? now })));
    setUnreadCount(0);
  };

  const requestSystemPermission = async () => {
    if (typeof Notification === "undefined") return;
    const permission = await Notification.requestPermission();
    setSystemPermission(permission);
  };

  return (
    <div className="screen notification-screen">
      <UnifiedHeader
        title="通知管理"
        subtitle={sessionUser ? "账号同步" : "本机设置"}
        ariaLabel="通知管理"
        onBack={() => navigate("/me")}
        backLabel="返回我的"
      />

      <div className="screen-scroll notification-scroll">
        {!sessionUser && (
          <button type="button" className="notification-login-note" onClick={() => navigate("/me/login")}>登录后可跨设备同步通知偏好和站内消息</button>
        )}

        <section className="notification-section notification-preferences-section" aria-labelledby="notification-pref-title">
          <div className="notification-section-heading">
            <div>
              <h2 id="notification-pref-title">账号通知</h2>
              <p>{sessionUser ? "站内通知及偏好会随账号同步" : "当前只保存在这台设备"}</p>
            </div>
          </div>
          <div className="notification-preference-list" aria-busy={loading}>
            {NOTIFICATION_PREFS.map((preference) => {
              const on = Boolean(prefs[preference.key]);
              return (
                <button
                  key={preference.key}
                  type="button"
                  role="switch"
                  aria-checked={on}
                  aria-label={`${preference.title}，${on ? "已开启" : "已关闭"}`}
                  onClick={() => void toggle(preference.key)}
                  className="notification-preference-row"
                >
                  <span className="notification-preference-copy">
                    <strong>{preference.title}</strong>
                    <small>{preference.desc}</small>
                  </span>
                  <span className={`notification-switch${on ? " is-on" : ""}`} aria-hidden="true"><i /></span>
                </button>
              );
            })}
          </div>
        </section>

        <button type="button" className="notification-daily-verse-demo" onClick={() => setDailyVersePreviewOpen(true)} aria-label="预览今日金句分享图片">
          <span className="notification-daily-verse-kicker">今日金句 · {dailyVerseDate}</span>
          <strong>“{dailyVerse.verseText}”</strong>
          <span className="notification-daily-verse-reference">{dailyVerse.reference} · {dailyVerse.versionLabel}</span>
          <span className="notification-daily-verse-action">预览分享图片 <Icon name="chevron-right" size={16} /></span>
        </button>

        <section className="notification-section notification-system-section" aria-labelledby="system-notification-title">
          <div className="notification-section-heading compact">
            <div>
              <h2 id="system-notification-title">本机系统通知</h2>
              <p>用于锁屏和桌面提醒，与账号偏好分开</p>
            </div>
            <button type="button" className="notification-permission-button" onClick={() => void requestSystemPermission()} disabled={systemPermission === "unsupported"}>
              {systemPermission === "granted" ? "已允许" : systemPermission === "denied" ? "已拒绝" : systemPermission === "unsupported" ? "不支持" : "去开启"}
            </button>
          </div>
        </section>

        {sessionUser && (
          <section className="notification-section notification-inbox-section" aria-labelledby="notification-inbox-title">
            <div className="notification-section-heading compact">
              <div>
                <h2 id="notification-inbox-title">消息中心 {unreadCount > 0 && <span>{unreadCount}</span>}</h2>
                <p>活动、评论、入群审核和 AI 任务</p>
              </div>
              {unreadCount > 0 && <button type="button" className="notification-text-action" onClick={() => void markAllRead()}>全部已读</button>}
            </div>
            {notifications.length ? (
              <div className="notification-inbox-list">
                {notifications.map((item) => (
                  <button key={item.id} type="button" className={`notification-inbox-item${item.readAt ? "" : " is-unread"}`} onClick={() => void openNotification(item)}>
                    <span className="notification-inbox-icon"><Icon name="bell" size={16} /></span>
                    <span className="notification-inbox-copy">
                      <strong>{item.title}</strong>
                      <small>{item.body}</small>
                      <time>{new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(item.createdAt))}</time>
                    </span>
                    {item.href && <Icon name="chevron-right" size={16} />}
                  </button>
                ))}
              </div>
            ) : (
              <div className="notification-empty-state"><Icon name="bell" size={20} /><strong>暂无通知</strong><span>有新的活动、互动或审核结果时会显示在这里</span></div>
            )}
          </section>
        )}

        {feedback && <div className="notification-feedback" role="status">{feedback}</div>}
      </div>

      {dailyVersePreviewOpen && <VerseShareSheet data={dailyVerse} onClose={() => setDailyVersePreviewOpen(false)} />}
    </div>
  );
}
