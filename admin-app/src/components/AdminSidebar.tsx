"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

type Role = "SUPER_ADMIN" | "MODERATOR";

type Scope = "shared" | "app";

// 后台按「这块内容归哪一端用」分组：
//   共用   —— 两端读写同一份数据（笔记、高亮已互通）
//   App 端 —— 网页版没有对应功能（网页版无社群，也就没有群活动）
// 原「网页版」组（研经笔记/百科/影音/灵修）因全部为零内容空壳已裁撤——
// 对应 /api/web 只读接口保留，待网页版真正启用这些栏目时再恢复管理页
const SCOPE_LABEL: Record<Scope, string> = {
  shared: "两端共用",
  app: "App 端",
};

// 以 App 端实际开放的功能为标准，对应功能未上线的管理模块先藏入口（页面与接口保留）：
//   社群管理 / 活动监管 / 内容审核（审核对象是社群帖子）—— App 端 SHOW_COMMUNITY=false
//   音频缓存 —— App 端整卷音频缓存功能已下线
// App 端恢复对应功能时翻回 true 即可。
const SHOW_COMMUNITY_ADMIN = false;
const SHOW_AUDIO_CACHE_ADMIN = false;

const NAV_ITEMS: { href: string; label: string; roles: Role[]; scope: Scope; hidden?: boolean }[] = [
  { href: "/admin/dashboard", label: "数据看板", roles: ["SUPER_ADMIN", "MODERATOR"], scope: "shared" },
  { href: "/admin/users", label: "用户管理", roles: ["SUPER_ADMIN", "MODERATOR"], scope: "shared" },
  { href: "/admin/content", label: "内容管理", roles: ["SUPER_ADMIN", "MODERATOR"], scope: "shared" },
  { href: "/admin/commentary", label: "注释校对", roles: ["SUPER_ADMIN", "MODERATOR"], scope: "shared" },
  { href: "/admin/annotations", label: "用户标注", roles: ["SUPER_ADMIN", "MODERATOR"], scope: "shared" },
  { href: "/admin/moderation", label: "内容审核", roles: ["SUPER_ADMIN", "MODERATOR"], scope: "shared", hidden: !SHOW_COMMUNITY_ADMIN },
  { href: "/admin/ai", label: "AI 模型与提示词", roles: ["SUPER_ADMIN"], scope: "shared" },
  { href: "/admin/audit", label: "权限与审计", roles: ["SUPER_ADMIN"], scope: "shared" },

  { href: "/admin/communities", label: "社群管理", roles: ["SUPER_ADMIN", "MODERATOR"], scope: "app", hidden: !SHOW_COMMUNITY_ADMIN },
  { href: "/admin/events", label: "活动监管", roles: ["SUPER_ADMIN", "MODERATOR"], scope: "app", hidden: !SHOW_COMMUNITY_ADMIN },
  { href: "/admin/share-cards", label: "分享模板", roles: ["SUPER_ADMIN", "MODERATOR"], scope: "app" },
  { href: "/admin/audio-cache", label: "音频缓存", roles: ["SUPER_ADMIN"], scope: "app", hidden: !SHOW_AUDIO_CACHE_ADMIN },
  { href: "/admin/notifications", label: "通知推送", roles: ["SUPER_ADMIN"], scope: "app" },
  { href: "/admin/feedback", label: "意见反馈", roles: ["SUPER_ADMIN", "MODERATOR"], scope: "app" },
];

const SCOPE_ORDER: Scope[] = ["shared", "app"];

export function AdminSidebar({ operatorName, role }: { operatorName: string; role?: string }) {
  const pathname = usePathname();
  const visibleItems = NAV_ITEMS.filter((item) => !item.hidden && item.roles.includes(role as Role));

  return (
    <div className="admin-sidebar">
      <div className="brand">
        <div className="mark">
<svg width="18" height="18" viewBox="22 5 76 88" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <polygon points="60,9 63.2,15.8 72,19 63.2,22.2 60,31 56.8,22.2 48,19 56.8,15.8" fill="#E89A2C" />
            <polygon points="43.6,25.6 45.5,30.1 50,32 45.5,33.9 43.6,38.4 41.7,33.9 37.2,32 41.7,30.1" fill="#202229" />
            <polygon points="77.9,23.6 79.8,28.1 84.3,30 79.8,31.9 77.9,36.4 76,31.9 71.5,30 76,28.1" fill="#202229" />
            <path d="M60 53 C 50 45, 34 45, 26 52 L 26 88 C 34 79, 50 79, 60 88 Z" fill="#F2C96D" stroke="#202229" strokeWidth="6" strokeLinejoin="round" />
            <path d="M60 53 C 70 45, 86 45, 94 52 L 94 88 C 86 79, 70 79, 60 88 Z" fill="#F2C96D" stroke="#202229" strokeWidth="6" strokeLinejoin="round" />
            <line x1="60" y1="53" x2="60" y2="88" stroke="#202229" strokeWidth="5" />
          </svg>
        </div>
        <div className="name">慧读圣经 后台</div>
      </div>

      <nav className="admin-nav">
        {SCOPE_ORDER.map((scope) => {
          const items = visibleItems.filter((item) => item.scope === scope);
          if (items.length === 0) return null;
          return (
            <div className="admin-nav-group" key={scope}>
              <div className="admin-nav-group-label">{SCOPE_LABEL[scope]}</div>
              {items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`admin-nav-item${pathname === item.href ? " active" : ""}`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          );
        })}
      </nav>

      <div style={{ flex: 1 }} />

      <div className="operator" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <div className="avatar" style={{ flexShrink: 0 }}>运</div>
          <span style={{ fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{operatorName}</span>
        </div>
        {/* 退出登录（来自 ob-cn 线上分支的独有功能，合并时移植保留） */}
        <button
          type="button"
          onClick={() => {
            if (window.confirm("确定要退出登录吗？")) {
              void signOut({ callbackUrl: "/admin/login" });
            }
          }}
          style={{
            border: 0,
            background: "rgba(225,49,125,.11)",
            color: "var(--pink, #e1317d)",
            cursor: "pointer",
            fontSize: 11,
            fontWeight: 800,
            padding: "4px 8px",
            borderRadius: 6,
            flexShrink: 0,
          }}
        >
          退出
        </button>
      </div>
    </div>
  );
}
