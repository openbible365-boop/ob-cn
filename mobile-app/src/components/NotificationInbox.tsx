import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { EmptyState } from "./EmptyState";
import { Icon } from "./Icon";
import { SHOW_COMMUNITY } from "../data/features";
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

  return (
    <section className="notification-section notification-inbox-section" aria-labelledby="notification-inbox-title">
      <div className="notification-section-heading compact">
        <div>
          <h2 id="notification-inbox-title">
            {translate("消息中心")} {unreadCount > 0 && <span>{unreadCount}</span>}
          </h2>
          <p>{translate(SHOW_COMMUNITY ? "活动、评论、入群审核和 AI 任务" : "金句推送与 AI 任务")}</p>
        </div>
        {unreadCount > 0 && (
          <button type="button" className="notification-text-action" onClick={() => void markAllRead()}>
            {translate("全部已读")}
          </button>
        )}
      </div>
      {notifications.length ? (
        <div className="notification-inbox-list">
          {notifications.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`notification-inbox-item${item.readAt ? "" : " is-unread"}`}
              onClick={() => void openNotification(item)}
            >
              <span className="notification-inbox-icon"><Icon name="bell" size={16} /></span>
              <span className="notification-inbox-copy">
                <strong>{translate(item.title)}</strong>
                <small>{translate(item.body)}</small>
                <time>{timeFormat.format(new Date(item.createdAt))}</time>
              </span>
              {item.href && <Icon name="chevron-right" size={16} />}
            </button>
          ))}
        </div>
      ) : (
        <EmptyState
          compact
          art="inbox"
          title={translate("暂无通知")}
          desc={translate(SHOW_COMMUNITY ? "有新的活动、互动或审核结果时会显示在这里" : "有新的消息时会显示在这里")}
        />
      )}
    </section>
  );
}
