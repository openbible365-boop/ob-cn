import { type ChangeEvent, useEffect, useRef, useState } from "react";
import { SkeletonScreen } from "../components/SkeletonScreen";
import { useNavigate } from "react-router-dom";
import { CompactToolbar } from "../components/CompactToolbar";
import { Icon } from "../components/Icon";
import { UserAvatar } from "../components/UserAvatar";
import { NotificationInbox } from "../components/NotificationInbox";
import { getHighlights, getNotes, HIGHLIGHTS_CHANGED_EVENT } from "../data/annotations";
import { getConversations } from "../data/huidu";
import { getPrayers } from "../data/prayers";
import { syncStoredPushToken, unregisterCurrentPushToken } from "../data/push";
import { useSettings } from "../context/SettingsContext";
import {
  announceProfileChanged,
  fetchMe,
  logout,
  updateAvatar,
  type SessionUser,
} from "../data/profile";
import { SHOW_COMMUNITY, SHOW_DONATION } from "../data/features";
import { fetchReadingPlans, type ReadingPlan } from "../data/reading-plans";
import { getStreak } from "../data/streak";
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
  // null = 还没拿到（横幅不显示，避免闪一下引导文案又变成计划卡）
  const [plans, setPlans] = useState<ReadingPlan[] | null>(null);
  const [groupsOpen, setGroupsOpen] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetchMe().then((result) => { if (!cancelled) setUser(result); });
    return () => { cancelled = true; };
  }, []);

  const loggedIn = Boolean(user);
  useEffect(() => {
    if (!loggedIn) return;
    let cancelled = false;
    fetchReadingPlans().then((result) => {
      if (!cancelled && result.ok) setPlans(result.plans);
    });
    return () => { cancelled = true; };
  }, [loggedIn]);

  useEffect(() => {
    const refresh = () => refreshLocalContent((value) => value + 1);
    window.addEventListener(HIGHLIGHTS_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(HIGHLIGHTS_CHANGED_EVENT, refresh);
  }, []);

  if (user === undefined) {
    return (
      <div className="screen me-screen">
        <CompactToolbar ariaLabel={translate("个人中心")} primary={translate("我的")} secondary={translate("读取中")} />
        <main className="screen-scroll"><SkeletonScreen label={translate("正在读取账号")} /></main>
      </div>
    );
  }

  if (!user) {
    // 纯登录页：满屏只放品牌、广告语和登录按钮，不放任何数据入口。
    return (
      <div className="screen me-screen">
        {/* 访客态没有可说的副信息，「个人」与「我的」纯属同义反复 */}
        <CompactToolbar ariaLabel={translate("个人中心")} primary={translate("我的")} />
        <main className="screen-scroll me-guest-scroll">
          <div className="me-guest-center">
            <div className="me-guest-brand">
              <div className="me-logo-shield" aria-label={translate("慧读圣经")}>
                <svg
                  viewBox="22 5 76 88"
                  xmlns="http://www.w3.org/2000/svg"
                  width="56"
                  height="56"
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
              <p>{translate(SHOW_COMMUNITY ? "智慧 · 读经 · 社群 · 共勉" : "智慧 · 读经 · 共勉")}</p>
            </div>
            <button className="me-login-button" type="button" onClick={() => navigate("/me/login")}>
              {translate("登录或注册")}
            </button>
          </div>

          <div className="me-legal-links">
            <button type="button" onClick={() => navigate("/legal/terms")}>{translate("用户协议")}</button>
            <button type="button" onClick={() => navigate("/legal/privacy")}>{translate("隐私政策")}</button>
            <button type="button" onClick={() => navigate("/me/feedback")}>{translate("意见反馈")}</button>
          </div>
        </main>
      </div>
    );
  }

  // 四宫格快捷入口：图标统一灰色线性（图标是骨架，不占用紫/金语义色），
  // 数字作为角标；名称本身就在格子里，不再需要单位小字。
  const stats = [
    { icon: "star", label: translate("高亮"), value: getHighlights().length, to: "/me/content?t=highlights" },
    { icon: "edit", label: translate("笔记"), value: getNotes().length, to: "/me/content?t=notes" },
    { icon: "sparkle", label: translate("慧读"), value: getConversations().length, to: "/huidu" },
    // 活动报名属于社群功能，随社群开关一起隐藏；隐藏期间这一格给祷告清单
    ...(SHOW_COMMUNITY
      ? [{ icon: "calendar", label: translate("活动"), value: user.counts.eventSignups, to: "/me/activities" }]
      : [{ icon: "heart", label: translate("祷告"), value: getPrayers().length, to: "/me/prayers" }]),
  ];

  // 设置分两张卡（社群卡单独渲染，只有管理身份才出现）：
  // 第一张是「偏好与数据」——阅读模式、账户、通知、资源，日常高频设置；
  // 第二张是「分享与反馈」——推荐朋友、奉献（开关）、意见反馈，对外动作。
  // 原先的「读经计划 / 我的内容 / 祷告清单」一组被裁掉了——三行全是重复入口：
  // 计划有顶部横幅、内容有四宫格的高亮/笔记、祷告有四宫格的祷告格，一页一个门就够。
  // 用户协议 / 隐私政策是低频法务链接，降级为页脚文字行（与未登录页同一形态）。
  const settingRows = [
    { icon: "cloud", label: translate("数据与账户"), desc: translate("同步状态与本机数据导出"), to: "/me/account" },
    { icon: "bell", label: translate("通知设置"), desc: translate("读经提醒与消息偏好"), to: "/me/notifications" },
    { icon: "download", label: translate("资源管理"), desc: translate("译本启用与注释更新"), to: "/me/resources" },
  ];
  const shareRows = [
    { icon: "share", label: translate("推荐朋友"), desc: translate("分享下载二维码与链接"), to: "/me/referral" },
    // 奉献入口随 SHOW_DONATION 开关：网页端支付承接上线后再放开
    ...(SHOW_DONATION
      ? [{ icon: "gift", label: translate("奉献支持"), desc: translate("支持这项免费的福音事工"), to: "/me/donate" }]
      : []),
    // 反馈走应用内表单（表单页里仍展示联系邮箱）
    { icon: "mail", label: translate("意见反馈"), desc: translate("问题与建议，我们都会读"), to: "/me/feedback" },
  ];

  // 读经横幅：优先进行中的计划；全部读完则显示最近一个，让完成状态可见
  const activePlan = plans?.find((plan) => plan.enrolled && !plan.completedAt)
    ?? plans?.find((plan) => plan.enrolled);
  const planPct = activePlan && activePlan.totalDays > 0
    ? Math.min(100, Math.round((activePlan.completedDays / activePlan.totalDays) * 100))
    : 0;

  const confirmLogout = async () => {
    setLogoutBusy(true);
    setLogoutError("");
    // 先注销本机推送 token（需要登录态），否则退出后这台手机还会收到上个账号的通知
    await unregisterCurrentPushToken();
    const result = await logout();
    setLogoutBusy(false);
    if (result.ok) {
      setUser(null);
    } else {
      // 退出失败：用户仍在登录态，把刚注销的推送登记补回来，否则收不到通知
      void syncStoredPushToken();
      setLogoutError(result.message || translate("退出失败，请稍后重试"));
    }
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
              {/* 套餐标签随支持计划体系（SHOW_DONATION）一起隐藏/恢复 */}
              {SHOW_DONATION && (
                <span className="me-plan-tag">{translate(user.entitlements.label)}</span>
              )}
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

        {/* 读经进度横幅：金色淡底（阅读语义）。没拿到数据前不渲染，避免引导文案闪变 */}
        {activePlan ? (
          <button className="me-plan-banner" type="button" onClick={() => navigate("/me/plans")}>
            <span className="me-plan-banner-head">
              <Icon name="book" size={16} />
              <b>{activePlan.title}</b>
              <small>{activePlan.completedDays}/{activePlan.totalDays} {translate("天")}</small>
              {/* 整卡可点的 affordance：没有箭头没人知道能点 */}
              <Icon name="chevron-right" size={14} className="me-plan-banner-caret" />
            </span>
            <span className="me-plan-banner-bar"><span style={{ width: `${planPct}%` }} /></span>
            <small className="me-plan-banner-today">
              {getStreak() > 0 ? `${translate("连续")} ${getStreak()} ${translate("天")} · ` : ""}
              {activePlan.completedAt
                ? translate("已完成，去看看其他计划")
                : activePlan.today
                  ? `${translate("今日")} · ${translate("第")} ${activePlan.today.dayNumber} ${translate("天")}${activePlan.today.title ? ` · ${activePlan.today.title}` : ""}`
                  : translate("继续读经")}
            </small>
          </button>
        ) : plans !== null && (
          <button className="me-plan-banner is-empty" type="button" onClick={() => navigate("/me/plans")}>
            <Icon name="book" size={16} />
            <span>{translate("还没有进行中的读经计划")}</span>
            <b>{translate("去看看")} ›</b>
          </button>
        )}

        <div className="me-quick" aria-label={translate("我的记录")}>
          {stats.map((stat) => (
            <button key={stat.label} type="button" onClick={() => navigate(stat.to)}>
              <Icon name={stat.icon} size={20} />
              <span>{stat.label}</span>
              {/* 零值弱化：还没有数据的格子不该和有数据的抢注意力 */}
              <b className={`me-quick-count${stat.value === 0 ? " is-zero" : ""}`}>{stat.value}</b>
            </button>
          ))}
        </div>

        {SHOW_COMMUNITY && user.groupAccounts.length > 0 && (
          <div className="me-menu-card">
            <button type="button" aria-expanded={groupsOpen} onClick={() => setGroupsOpen((value) => !value)}>
              <span className="me-menu-icon"><Icon name="users" size={16} /></span>
              <span className="me-menu-copy">
                <b>{translate("管理的社群")}</b>
              </span>
              <small className="me-menu-meta">{user.groupAccounts.length} {translate("个")}</small>
              <Icon name="chevron-right" size={16} className={groupsOpen ? "is-rotated" : undefined} />
            </button>
            {groupsOpen && (
              <div className="me-group-list is-nested">
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
            )}
          </div>
        )}

        {/* 阅读模式已迁入圣经页的 Aa 阅读设置面板（与字号/字体同处），这里不再重复 */}
        <div className="me-menu-card">
          {settingRows.map((row) => (
            <button
              key={row.label}
              type="button"
              onClick={() => navigate(row.to)}
            >
              <span className="me-menu-icon"><Icon name={row.icon} size={16} /></span>
              <span className="me-menu-copy">
                <b>{row.label}</b>
                {row.desc && <small>{row.desc}</small>}
              </span>
              <Icon name="chevron-right" size={16} />
            </button>
          ))}
        </div>

        {/* 分享与反馈：对外动作单独一张卡，和日常设置分组 */}
        <div className="me-menu-card">
          {shareRows.map((row) => (
            <button
              key={row.label}
              type="button"
              onClick={() => navigate(row.to)}
            >
              <span className="me-menu-icon"><Icon name={row.icon} size={16} /></span>
              <span className="me-menu-copy">
                <b>{row.label}</b>
                {row.desc && <small>{row.desc}</small>}
              </span>
              <Icon name="chevron-right" size={16} />
            </button>
          ))}
        </div>

        {/* 消息中心：从「通知设置」迁来，登录后的站内消息直接在「我的」里看 */}
        <NotificationInbox translate={translate} />

        {!logoutConfirm ? (
          <button className="me-logout-button" type="button" onClick={() => setLogoutConfirm(true)}>
            {translate("退出登录")}
          </button>
        ) : (
          <section className="me-logout-confirm" aria-label={translate("确认退出登录")}>
            <div>
              <b>{translate("退出当前账号？")}</b>
              {/* 与实际行为一致：clearAnnotationsForLogout 等会清本机个人数据，防止串进下一个账号 */}
              <small>{translate("退出后本机的笔记、高亮与慧读记录将被清除；已同步到账号的内容在下次登录后自动恢复。")}</small>
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

        <div className="me-legal-links">
          <button type="button" onClick={() => navigate("/legal/terms")}>{translate("用户协议")}</button>
          <button type="button" onClick={() => navigate("/legal/privacy")}>{translate("隐私政策")}</button>
        </div>

        <div className="me-version">慧读圣经 · v{__APP_VERSION__}</div>
      </main>
    </div>
  );
}
