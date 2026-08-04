"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

type Role = "SUPER_ADMIN" | "MODERATOR";

const NAV_ITEMS: { href: string; label: string; roles: Role[] }[] = [
  { href: "/admin/dashboard", label: "数据看板", roles: ["SUPER_ADMIN", "MODERATOR"] },
  { href: "/admin/content", label: "内容管理", roles: ["SUPER_ADMIN", "MODERATOR"] },
  { href: "/admin/share-cards", label: "分享模板", roles: ["SUPER_ADMIN", "MODERATOR"] },
  { href: "/admin/ai", label: "AI 模型与提示词", roles: ["SUPER_ADMIN"] },
  { href: "/admin/communities", label: "社群管理", roles: ["SUPER_ADMIN", "MODERATOR"] },
  { href: "/admin/users", label: "用户管理", roles: ["SUPER_ADMIN", "MODERATOR"] },
  { href: "/admin/annotations", label: "用户标注", roles: ["SUPER_ADMIN", "MODERATOR"] },
  { href: "/admin/moderation", label: "内容审核", roles: ["SUPER_ADMIN", "MODERATOR"] },
  { href: "/admin/events", label: "活动监管", roles: ["SUPER_ADMIN", "MODERATOR"] },
  { href: "/admin/audit", label: "权限与审计", roles: ["SUPER_ADMIN"] },
];

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
        {visibleItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`admin-nav-item${pathname === item.href ? " active" : ""}`}
          >
            {item.label}
          </Link>
        ))}
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
            color: "var(--pink)",
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
