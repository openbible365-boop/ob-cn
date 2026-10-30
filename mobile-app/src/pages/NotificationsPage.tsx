import { useEffect, useMemo, useState } from "react";
import { useAppBack } from "../hooks/useAppBack";
import { EmptyState } from "../components/EmptyState";
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
import { disableReminder, enableReminder, getReminder, reminderSupported } from "../data/reading-reminder";

import {
  initializePushNotifications,
  sendTestPush,
  type PushRegistrationStatus,
} from "../data/push";


export function NotificationsPage() {
  const navigate = useNavigate();
  const goBack = useAppBack("/me");
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
  const [reminder, setReminder] = useState(getReminder);
  const [reminderFeedback, setReminderFeedback] = useState("");
  const [reminderBusy, setReminderBusy] = useState(false);
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

  const [pushStatus, setPushStatus] = useState<PushRegistrationStatus | null>(null);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushMessage, setPushMessage] = useState("");

  useEffect(() => {
    void initializePushNotifications(false).then(setPushStatus);
  }, []);


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

  const toggleReminder = async () => {
    if (reminderBusy) return;
    setReminderBusy(true);
    if (reminder.enabled) {
      await disableReminder();
      setReminder(getReminder());
      setReminderFeedback("提醒已关闭");
    } else {
      const result = await enableReminder(reminder.time);
      setReminder(getReminder());
      setReminderFeedback(result.message);
    }
    setReminderBusy(false);
  };

  const changeReminderTime = async (time: string) => {
    setReminder((current) => ({ ...current, time }));
    if (!reminder.enabled || reminderBusy) return;
    setReminderBusy(true);
    const result = await enableReminder(time);
    setReminder(getReminder());
    setReminderFeedback(result.message);
    setReminderBusy(false);
  };

  const enableSystemPush = async () => {
    setPushBusy(true);
    setPushMessage("");
    const status = await initializePushNotifications(true);
    setPushStatus(status);
    setPushMessage(status.message);
    setPushBusy(false);
  };

  const testSystemPush = async () => {
    setPushBusy(true);
    const result = await sendTestPush();
    setPushMessage(result.message);
    setPushBusy(false);
  };


  const requestSystemPermission = async () => {
    if (typeof Notification === "undefined") return;
    const permission = await Notification.requestPermission();
    setSystemPermission(permission);
  };

  return (
    <div className="screen notification-screen">
      <UnifiedHeader
        title="通知设置"
        subtitle={sessionUser ? "账号同步" : "本机设置"}
        ariaLabel="通知设置"
        onBack={goBack}
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
          {/* 金句推送的样张：设置页里只占一行，点开才看完整分享图 */}
          <button type="button" className="notification-preview-row" onClick={() => setDailyVersePreviewOpen(true)} aria-label="预览今日金句分享图片">
            <span className="notification-preference-copy">
              <strong>预览今日金句</strong>
              <small>{dailyVerse.reference} · {dailyVerseDate}</small>
            </span>
            <Icon name="chevron-right" size={16} />
          </button>
        </section>

        <section className="notification-section notification-reminder-section" aria-labelledby="reading-reminder-title">
          <div className="notification-section-heading compact">
            <div>
              <h2 id="reading-reminder-title">每日读经提醒</h2>
              <p>{reminderSupported() ? "到点在这台设备上提醒你读经" : "在慧读圣经 App 内可用，网页版暂不支持"}</p>
            </div>
            {reminderSupported() && (
              <button
                type="button"
                role="switch"
                aria-checked={reminder.enabled}
                aria-label={`每日读经提醒，${reminder.enabled ? "已开启" : "已关闭"}`}
                className="notification-reminder-toggle"
                disabled={reminderBusy}
                onClick={() => void toggleReminder()}
              >
                <span className={`notification-switch${reminder.enabled ? " is-on" : ""}`} aria-hidden="true"><i /></span>
              </button>
            )}
          </div>
          {reminderSupported() && (
            <div className="notification-reminder-body">
              <label className="notification-reminder-time">
                <span>提醒时间</span>
                <input
                  type="time"
                  value={reminder.time}
                  disabled={reminderBusy}
                  onChange={(event) => void changeReminderTime(event.target.value)}
                />
              </label>
              {reminderFeedback && <p className="notification-reminder-feedback" role="status">{reminderFeedback}</p>}
            </div>
          )}
        </section>

        {pushStatus?.supported && (
          <div className="card" style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 800 }}>系统推送</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--body)", lineHeight: 1.6 }}>
              {pushMessage || pushStatus.message}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                className="btn-primary"
                disabled={pushBusy}
                onClick={() => void enableSystemPush()}
                style={{ flex: 1, minHeight: 42 }}
              >
                {pushStatus.permission === "granted" ? "重新登记本机" : "启用系统推送"}
              </button>
              {pushStatus.permission === "granted" && (
                <button
                  type="button"
                  className="compact-action-btn"
                  disabled={pushBusy}
                  onClick={() => void testSystemPush()}
                  style={{ flex: 1, minHeight: 42 }}
                >
                  发送测试通知
                </button>
              )}
            </div>
          </div>
        )}


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
              <EmptyState compact art="inbox" title="暂无通知" desc="有新的活动、互动或审核结果时会显示在这里" />
            )}
          </section>
        )}

        {feedback && <div className="notification-feedback" role="status">{feedback}</div>}
      </div>

      {dailyVersePreviewOpen && <VerseShareSheet data={dailyVerse} onClose={() => setDailyVersePreviewOpen(false)} />}
    </div>
  );
}
