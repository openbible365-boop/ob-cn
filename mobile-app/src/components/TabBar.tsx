import { NavLink } from "react-router-dom";
import { TabIcon, type TabIconName } from "./TabIcon";

const TABS: Array<{ to: string; label: string; icon: TabIconName }> = [
  { to: "/bible", label: "圣经", icon: "bible" },
  { to: "/annotations", label: "注释", icon: "annotations" },
  { to: "/huidu", label: "慧读", icon: "huidu" },
  { to: "/community", label: "社群", icon: "community" },
  { to: "/me", label: "我的", icon: "me" },
];

export function TabBar({ hidden = false }: { hidden?: boolean }) {
  return (
    <nav className={`tab-bar${hidden ? " is-hidden" : ""}`} aria-label="主导航" aria-hidden={hidden || undefined}>
      {TABS.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          tabIndex={hidden ? -1 : undefined}
          className={({ isActive }) => `tab${isActive ? " active" : ""}`}
        >
          {({ isActive }) => (
            <>
              <span className={`tab-icon tab-icon-${t.icon}`}>
                <TabIcon name={t.icon} active={isActive} />
              </span>
              <span className="tab-label">{t.label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
