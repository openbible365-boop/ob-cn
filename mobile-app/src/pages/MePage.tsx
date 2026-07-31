import { type ChangeEvent, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CompactToolbar } from "../components/CompactToolbar";
import { Icon } from "../components/Icon";
import { UserAvatar } from "../components/UserAvatar";
import { getHighlights, getNotes, HIGHLIGHTS_CHANGED_EVENT } from "../data/annotations";
import { getConversations } from "../data/huidu";
import {
  announceProfileChanged,
  fetchMe,
  logout,
  updateAvatar,
  type SessionUser,
} from "../data/profile";
import { prepareAvatarImage } from "../utils/avatar";

export function MePage() {
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
        <CompactToolbar ariaLabel="个人中心" primary="我的" secondary="读取中" />
        <div className="screen-scroll me-loading" role="status">正在读取账号…</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="screen me-screen">
        <CompactToolbar ariaLabel="个人中心" primary="我的" secondary="未登录" />
        <main className="screen-scroll me-guest">
          <div className="me-guest-mark" aria-hidden="true">
            <Icon name="user" size={28} />
          </div>
          <h1>登录你的个人账户</h1>
          <p>同步经文高亮，管理社群，并在不同设备继续阅读。</p>
          <button className="me-login-button" type="button" onClick={() => navigate("/me/login")}>
            登录或注册
          </button>
          <div className="me-guest-benefits" aria-label="登录后可用功能">
            <span><Icon name="check" size={14} />跨设备同步高亮</span>
            <span><Icon name="check" size={14} />管理社群与活动</span>
            <span><Icon name="check" size={14} />保留个人阅读资料</span>
          </div>
          <small>不登录也可以在本机保存笔记和慧读记录。</small>
        </main>
      </div>
    );
  }

  const stats = [
    { label: "高亮", value: getHighlights().length, unit: "处", to: "/me/content?t=highlights" },
    { label: "笔记", value: getNotes().length, unit: "条", to: "/me/content?t=notes" },
    { label: "慧读", value: getConversations().length, unit: "次", to: "/huidu" },
    { label: "报名活动", value: user.counts.eventSignups, unit: "项", to: "/me/activities" },
  ];

  const accountRows = [
    { icon: "calendar", label: "读经计划", desc: "管理个人与社群每日阅读", to: "/me/plans" },
    { icon: "align-justify", label: "我的内容", desc: "查看高亮与笔记", to: "/me/content" },
    { icon: "download", label: "数据与账户", desc: "查看同步状态并导出本机数据", to: "/me/account" },
    { icon: "bell", label: "通知设置", desc: "管理本机测试提醒", to: "/me/notifications" },
    { icon: "file-text", label: "用户协议", desc: "了解服务与使用规则", to: "/legal/terms" },
    { icon: "shield", label: "隐私政策", desc: "查看数据与权限说明", to: "/legal/privacy" },
  ];

  const confirmLogout = async () => {
    setLogoutBusy(true);
    setLogoutError("");
    const result = await logout();
    setLogoutBusy(false);
    if (result.ok) setUser(null);
    else setLogoutError(result.message || "退出失败，请稍后重试");
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
      setAvatarMessage("头像已更新");
    } catch (error) {
      setAvatarMessage(error instanceof Error ? error.message : "头像处理失败，请重试");
    } finally {
      setAvatarBusy(false);
    }
  };

  return (
    <div className="screen me-screen">
      <CompactToolbar ariaLabel="个人中心" primary="我的" secondary={user.entitlements.label} />

      <main className="screen-scroll me-scroll">
        <section className="me-profile" aria-label="账号信息">
          <button
            className="me-avatar-upload"
            type="button"
            aria-label={avatarBusy ? "正在更新头像" : "更换个人头像"}
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
            <p>{user.email ?? "已登录用户"}</p>
            {avatarMessage && (
              <small
                className={`me-avatar-message${avatarMessage === "头像已更新" ? " is-success" : ""}`}
                role="status"
              >
                {avatarMessage}
              </small>
            )}
          </div>
          <span className="me-account-status">已登录</span>
        </section>

        <div className="me-sync-note">
          <Icon name="cloud" size={16} />
          <span>高亮与活动已同步；笔记、慧读记录保存在本机</span>
        </div>

        <section className="me-section" aria-labelledby="me-reading-title">
          <div className="me-section-heading">
            <h2 id="me-reading-title">阅读与活动</h2>
            <button type="button" onClick={() => navigate("/me/content")}>查看内容</button>
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
              <h2 id="me-groups-title">管理的社群</h2>
              <span>{user.groupAccounts.length} 个</span>
            </div>
            <div className="me-group-list">
              {user.groupAccounts.map((account) => (
                <div className="me-group-item" key={account.id}>
                  <button className="me-group-primary" type="button" onClick={() => navigate(`/community/${account.id}`)}>
                    <span className="me-group-avatar" style={{ background: account.avatarColor }}>{account.abbreviation}</span>
                    <span className="me-group-copy">
                      <b>{account.name}</b>
                      <small>{account.role === "OWNER" ? "群主" : "管理员"} · {account.usage.members} 位成员</small>
                    </span>
                  </button>
                  <button
                    className="me-group-manage"
                    type="button"
                    aria-label={`管理${account.name}`}
                    onClick={() => navigate(`/community/${account.id}/settings`)}
                  >
                    管理
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="me-section" aria-labelledby="me-account-title">
          <div className="me-section-heading">
            <h2 id="me-account-title">账户与设置</h2>
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
            退出登录
          </button>
        ) : (
          <section className="me-logout-confirm" aria-label="确认退出登录">
            <div>
              <b>退出当前账号？</b>
              <small>本机笔记和慧读记录不会删除。</small>
            </div>
            <div className="me-logout-actions">
              <button type="button" disabled={logoutBusy} onClick={() => setLogoutConfirm(false)}>取消</button>
              <button type="button" className="is-danger" disabled={logoutBusy} onClick={confirmLogout}>
                {logoutBusy ? "退出中…" : "确认退出"}
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
