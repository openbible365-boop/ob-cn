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
              <Icon name="user" size={20} />
            </button>
          )}
        />
        <main className="screen-scroll me-guest-scroll">
          <div className="me-guest-brand">
            <div className="me-logo-shield" aria-label={translate("慧读圣经")}>
              <svg
                viewBox="22 5 76 88"
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
                <path d="M60 53 C 50 45, 34 45, 26 52 L 26 88 C 34 79, 50 79, 60 88 Z" fill="#F2C96D" stroke="currentColor" strokeWidth="6" strokeLinejoin="round" />
                <path d="M60 53 C 70 45, 86 45, 94 52 L 94 88 C 86 79, 70 79, 60 88 Z" fill="#F2C96D" stroke="currentColor" strokeWidth="6" strokeLinejoin="round" />
                <line x1="60" y1="53" x2="60" y2="88" stroke="currentColor" strokeWidth="5" />
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

  // 数字后原来跟着「处 / 条 / 次 / 项」四个不同的小字单位，读起来零碎，
  // 而卡片下面本来就有名称，单位并不提供额外信息。
  const stats = [
    { label: translate("高亮"), value: getHighlights().length, to: "/me/content?t=highlights" },
    { label: translate("笔记"), value: getNotes().length, to: "/me/content?t=notes" },
    { label: translate("慧读"), value: getConversations().length, to: "/huidu" },
    { label: translate("活动"), value: user.counts.eventSignups, to: "/me/activities" },
  ];

  // 功能入口留卡片，法务条款降级成底部文字链接：
  // 六项原来权重完全一样，但读经计划和隐私政策显然不是一个使用频率。
  // 副标题只保留真正补充了信息的那几条，纯换句话重说标题的删掉。
  const accountRows = [
    { icon: "calendar", label: translate("读经计划"), desc: translate("个人与社群每日阅读"), to: "/me/plans" },
    { icon: "align-justify", label: translate("我的内容"), desc: "", to: "/me/content" },
    { icon: "download", label: translate("数据与账户"), desc: translate("同步状态与本机数据导出"), to: "/me/account" },
    { icon: "bell", label: translate("通知设置"), desc: "", to: "/me/notifications" },
  ];

  const legalRows = [
    { label: translate("用户协议"), to: "/legal/terms" },
    { label: translate("隐私政策"), to: "/legal/privacy" },
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
      {/* 套餐已经跟在账号名后面，顶栏不再重复一遍。 */}
      <CompactToolbar ariaLabel={translate("个人中心")} primary={translate("我的")} />

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
              <Icon name="camera" size={12} />
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
            <h1>
              {user.name}
              {/* 套餐从顶栏挪到名字旁边：放在「我的」后面像个来路不明的标签，
                  贴着账号才读得出这是这个账号的方案。 */}
              <span className="me-plan-tag">{translate(user.entitlements.label)}</span>
            </h1>
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
        </section>

        <section className="me-section" aria-labelledby="me-reading-title">
          <div className="me-section-heading">
            <h2 id="me-reading-title">{translate("我的记录")}</h2>
            <button type="button" onClick={() => navigate("/me/content")}>{translate("查看内容")}</button>
          </div>
          <div className="me-stats">
            {stats.map((stat) => (
              <button key={stat.label} type="button" onClick={() => navigate(stat.to)}>
                <span className="me-stat-value">{stat.value}</span>
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
                <span className="me-menu-copy">
                  <b>{row.label}</b>
                  {row.desc && <small>{row.desc}</small>}
                </span>
                <Icon name="chevron-right" size={16} />
              </button>
            ))}
          </div>
        </section>

        <div className="me-legal-links">
          {legalRows.map((row) => (
            <button key={row.label} type="button" onClick={() => navigate(row.to)}>{row.label}</button>
          ))}
        </div>

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
