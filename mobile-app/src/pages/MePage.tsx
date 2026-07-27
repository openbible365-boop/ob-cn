import { type ChangeEvent, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CompactToolbar } from "../components/CompactToolbar";
import { Icon } from "../components/Icon";
import { UserAvatar } from "../components/UserAvatar";
import { getHighlights, getNotes, HIGHLIGHTS_CHANGED_EVENT } from "../data/annotations";
import { getConversations } from "../data/huidu";
import { useSettings } from "../context/SettingsContext";
import {
  announceProfileChanged,
  fetchMe,
  logout,
  updateAvatar,
  type SessionUser,
} from "../data/profile";
import { prepareAvatarImage } from "../utils/avatar";

export function MePage() {
  const { translate } = useSettings();
  const navigate = useNavigate();
  // undefined = checking the session, null = logged out.
  const [user, setUser] = useState<SessionUser | null | undefined>(undefined);
  const [, refreshLocalContent] = useState(0);
  const [logoutConfirm, setLogoutConfirm] = useState(false);
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarMessage, setAvatarMessage] = useState("");
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetchMe().then((result) => { if (!cancelled) setUser(result); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const refresh = () => refreshLocalContent((value) => value + 1);
    window.addEventListener(HIGHLIGHTS_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(HIGHLIGHTS_CHANGED_EVENT, refresh);
  }, []);

  if (user === undefined) {
    return (
      <div className="screen me-screen">
        <CompactToolbar ariaLabel={translate("个人中心")} primary={translate("我的")} secondary={translate("读取中")} />
        <div className="screen-scroll me-loading" role="status">{translate("正在读取账号…")}</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="screen me-screen">
        <CompactToolbar
          ariaLabel={translate("个人中心")}
          primary={translate("我的")}
          secondary={translate("个人")}
          actions={(
            <button
              className="bible-toolbar-action"
              type="button"
              aria-label={translate("登录或注册")}
              title={translate("登录或注册")}
              onClick={() => navigate("/me/login")}
            >
              <Icon name="user" size={18} />
            </button>
          )}
        />
        <main className="screen-scroll me-guest-scroll">
          <div className="me-guest-brand">
            <div className="me-logo-shield" aria-label={translate("慧读圣经")}>
              <svg
                viewBox="16 8 88 88"
                xmlns="http://www.w3.org/2000/svg"
                width="48"
                height="48"
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
            <h1>
              <span style={{ color: "#E89A2C" }}>{translate("慧读")}</span>
              <span>{translate("圣经")}</span>
            </h1>
            <p>{translate("智慧 · 读经 · 社群 · 共勉")}</p>
          </div>

          <div className="me-guest-prompt">{translate("尚未登录")}</div>
          <button className="me-login-button" type="button" onClick={() => navigate("/me/login")}>
            {translate("登录或注册")}
          </button>
          <div className="me-guest-benefits" aria-label={translate("登录后可用功能")}>
            <span><Icon name="check" size={14} />{translate("跨设备同步高亮")}</span>
            <span><Icon name="check" size={14} />{translate("管理社群与活动")}</span>
            <span><Icon name="check" size={14} />{translate("保留个人阅读资料")}</span>
          </div>
          <small>{translate("不登录也可以在本机保存笔记和慧读记录。")}</small>
        </main>
      </div>
    );
  }

  const stats = [
    { label: translate("高亮"), value: getHighlights().length, unit: translate("处"), to: "/me/content?t=highlights" },
    { label: translate("笔记"), value: getNotes().length, unit: translate("条"), to: "/me/content?t=notes" },
    { label: translate("慧读"), value: getConversations().length, unit: translate("次"), to: "/huidu" },
    { label: translate("报名活动"), value: user.counts.eventSignups, unit: translate("项"), to: "/me/activities" },
  ];

  const accountRows = [
    { icon: "align-justify", label: translate("我的内容"), desc: translate("查看高亮与笔记"), to: "/me/content" },
    { icon: "download", label: translate("数据与账户"), desc: translate("查看同步状态并导出本机数据"), to: "/me/account" },
    { icon: "bell", label: translate("通知设置"), desc: translate("管理本机测试提醒"), to: "/me/notifications" },
    { icon: "file-text", label: translate("用户协议"), desc: translate("了解服务与使用规则"), to: "/legal/terms" },
    { icon: "shield", label: translate("隐私政策"), desc: translate("查看数据与权限说明"), to: "/legal/privacy" },
  ];

  const confirmLogout = async () => {
    setLogoutBusy(true);
    setLogoutError("");
    const result = await logout();
    setLogoutBusy(false);
    if (result.ok) setUser(null);
    else setLogoutError(result.message || translate("退出失败，请稍后重试"));
  };

  const handleAvatarChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || avatarBusy) return;

    setAvatarBusy(true);
    setAvatarMessage("");
    try {
      const avatarUrl = await prepareAvatarImage(file);
      const result = await updateAvatar(avatarUrl);
      if (!result.ok) {
        setAvatarMessage(result.message);
        return;
      }
      const updatedUser = { ...user, avatarUrl: result.avatarUrl };
      setUser(updatedUser);
      announceProfileChanged(updatedUser);
      setAvatarMessage(translate("头像已更新"));
    } catch (error) {
      setAvatarMessage(error instanceof Error ? error.message : translate("头像处理失败，请重试"));
    } finally {
      setAvatarBusy(false);
    }
  };

  return (
    <div className="screen me-screen">
      <CompactToolbar ariaLabel={translate("个人中心")} primary={translate("我的")} secondary={translate(user.entitlements.label)} />

      <main className="screen-scroll me-scroll">
        <section className="me-profile" aria-label={translate("账号信息")}>
          <button
            className="me-avatar-upload"
            type="button"
            aria-label={avatarBusy ? translate("正在更新头像") : translate("更换个人头像")}
            disabled={avatarBusy}
            onClick={() => avatarInputRef.current?.click()}
          >
            <UserAvatar
              className="me-avatar"
              name={user.name}
              avatarColor={user.avatarColor}
              avatarUrl={user.avatarUrl}
              size={52}
            />
            <span className="me-avatar-edit" aria-hidden="true">
              <Icon name="camera" size={11} />
            </span>
          </button>
          <input
            ref={avatarInputRef}
            className="sr-only"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            onChange={handleAvatarChange}
          />
          <div className="me-profile-copy">
            <h1>{user.name}</h1>
            <p>{user.email ?? translate("已登录用户")}</p>
            {avatarMessage && (
              <small
                className={`me-avatar-message${avatarMessage === translate("头像已更新") ? " is-success" : ""}`}
                role="status"
              >
                {avatarMessage}
              </small>
            )}
          </div>
          <span className="me-account-status">{translate("已登录")}</span>
        </section>

        <div className="me-sync-note">
          <Icon name="cloud" size={16} />
          <span>{translate("高亮与活动已同步；笔记、慧读记录保存在本机")}</span>
        </div>

        <section className="me-section" aria-labelledby="me-reading-title">
          <div className="me-section-heading">
            <h2 id="me-reading-title">{translate("阅读与活动")}</h2>
            <button type="button" onClick={() => navigate("/me/content")}>{translate("查看内容")}</button>
          </div>
          <div className="me-stats">
            {stats.map((stat) => (
              <button key={stat.label} type="button" onClick={() => navigate(stat.to)}>
                <span className="me-stat-value">{stat.value}<small>{stat.unit}</small></span>
                <span>{stat.label}</span>
              </button>
            ))}
          </div>
        </section>

        {user.groupAccounts.length > 0 && (
          <section className="me-section" aria-labelledby="me-groups-title">
            <div className="me-section-heading">
              <h2 id="me-groups-title">{translate("管理的社群")}</h2>
              <span>{user.groupAccounts.length} {translate("个")}</span>
            </div>
            <div className="me-group-list">
              {user.groupAccounts.map((account) => (
                <div className="me-group-item" key={account.id}>
                  <button className="me-group-primary" type="button" onClick={() => navigate(`/community/${account.id}`)}>
                    <span className="me-group-avatar" style={{ background: account.avatarColor }}>{account.abbreviation}</span>
                    <span className="me-group-copy">
                      <b>{account.name}</b>
                      <small>{account.role === "OWNER" ? translate("群主") : translate("管理员")} · {account.usage.members} {translate("位成员")}</small>
                    </span>
                  </button>
                  <button
                    className="me-group-manage"
                    type="button"
                    aria-label={translate("管理") + translate(account.name)}
                    onClick={() => navigate(`/community/${account.id}/settings`)}
                  >
                    {translate("管理")}
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="me-section" aria-labelledby="me-account-title">
          <div className="me-section-heading">
            <h2 id="me-account-title">{translate("账户与设置")}</h2>
          </div>
          <div className="me-account-menu">
            {accountRows.map((row) => (
              <button key={row.label} type="button" onClick={() => navigate(row.to)}>
                <span className="me-menu-icon"><Icon name={row.icon} size={16} /></span>
                <span className="me-menu-copy"><b>{row.label}</b><small>{row.desc}</small></span>
                <Icon name="chevron-right" size={15} />
              </button>
            ))}
          </div>
        </section>

        {!logoutConfirm ? (
          <button className="me-logout-button" type="button" onClick={() => setLogoutConfirm(true)}>
            {translate("退出登录")}
          </button>
        ) : (
          <section className="me-logout-confirm" aria-label={translate("确认退出登录")}>
            <div>
              <b>{translate("退出当前账号？")}</b>
              <small>{translate("本机笔记和慧读记录不会删除。")}</small>
            </div>
            <div className="me-logout-actions">
              <button type="button" disabled={logoutBusy} onClick={() => setLogoutConfirm(false)}>{translate("取消")}</button>
              <button type="button" className="is-danger" disabled={logoutBusy} onClick={confirmLogout}>
                {translate(logoutBusy ? "退出中…" : "确认退出")}
              </button>
            </div>
          </section>
        )}
        {logoutError && <div className="me-logout-error" role="alert">{logoutError}</div>}

        <div className="me-version">OpenBible · v0.1</div>
      </main>
    </div>
  );
}
