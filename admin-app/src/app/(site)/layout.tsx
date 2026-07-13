import { Suspense } from "react";
import { getCurrentUser } from "@/lib/current-user";
import { SiteNav } from "@/components/site/SiteNav";
import { ReadingControls } from "@/components/site/ReadingControls";

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

        <SiteNav />

        <div style={{ flex: 1 }} />

        <Suspense fallback={null}>
          <ReadingControls />
        </Suspense>

        <div className="site-avatar" title={user.name}>{user.name.slice(0, 1)}</div>
      </div>

      <div className="site-main">{children}</div>
    </div>
  );
}
