import { getCurrentUser } from "@/lib/current-user";

const NAV_ITEMS = [
  { href: "/bible", label: "圣经", disabled: true },
  { href: "/annotations", label: "注释", disabled: true },
  { href: "/huidu", label: "慧读", disabled: true },
  { href: "/community", label: "社群" },
  { href: "/me", label: "我的", disabled: true },
];

export default async function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  return (
    <div className="site-shell">
      <div className="site-topbar">
        <div className="brand">
          <div className="mark">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#18191F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
            </svg>
          </div>
          <div className="name">OpenBible</div>
        </div>

        <nav className="site-nav">
          {NAV_ITEMS.map((item) =>
            item.disabled ? (
              <span key={item.href} className="site-nav-item disabled" title="即将上线">
                {item.label}
              </span>
            ) : (
              <a key={item.href} href={item.href} className="site-nav-item active">
                {item.label}
              </a>
            )
          )}
        </nav>

        <div style={{ flex: 1 }} />

        <div className="site-avatar" title={user.name}>{user.name.slice(0, 1)}</div>
      </div>

      <div className="site-main">{children}</div>
    </div>
  );
}
