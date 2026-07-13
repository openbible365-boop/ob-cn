import { NavLink } from "react-router-dom";
import { Icon } from "./Icon";

const TABS = [
  { to: "/bible", label: "圣经", icon: "book" },
  { to: "/annotations", label: "注释", icon: "message-square" },
  { to: "/huidu", label: "慧读", icon: "sparkle" },
  { to: "/community", label: "社群", icon: "users" },
  { to: "/me", label: "我的", icon: "user" },
];

export function TabBar() {
  return (
    <nav className="tab-bar">
      {TABS.map((t) => (
        <NavLink key={t.to} to={t.to} className={({ isActive }) => `tab${isActive ? " active" : ""}`}>
          <div className="tab-icon">
            <Icon name={t.icon} size={19} />
          </div>
          <div className="tab-label">{t.label}</div>
        </NavLink>
      ))}
    </nav>
  );
}
