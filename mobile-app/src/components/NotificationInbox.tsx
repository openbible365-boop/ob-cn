import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "./Icon";
import {
  fetchNotificationCenter,
  markAccountNotificationRead,
  type AccountNotification,
} from "../data/profile";

// 消息中心（站内通知列表）：放在「我的」页，登录后才渲染。
// 通知偏好开关仍在「通知设置」页，这里只负责看消息与标记已读。
const timeFormat = new Intl.DateTimeFormat("zh-CN", {
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function NotificationInbox({ translate = (text) => text }: { translate?: (text: string) => string }) {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<AccountNotification[] | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let active = true;
    void fetchNotificationCenter().then((result) => {
      if (!active) return;
      if (!result.ok) {
        setNotifications([]);
        return;
      }
      setNotifications(result.notifications);
      setUnreadCount(result.unreadCount);
    });
    return () => {
      active = false;
    };
  }, []);

  const openNotification = async (item: AccountNotification) => {
    if (!item.readAt && (await markAccountNotificationRead(item.id))) {
      setNotifications((items) =>
        (items ?? []).map((candidate) =>
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
    setNotifications((items) => (items ?? []).map((item) => ({ ...item, readAt: item.readAt ?? now })));
    setUnreadCount(0);
  };

  // 首次拉取前不渲染，避免空态一闪
  if (notifications === null) return null;

  const latest = notifications[0];
  const summary = !notifications.length
    ? translate("暂无新消息")
    : unreadCount > 0
      ? `${unreadCount} ${translate("条未读")} · ${translate(latest.title)}`
      : `${translate("最新")}：${translate(latest.title)}`;

  // 与上方菜单同款的一行：没有消息时就是一行说明；有消息时点开在下方展开列表
  return (
    <div className="me-menu-card notification-inbox-card">
      <button
        type="button"
        aria-expanded={notifications.length ? expanded : undefined}
        aria-controls={notifications.length ? "notification-inbox-list" : undefined}
        disabled={!notifications.length}
        onClick={() => setExpanded((value) => !value)}
      >
        <span className="me-menu-icon"><Icon name="bell" size={16} /></span>
        <span className="me-menu-copy">
          <b>{translate("消息中心")}</b>
          <small>{summary}</small>
        </span>
        {unreadCount > 0 && <span className="notification-inbox-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
        {notifications.length > 0 && (
          <Icon name="chevron-right" size={16} className={expanded ? "is-rotated" : undefined} />
        )}
      </button>

      {expanded && notifications.length > 0 && (
        <div id="notification-inbox-list" className="notification-inbox-list">
          {unreadCount > 0 && (
            <button type="button" className="notification-text-action" onClick={() => void markAllRead()}>
              {translate("全部标为已读")}
            </button>
          )}
          {notifications.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`notification-inbox-item${item.readAt ? "" : " is-unread"}`}
              onClick={() => void openNotification(item)}
            >
              <span className="notification-inbox-copy">
                <strong>{translate(item.title)}</strong>
                <small>{translate(item.body)}</small>
                <time>{timeFormat.format(new Date(item.createdAt))}</time>
              </span>
              {item.href && <Icon name="chevron-right" size={14} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
