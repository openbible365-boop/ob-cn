"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/dashboard", label: "数据看板", disabled: true },
  { href: "/content", label: "内容管理", disabled: true },
  { href: "/ai", label: "AI 模型与提示词", disabled: true },
  { href: "/communities", label: "社群管理" },
  { href: "/users", label: "用户管理" },
  { href: "/moderation", label: "内容审核", disabled: true },
  { href: "/events", label: "活动监管", disabled: true },
  { href: "/audit", label: "权限与审计", disabled: true },
];

export function AdminSidebar({ operatorName }: { operatorName: string }) {
  const pathname = usePathname();

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
        {NAV_ITEMS.map((item) =>
          item.disabled ? (
            <div key={item.href} className="admin-nav-item disabled">
              {item.label}
            </div>
          ) : (
            <Link
              key={item.href}
              href={item.href}
              className={`admin-nav-item${pathname === item.href ? " active" : ""}`}
            >
              {item.label}
            </Link>
          )
        )}
      </nav>

      <div style={{ flex: 1 }} />

      <div className="operator">
        <div className="avatar">运</div>
        {operatorName}
      </div>
    </div>
  );
}
