"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import {
  sendAdminNotification,
  type NotificationSendState,
} from "@/lib/actions/notifications";

export type RecentSend = {
  id: string;
  detail: string;
  operator: string;
  at: string;
};

export type NotificationDevice = {
  id: string;
  userName: string;
  email: string | null;
  uid: number;
  platform: "ANDROID" | "IOS";
  appVersion: string | null;
  enabled: boolean;
  ipAddress: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  lastSeenAt: string;
  createdAt: string;
};

function platformLabel(platform: NotificationDevice["platform"]) {
  return platform === "IOS" ? "iPhone / iOS" : "Android 手机";
}

function shortDeviceId(id: string) {
  return `设备 …${id.slice(-6)}`;
}

export function NotificationComposer({
  devices,
  recentSends,
}: {
  devices: NotificationDevice[];
  recentSends: RecentSend[];
}) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  // 页内两步确认（替代英文的 window.confirm）：第一次点进入待命态，再点才真发
  const [armed, setArmed] = useState(false);
  const [query, setQuery] = useState("");
  const [state, action, pending] = useActionState<
    NotificationSendState,
    FormData
  >(sendAdminNotification, null);

  // 发送成功后清空草稿与选择，避免误触重复群发
  const handledStateRef = useRef<NotificationSendState>(null);
  useEffect(() => {
    if (state && state !== handledStateRef.current && state.kind === "success") {
      setTitle("");
      setBody("");
      setSelected(new Set());
    }
    handledStateRef.current = state;
  }, [state]);

  const enabledDevices = useMemo(
    () => devices.filter((device) => device.enabled),
    [devices],
  );
  // 搜索：按用户名 / UID / 邮箱 / 归属地过滤设备列表
  const visibleDevices = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return devices;
    return devices.filter((device) =>
      [device.userName, String(device.uid), device.email, device.country, device.region, device.city]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(keyword)),
    );
  }, [devices, query]);
  const allSelected =
    enabledDevices.length > 0 &&
    enabledDevices.every((device) => selected.has(device.id));

  function toggleDevice(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected
      ? new Set()
      : new Set(enabledDevices.map((device) => device.id)));
  }

  return (
    <div className="notification-management">
      <form
        action={action}
        className="card notification-composer"
        onSubmit={(event) => {
          // 两步确认：第一次提交只进入待命态
          if (!armed) {
            event.preventDefault();
            setArmed(true);
            window.setTimeout(() => setArmed(false), 4000);
            return;
          }
          setArmed(false);
        }}
      >
        <div>
          <div className="notification-section-title">创建推送通知</div>
          <div className="notification-section-sub">
            通知会立即发送到所选手机的系统通知栏
          </div>
        </div>

        <label className="notification-field">
          <span>标题 <small>{title.length}/60</small></span>
          <input
            name="title"
            value={title}
            maxLength={60}
            placeholder="例如：今晚 8 点线上共读"
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>

        <label className="notification-field">
          <span>通知内容 <small>{body.length}/300</small></span>
          <textarea
            name="body"
            value={body}
            maxLength={300}
            rows={6}
            placeholder="输入用户将在手机通知栏看到的内容"
            onChange={(event) => setBody(event.target.value)}
          />
        </label>

        {[...selected].map((id) => (
          <input key={id} type="hidden" name="deviceId" value={id} />
        ))}

        {state && (
          <div className={`notification-result ${state.kind}`}>
            {state.message}
          </div>
        )}

        <button
          className={`notification-send-button${armed ? " is-armed" : ""}`}
          type="submit"
          disabled={pending || selected.size === 0 || !title.trim() || !body.trim()}
        >
          {pending
            ? "正在发送…"
            : armed
              ? `再点一次确认发送（${selected.size} 台）`
              : `向 ${selected.size} 台手机推送`}
        </button>

        <div className="notification-safety-note">
          发送需点击两次确认；无效 Token 会在发送失败后自动停用。
        </div>

        {recentSends.length > 0 && (
          <div className="notification-history">
            <div className="notification-section-title">最近发送</div>
            <ul>
              {recentSends.map((entry) => (
                <li key={entry.id}>
                  <span className="notification-history-detail">{entry.detail}</span>
                  <small>{entry.at} · {entry.operator}</small>
                </li>
              ))}
            </ul>
          </div>
        )}
      </form>

      <section className="card notification-devices">
        <div className="notification-device-toolbar">
          <div>
            <div className="notification-section-title">已登记手机</div>
            <div className="notification-section-sub">
              共 {devices.length} 台，已启用 {enabledDevices.length} 台
            </div>
          </div>
          <label className="notification-select-all">
            <input
              type="checkbox"
              checked={allSelected}
              disabled={enabledDevices.length === 0}
              onChange={toggleAll}
            />
            全选已启用手机
          </label>
        </div>

        {devices.length > 0 && (
          <input
            className="notification-device-search"
            type="search"
            value={query}
            placeholder="搜索用户名、UID、邮箱或归属地…"
            onChange={(event) => setQuery(event.target.value)}
          />
        )}

        <div className="notification-device-list">
          {visibleDevices.map((device) => (
            <label
              key={device.id}
              className={`notification-device-row${device.enabled ? "" : " disabled"}`}
            >
              <input
                type="checkbox"
                checked={selected.has(device.id)}
                disabled={!device.enabled}
                onChange={() => toggleDevice(device.id)}
              />
              <span className={`notification-platform-icon ${device.platform.toLowerCase()}`}>
                {device.platform === "IOS" ? "iOS" : "A"}
              </span>
              <span className="notification-user">
                <strong>{device.userName}</strong>
                <small>
                  UID {device.uid}
                  {device.email ? ` · ${device.email}` : ""}
                </small>
              </span>
              <span className="notification-device-meta">
                <strong>{platformLabel(device.platform)}</strong>
                <small>
                  {device.appVersion ? `App ${device.appVersion} · ` : ""}
                  {shortDeviceId(device.id)}
                </small>
              </span>
              <span className="notification-seen">
                <strong>{device.enabled ? "已启用" : "已停用"}</strong>
                <small>最近登记 {device.lastSeenAt}</small>
              </span>
              <span className="notification-location">
                <strong>{device.ipAddress ?? "IP 等待登记"}</strong>
                <small>
                  {[device.country, device.region, device.city]
                    .filter(Boolean)
                    .join(" · ") || "打开手机应用后自动更新归属地"}
                </small>
              </span>
            </label>
          ))}

          {devices.length === 0 ? (
            <div className="notification-empty">
              暂无手机 Token；用户在原生应用中启用系统通知后会显示在这里。
            </div>
          ) : visibleDevices.length === 0 && (
            <div className="notification-empty">没有匹配「{query}」的手机。</div>
          )}
        </div>
      </section>
    </div>
  );
}
