"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const NAV_ITEMS = [
  { href: "/bible", label: "圣经" },
  { href: "/annotations", label: "注释" },
  { href: "/huidu", label: "慧读" },
  { href: "/community", label: "社群" },
  { href: "/me", label: "我的" },
];

// Reading tabs share the translation/book/chapter context.
const READING_TABS = new Set(["/bible", "/annotations"]);

function isActive(pathname: string, href: string) {
  if (href === "/community") return pathname === "/" || pathname.startsWith("/community");
  return pathname.startsWith(href);
}

export function SiteNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Carry the current reading position (t/b/c, not the selected verse) across
  // 圣经 ↔ 注释 so switching tabs stays on the same book & chapter.
  const readingQuery = (() => {
    if (!READING_TABS.has(pathname)) return "";
    const carried = new URLSearchParams();
    for (const key of ["t", "b", "c"]) {
      const value = searchParams.get(key);
      if (value) carried.set(key, value);
    }
    const s = carried.toString();
    return s ? `?${s}` : "";
  })();

  return (
    <nav className="site-nav">
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.href}
          href={READING_TABS.has(item.href) ? `${item.href}${readingQuery}` : item.href}
          className={`site-nav-item${isActive(pathname, item.href) ? " active" : ""}`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
