import Link from "next/link";
import { Suspense } from "react";
import { getSessionUser } from "@/lib/current-user";
import { SiteNav } from "@/components/site/SiteNav";
import { ReadingControls } from "@/components/site/ReadingControls";

export default async function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();

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

        <SiteNav />

        <div style={{ flex: 1 }} />

        <Suspense fallback={null}>
          <ReadingControls />
        </Suspense>

        {user ? (
          <Link href="/me" className="site-avatar" title={user.name} style={{ textDecoration: "none" }}>
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt="" referrerPolicy="no-referrer" />
            ) : (
              user.name.slice(0, 1)
            )}
          </Link>
        ) : (
          <Link
            href="/me"
            style={{
              display: "flex", alignItems: "center", height: 36, padding: "0 16px",
              background: "var(--purple)", borderRadius: 100, color: "#fff",
              fontSize: 13, fontWeight: 800, boxShadow: "var(--shadow-card)",
            }}
          >
            登录
          </Link>
        )}
      </div>

      <div className="site-main">{children}</div>
    </div>
  );
}
