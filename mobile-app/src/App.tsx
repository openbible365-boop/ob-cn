import { useEffect, useState, type ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { TabBar } from "./components/TabBar";
import { BiblePage } from "./pages/BiblePage";
import { AnnotationsPage } from "./pages/AnnotationsPage";
import { HuiduHomePage } from "./pages/HuiduHomePage";
import { HuiduChatPage } from "./pages/HuiduChatPage";
import { CommunityPage } from "./pages/CommunityPage";
import { GroupPage } from "./pages/GroupPage";
import { CreateGroupPage } from "./pages/CreateGroupPage";
import { GroupSettingsPage } from "./pages/GroupSettingsPage";
import { MePage } from "./pages/MePage";
import { MyContentPage } from "./pages/MyContentPage";
import { NotificationsPage } from "./pages/NotificationsPage";
import { LoginPage } from "./pages/LoginPage";
import { LegalPage } from "./pages/LegalPage";
import { syncHighlights } from "./data/annotations";
import { fetchMe } from "./data/profile";

function RequireLogin({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchMe().then((user) => { if (!cancelled) setAllowed(Boolean(user)); });
    return () => { cancelled = true; };
  }, []);

  if (allowed === null) return <div className="route-status">正在确认账号…</div>;
  if (!allowed) return <Navigate to="/me/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}

// The five top-level tabs keep the tab bar; drill-in pages go full screen.
const TAB_PATHS = ["/bible", "/annotations", "/huidu", "/community", "/me"];
const AUTO_HIDE_TAB_PATHS = ["/bible", "/annotations"];

export default function App() {
  const { pathname } = useLocation();
  const showTabBar = TAB_PATHS.includes(pathname);
  const [isTabBarVisible, setIsTabBarVisible] = useState(true);

  useEffect(() => { void syncHighlights(); }, []);

  useEffect(() => {
    setIsTabBarVisible(true);

    if (!showTabBar || !AUTO_HIDE_TAB_PATHS.includes(pathname)) return;

    const scrollContainer = document.querySelector<HTMLElement>(".screen-scroll");
    if (!scrollContainer) return;

    let previousScrollTop = scrollContainer.scrollTop;
    const updateTabBarVisibility = () => {
      const nextScrollTop = scrollContainer.scrollTop;
      const delta = nextScrollTop - previousScrollTop;
      if (nextScrollTop <= 12 || delta < -4) setIsTabBarVisible(true);
      else if (delta > 4 && nextScrollTop > 64) setIsTabBarVisible(false);
      previousScrollTop = nextScrollTop;
    };

    updateTabBarVisibility();
    scrollContainer.addEventListener("scroll", updateTabBarVisibility, { passive: true });

    return () => scrollContainer.removeEventListener("scroll", updateTabBarVisibility);
  }, [pathname, showTabBar]);

  return (
    <div className={`app${showTabBar ? " has-tab-bar" : ""}`}>
      <Routes>
        <Route path="/" element={<Navigate to="/bible" replace />} />
        <Route path="/bible" element={<BiblePage />} />
        <Route path="/annotations" element={<AnnotationsPage />} />
        <Route path="/huidu" element={<HuiduHomePage />} />
        <Route path="/huidu/:conversationId" element={<HuiduChatPage />} />
        <Route path="/community" element={<CommunityPage />} />
        <Route path="/community/new" element={<RequireLogin><CreateGroupPage /></RequireLogin>} />
        <Route path="/community/:groupId" element={<GroupPage />} />
        <Route path="/community/:groupId/settings" element={<RequireLogin><GroupSettingsPage /></RequireLogin>} />
        <Route path="/me" element={<MePage />} />
        <Route path="/me/login" element={<LoginPage />} />
        <Route path="/legal/:type" element={<LegalPage />} />
        <Route path="/me/content" element={<MyContentPage />} />
        <Route path="/me/notifications" element={<NotificationsPage />} />
        <Route path="*" element={<Navigate to="/bible" replace />} />
      </Routes>
      {showTabBar && <TabBar hidden={!isTabBarVisible} />}
    </div>
  );
}
