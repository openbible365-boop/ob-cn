"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#18191F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
          </svg>
        </div>
        <div className="name">OpenBible 后台</div>
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

      <div className="operator">
        <div className="avatar">运</div>
        {operatorName}
      </div>
    </div>
  );
}
