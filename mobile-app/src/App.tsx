import { initializePushNotifications, syncStoredPushToken } from "./data/push";
import { lazy, Suspense, useEffect, useState, type ComponentType, type ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { TabBar } from "./components/TabBar";
import { SkeletonScreen } from "./components/SkeletonScreen";
// 首页路由同步加载，保证冷启动直达经文；其余页面按路由分包，
// 繁体词典、二维码等重依赖也随各自页面延后加载。
import { BiblePage } from "./pages/BiblePage";

const lazyPage = <K extends string>(
  loader: () => Promise<Record<K, ComponentType>>,
  name: K,
) => lazy(() => loader().then((m) => ({ default: m[name] })));

const AnnotationsPage = lazyPage(() => import("./pages/AnnotationsPage"), "AnnotationsPage");
const HuiduHomePage = lazyPage(() => import("./pages/HuiduHomePage"), "HuiduHomePage");
const HuiduChatPage = lazyPage(() => import("./pages/HuiduChatPage"), "HuiduChatPage");
const CommunityPage = lazyPage(() => import("./pages/CommunityPage"), "CommunityPage");
const GroupPage = lazyPage(() => import("./pages/GroupPage"), "GroupPage");
const CreateGroupPage = lazyPage(() => import("./pages/CreateGroupPage"), "CreateGroupPage");
const GroupSettingsPage = lazyPage(() => import("./pages/GroupSettingsPage"), "GroupSettingsPage");
const MePage = lazyPage(() => import("./pages/MePage"), "MePage");
const MyContentPage = lazyPage(() => import("./pages/MyContentPage"), "MyContentPage");
const NotificationsPage = lazyPage(() => import("./pages/NotificationsPage"), "NotificationsPage");
const MyActivitiesPage = lazyPage(() => import("./pages/MyActivitiesPage"), "MyActivitiesPage");
const AccountDataPage = lazyPage(() => import("./pages/AccountDataPage"), "AccountDataPage");
const ResourcesPage = lazyPage(() => import("./pages/ResourcesPage"), "ResourcesPage");
const PrayerListPage = lazyPage(() => import("./pages/PrayerListPage"), "PrayerListPage");
const ReadingPlansPage = lazyPage(() => import("./pages/ReadingPlansPage"), "ReadingPlansPage");
const LoginPage = lazyPage(() => import("./pages/LoginPage"), "LoginPage");
const LegalPage = lazyPage(() => import("./pages/LegalPage"), "LegalPage");
import { setupAndroidBackButton } from "./native/android-back";
import { syncHighlights, syncNotes } from "./data/annotations";
import { syncConversations } from "./data/huidu";
import { fetchMe } from "./data/profile";

function RequireLogin({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchMe().then((user) => { if (!cancelled) setAllowed(Boolean(user)); });
    return () => { cancelled = true; };
  }, []);

  if (allowed === null) return <SkeletonScreen label="正在确认账号" />;
  if (!allowed) return <Navigate to="/me/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}

// The five top-level tabs keep the tab bar; drill-in pages go full screen.
const TAB_PATHS = ["/bible", "/annotations", "/huidu", "/community", "/me"];
const AUTO_HIDE_TAB_PATHS = ["/bible", "/annotations"];

export default function App() {
  const { pathname } = useLocation();
  useEffect(() => { void initializePushNotifications(false); }, []);
  useEffect(() => { void syncStoredPushToken(); }, [pathname]);
  const showTabBar = TAB_PATHS.includes(pathname);
  const [isTabBarVisible, setIsTabBarVisible] = useState(true);

  useEffect(() => {
    void syncHighlights();
    void syncNotes();
    void syncConversations();
    setupAndroidBackButton({
      // 从 hash 现读路径：监听器只注册一次，不能闭包住某一次渲染的 pathname
      isAtTabRoot: () => TAB_PATHS.includes(window.location.hash.replace(/^#/, "").split("?")[0]),
      goBack: () => window.history.back(),
    });
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const viewport = window.visualViewport;
    let frame = 0;

    const syncVisibleViewport = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const height = viewport?.height ?? window.innerHeight;
        const offsetTop = viewport?.offsetTop ?? 0;
        root.style.setProperty("--app-viewport-height", `${Math.round(height)}px`);
        root.style.setProperty("--app-viewport-offset-top", `${Math.round(offsetTop)}px`);
      });
    };

    syncVisibleViewport();
    window.addEventListener("resize", syncVisibleViewport);
    viewport?.addEventListener("resize", syncVisibleViewport);
    viewport?.addEventListener("scroll", syncVisibleViewport);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", syncVisibleViewport);
      viewport?.removeEventListener("resize", syncVisibleViewport);
      viewport?.removeEventListener("scroll", syncVisibleViewport);
      root.style.removeProperty("--app-viewport-height");
      root.style.removeProperty("--app-viewport-offset-top");
    };
  }, []);

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
      <Suspense fallback={<SkeletonScreen label="正在打开页面" />}>
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
        <Route path="/me/activities" element={<RequireLogin><MyActivitiesPage /></RequireLogin>} />
        <Route path="/me/account" element={<RequireLogin><AccountDataPage /></RequireLogin>} />
        {/* 译本下载是设备级功能，不要求登录 */}
        <Route path="/me/resources" element={<ResourcesPage />} />
        {/* 祷告清单：本机数据，不要求登录 */}
        <Route path="/me/prayers" element={<PrayerListPage />} />
        <Route path="/me/plans" element={<RequireLogin><ReadingPlansPage /></RequireLogin>} />
        <Route path="*" element={<Navigate to="/bible" replace />} />
      </Routes>
      </Suspense>
      {showTabBar && <TabBar hidden={!isTabBarVisible} />}
    </div>
  );
}
