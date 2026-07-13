"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/bible", label: "圣经" },
  { href: "/annotations", label: "注释" },
  { href: "/huidu", label: "慧读" },
  { href: "/community", label: "社群" },
  { href: "/me", label: "我的" },
];

function isActive(pathname: string, href: string) {
  if (href === "/community") return pathname === "/" || pathname.startsWith("/community");
  return pathname.startsWith(href);
}

export function SiteNav() {
  const pathname = usePathname();

  return (
    <nav className="site-nav">
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`site-nav-item${isActive(pathname, item.href) ? " active" : ""}`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
