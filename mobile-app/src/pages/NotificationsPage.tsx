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
import { Capacitor } from "@capacitor/core";
import { SHOW_COMMUNITY } from "../data/features";
import { initializePushNotifications, sendTestPush } from "../data/push";
import { useSessionUser } from "../hooks/useSessionUser";
import { disableReminder, enableReminder, getReminder, rememberReminderTime, reminderSupported } from "../data/reading-reminder";
import { getDailyVerse } from "../data/daily-verse";

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
  // 样张用真·今日金句（31 节按天轮换，与圣经页一致），不再写死某一节
  const dailyVerse = useMemo(() => {
    const verse = getDailyVerse();
    return {
      verseText: verse.text,
      reference: verse.reference,
      versionLabel: "和合本",
      shareUrl: `${window.location.origin}${window.location.pathname}#/bible?t=cuv&bk=${verse.book}&c=${verse.chapter}&v=${verse.verse}`,
    };
  }, []);
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
    if (!reminder.enabled || reminderBusy) {
      // 未开启提醒时也把时间落盘，下次进来不回跳默认值
      rememberReminderTime(time);
      return;
    }
    setReminderBusy(true);
    const result = await enableReminder(time);
    setReminder(getReminder());
    setReminderFeedback(result.message);
    setReminderBusy(false);
  };

  // 原生 App 走 Capacitor 系统推送（请求权限 → 注册 → 向服务器登记 token）；
  // 网页版仍是浏览器的 Notification 权限。
  const isNativePush = Capacitor.isNativePlatform();
  const [pushBusy, setPushBusy] = useState(false);
  const [pushRegistered, setPushRegistered] = useState(false);
  const [pushMessage, setPushMessage] = useState("");

  useEffect(() => {
    if (!isNativePush) return;
    void initializePushNotifications(false).then((status) => {
      setSystemPermission(status.permission);
      setPushRegistered(status.registered);
      setPushMessage(status.message);
    });
  }, [isNativePush]);

  const requestSystemPermission = async () => {
    if (isNativePush) {
      if (pushBusy) return;
      setPushBusy(true);
      const status = await initializePushNotifications(true);
      setSystemPermission(status.permission);
      setPushRegistered(status.registered);
      setPushMessage(status.message);
      setPushBusy(false);
      return;
    }
    if (typeof Notification === "undefined") return;
    const permission = await Notification.requestPermission();
    setSystemPermission(permission);
  };

  const runTestPush = async () => {
    if (pushBusy) return;
    setPushBusy(true);
    const result = await sendTestPush();
    setPushMessage(result.message);
    setPushBusy(false);
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
            {NOTIFICATION_PREFS.filter((preference) => SHOW_COMMUNITY || !preference.community).map((preference) => {
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

        <section className="notification-section notification-system-section" aria-labelledby="system-notification-title">
          <div className="notification-section-heading compact">
            <div>
              <h2 id="system-notification-title">本机系统通知</h2>
              <p>{isNativePush ? (pushMessage || "用于锁屏推送提醒，与账号偏好分开") : "用于锁屏和桌面提醒，与账号偏好分开"}</p>
            </div>
            <button type="button" className="notification-permission-button" onClick={() => void requestSystemPermission()} disabled={pushBusy || systemPermission === "unsupported"}>
              {pushBusy ? "处理中…" : systemPermission === "granted" ? "已允许" : systemPermission === "denied" ? "已拒绝" : systemPermission === "unsupported" ? "不支持" : "去开启"}
            </button>
          </div>
          {/* 原生端登记成功后提供一键自测：真机上立即验证整条推送链路 */}
          {isNativePush && pushRegistered && (
            <button type="button" className="notification-text-action" disabled={pushBusy} onClick={() => void runTestPush()}>
              发送一条测试推送到这台手机
            </button>
          )}
        </section>

        {sessionUser && (
          <section className="notification-section notification-inbox-section" aria-labelledby="notification-inbox-title">
            <div className="notification-section-heading compact">
              <div>
                <h2 id="notification-inbox-title">消息中心 {unreadCount > 0 && <span>{unreadCount}</span>}</h2>
                <p>{SHOW_COMMUNITY ? "活动、评论、入群审核和 AI 任务" : "金句推送与 AI 任务"}</p>
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
              <EmptyState compact art="inbox" title="暂无通知" desc={SHOW_COMMUNITY ? "有新的活动、互动或审核结果时会显示在这里" : "有新的消息时会显示在这里"} />
            )}
          </section>
        )}

        {feedback && <div className="notification-feedback" role="status">{feedback}</div>}
      </div>

      {dailyVersePreviewOpen && <VerseShareSheet data={dailyVerse} onClose={() => setDailyVersePreviewOpen(false)} />}
    </div>
  );
}
