"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

type Role = "SUPER_ADMIN" | "MODERATOR";

type Scope = "shared" | "app" | "web";

// 后台按「这块内容归哪一端用」分组：
//   共用   —— 两端读写同一份数据（笔记、高亮已互通）
//   App 端 —— 网页版没有对应功能（网页版无社群，也就没有群活动）
//   网页版 —— App 没有对应入口（百科 / 影音 / 灵修）
const SCOPE_LABEL: Record<Scope, string> = {
  shared: "两端共用",
  app: "App 端",
  web: "网页版",
};

const NAV_ITEMS: { href: string; label: string; roles: Role[]; scope: Scope }[] = [
  { href: "/admin/dashboard", label: "数据看板", roles: ["SUPER_ADMIN", "MODERATOR"], scope: "shared" },
  { href: "/admin/users", label: "用户管理", roles: ["SUPER_ADMIN", "MODERATOR"], scope: "shared" },
  { href: "/admin/content", label: "内容管理", roles: ["SUPER_ADMIN", "MODERATOR"], scope: "shared" },
  { href: "/admin/commentary", label: "注释校对", roles: ["SUPER_ADMIN", "MODERATOR"], scope: "shared" },
  { href: "/admin/annotations", label: "用户标注", roles: ["SUPER_ADMIN", "MODERATOR"], scope: "shared" },
  { href: "/admin/moderation", label: "内容审核", roles: ["SUPER_ADMIN", "MODERATOR"], scope: "shared" },
  { href: "/admin/ai", label: "AI 模型与提示词", roles: ["SUPER_ADMIN"], scope: "shared" },
  { href: "/admin/audit", label: "权限与审计", roles: ["SUPER_ADMIN"], scope: "shared" },

  { href: "/admin/communities", label: "社群管理", roles: ["SUPER_ADMIN", "MODERATOR"], scope: "app" },
  { href: "/admin/events", label: "活动监管", roles: ["SUPER_ADMIN", "MODERATOR"], scope: "app" },
  { href: "/admin/share-cards", label: "分享模板", roles: ["SUPER_ADMIN", "MODERATOR"], scope: "app" },
  { href: "/admin/audio-cache", label: "音频缓存", roles: ["SUPER_ADMIN"], scope: "app" },

  { href: "/admin/study-notes", label: "研经笔记", roles: ["SUPER_ADMIN", "MODERATOR"], scope: "web" },
  { href: "/admin/encyclopedia", label: "圣经百科", roles: ["SUPER_ADMIN", "MODERATOR"], scope: "web" },
  { href: "/admin/media", label: "影音库", roles: ["SUPER_ADMIN", "MODERATOR"], scope: "web" },
  { href: "/admin/spiritual", label: "灵修引导", roles: ["SUPER_ADMIN", "MODERATOR"], scope: "web" },
];

const SCOPE_ORDER: Scope[] = ["shared", "app", "web"];

export function AdminSidebar({ operatorName, role }: { operatorName: string; role?: string }) {
  const pathname = usePathname();
  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(role as Role));

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
            flexShrink: 0
          }}
          title="退出登录"
        >
          退出
        </button>
      </div>
    </div>
  );
}
