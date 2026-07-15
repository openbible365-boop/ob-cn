import { useEffect, useState } from "react";
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

// The five top-level tabs keep the tab bar; drill-in pages go full screen.
const TAB_PATHS = ["/bible", "/annotations", "/huidu", "/community", "/me"];
const AUTO_HIDE_TAB_PATHS = ["/bible", "/annotations"];

export default function App() {
  const { pathname } = useLocation();
  const showTabBar = TAB_PATHS.includes(pathname);
  const [isTabBarVisible, setIsTabBarVisible] = useState(true);

  useEffect(() => {
    setIsTabBarVisible(true);

    if (!showTabBar || !AUTO_HIDE_TAB_PATHS.includes(pathname)) return;

    const scrollContainer = document.querySelector<HTMLElement>(".screen-scroll");
    if (!scrollContainer) return;

    const updateTabBarVisibility = () => {
      setIsTabBarVisible(scrollContainer.scrollTop <= 4);
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
        <Route path="/community/new" element={<CreateGroupPage />} />
        <Route path="/community/:groupId" element={<GroupPage />} />
        <Route path="/community/:groupId/settings" element={<GroupSettingsPage />} />
        <Route path="/me" element={<MePage />} />
        <Route path="/me/login" element={<LoginPage />} />
        <Route path="/me/content" element={<MyContentPage />} />
        <Route path="/me/notifications" element={<NotificationsPage />} />
        <Route path="*" element={<Navigate to="/bible" replace />} />
      </Routes>
      {showTabBar && <TabBar hidden={!isTabBarVisible} />}
    </div>
  );
}
