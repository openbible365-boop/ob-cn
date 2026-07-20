import Link from "next/link";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/current-user";
import { logout } from "@/lib/actions/site/me";
import { appleConfigured } from "@/lib/apple";
import { LoginCard } from "@/components/site/LoginCard";

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  apple_not_configured: "Apple 登录尚未配置（需要 Apple 开发者账号，详见 .env.example）",
  apple_denied: "已取消 Apple 登录",
  apple_state: "登录状态校验失败，请重新尝试",
  apple_verify: "Apple 登录验证失败，请稍后重试（服务器日志有详细错误）",
  apple_banned: "该账号已被封禁，如有疑问请联系运营",
};

export default async function MePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const user = await getSessionUser();
  if (!user) {
    return (
      <LoginCard
        appleEnabled={appleConfigured()}
        initialError={error ? OAUTH_ERROR_MESSAGES[error] : undefined}
      />
    );
  }

  const [highlightCount, noteCount, conversationCount, postCount] = await Promise.all([
    db.highlight.count({ where: { userId: user.id } }),
    db.note.count({ where: { userId: user.id } }),
    db.conversation.count({ where: { userId: user.id } }),
    db.post.count({ where: { authorId: user.id, status: "VISIBLE" } }),
  ]);

  const stats = [
    {
      href: "/me/content?tab=highlights",
      count: highlightCount,
      label: "高亮",
      icon: <div style={{ width: 14, height: 14, background: "var(--yellow)", borderRadius: 4 }} />,
    },
    {
      href: "/me/content?tab=notes",
      count: noteCount,
      label: "笔记",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--body)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z" />
        </svg>
      ),
    },
    {
      href: "/me/content?tab=huidu",
      count: conversationCount,
      label: "慧读历史",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--purple)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3l2.2 6.3L20.5 12l-6.3 2.7L12 21l-2.2-6.3L3.5 12l6.3-2.7z" />
          <path d="M19 2v4" /><path d="M17 4h4" />
        </svg>
      ),
    },
    {
      href: "/me/content?tab=posts",
      count: postCount,
      label: "我的帖子",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--body)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
        </svg>
      ),
    },
  ];

  const settingsRows = [
    { label: "通知管理", href: "/me/notifications", icon: "bell" },
    { label: "外观与阅读偏好", value: "跟随系统", disabled: true, icon: "sun" },
    { label: "账号与隐私", disabled: true, icon: "lock" },
    { label: "关于与反馈", value: "v1.0.0", disabled: true, icon: "mail" },
  ];

  const rowIcon = (name: string) => {
    switch (name) {
      case "bell":
        return <><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></>;
      case "sun":
        return <><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" /></>;
      case "lock":
        return <><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>;
      default:
        return <><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22 6 12 13 2 6" /></>;
    }
  };

  return (
    <div style={{ flex: 1, overflow: "auto", padding: "24px 28px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", display: "flex", flexDirection: "column", gap: 14 }}>
        {/* profile header */}
        <div className="card" style={{ padding: "18px 20px", display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ position: "relative", overflow: "hidden", flex: "none", display: "flex", alignItems: "center", justifyContent: "center", width: 56, height: 56, background: user.avatarColor, borderRadius: 100, fontSize: 22, fontWeight: 800 }}>
            {user.name.slice(0, 1)}
            {user.avatarUrl && (
              <img
                src={user.avatarUrl}
                alt=""
                referrerPolicy="no-referrer"
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
              />
            )}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 2 }}>{user.name}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--body)" }}>UID {user.uid} · 编辑资料</div>
          </div>
          <div style={{ color: "var(--body)" }}>›</div>
        </div>

        {/* cloud sync */}
        <div className="card" style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--purple)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
          </svg>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 1 }}>多端云同步 · 已同步</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--body)" }}>高亮 / 笔记 / 慧读历史 / 阅读进度</div>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--purple)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
        </div>

        {/* my content stats */}
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.08em", color: "var(--body)", marginTop: 4 }}>我的内容</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
          {stats.map((s) => (
            <Link key={s.label} href={s.href} className="card" style={{ padding: "14px 16px" }}>
              <div style={{ marginBottom: 8 }}>{s.icon}</div>
              <div style={{ fontSize: 20, fontWeight: 800 }}>{s.count}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--body)" }}>{s.label}</div>
            </Link>
          ))}
        </div>

        {/* settings list */}
        <div className="card" style={{ overflow: "hidden" }}>
          {settingsRows.map((row, i) => {
            const inner = (
              <>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--body)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{rowIcon(row.icon)}</svg>
                <div style={{ flex: 1, fontSize: 14, fontWeight: 700 }}>{row.label}</div>
                {row.value && <div style={{ fontSize: 12, fontWeight: 600, color: "var(--body)" }}>{row.value}</div>}
                <div style={{ color: "var(--body)" }}>›</div>
              </>
            );
            const style: React.CSSProperties = {
              display: "flex", alignItems: "center", gap: 12, padding: "14px 16px",
              borderBottom: i < settingsRows.length - 1 ? "1px solid var(--surface-2)" : undefined,
            };
            return row.disabled ? (
              <div key={row.label} style={{ ...style, opacity: 0.55, cursor: "default" }} title="即将上线">{inner}</div>
            ) : (
              <Link key={row.label} href={row.href!} style={style}>{inner}</Link>
            );
          })}
        </div>

        {/* logout */}
        <form action={logout}>
          <button
            type="submit"
            className="card"
            style={{ width: "100%", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontSize: 14, fontWeight: 800, color: "var(--pink)", cursor: "pointer" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            退出登录
          </button>
        </form>
      </div>
    </div>
  );
}
