import type { ReactNode } from "react";

// 空状态插画：与产品气质一致的线描母题（星芒、圣经、铃铛、书签、爱心）。
// 线条用第三级文字色，点缀用金/紫主题色——三种主题下都成立，不放写死的颜色。
const ART: Record<string, ReactNode> = {
  prayer: (
    <>
      <path className="art-soft" d="M48 67C35 56.5 26 48.5 26 38.5 26 30.5 32 25 39.5 25c3.9 0 7 2.2 8.5 4.6C49.5 27.2 52.6 25 56.5 25 64 25 70 30.5 70 38.5c0 10-9 18-22 28.5Z" />
      <path d="M48 67C35 56.5 26 48.5 26 38.5 26 30.5 32 25 39.5 25c3.9 0 7 2.2 8.5 4.6C49.5 27.2 52.6 25 56.5 25 64 25 70 30.5 70 38.5c0 10-9 18-22 28.5Z" />
      <path d="M48 17v-6M31 20l-4-4.5M65 20l4-4.5" />
      <path className="art-accent" d="M73 56l1.5 3.6 3.6 1.5-3.6 1.5L73 66.2l-1.5-3.6-3.6-1.5 3.6-1.5Z" stroke="none" />
    </>
  ),
  activity: (
    <>
      <rect className="art-soft" x="24" y="28" width="48" height="44" rx="9" />
      <rect x="24" y="28" width="48" height="44" rx="9" fill="none" />
      <path d="M24 42h48M36 21v11M60 21v11" />
      <path className="art-accent" d="M48 49l2.3 5.3 5.7.6-4.3 3.8 1.2 5.6-4.9-2.9-4.9 2.9 1.2-5.6-4.3-3.8 5.7-.6Z" stroke="none" />
    </>
  ),
  inbox: (
    <>
      <path className="art-soft" d="M48 25c-10 0-14.5 7.8-14.5 19 0 7.5-2.3 11.9-5.5 15h40c-3.2-3.1-5.5-7.5-5.5-15 0-11.2-4.5-19-14.5-19Z" />
      <path d="M48 25c-10 0-14.5 7.8-14.5 19 0 7.5-2.3 11.9-5.5 15h40c-3.2-3.1-5.5-7.5-5.5-15 0-11.2-4.5-19-14.5-19Z" />
      <path d="M43 66c.8 3 2.5 4.6 5 4.6s4.2-1.6 5-4.6" />
      <circle className="art-purple" cx="63" cy="26" r="6" stroke="none" />
    </>
  ),
  huidu: (
    <>
      <path className="art-soft" d="M44 22c1.6 11.6 7.4 17.4 19 19-11.6 1.6-17.4 7.4-19 19-1.6-11.6-7.4-17.4-19-19 11.6-1.6 17.4-7.4 19-19Z" />
      <path d="M44 22c1.6 11.6 7.4 17.4 19 19-11.6 1.6-17.4 7.4-19 19-1.6-11.6-7.4-17.4-19-19 11.6-1.6 17.4-7.4 19-19Z" />
      <path className="art-accent" d="M67 55c.8 4.6 3.4 7.2 8 8-4.6.8-7.2 3.4-8 8-.8-4.6-3.4-7.2-8-8 4.6-.8 7.2-3.4 8-8Z" stroke="none" />
    </>
  ),
  content: (
    <>
      <path className="art-soft" d="M34 22h28v50L48 60.5 34 72V22Z" />
      <path d="M34 22h28v50L48 60.5 34 72V22Z" />
      <path d="M41 33h14M41 42h10" />
      <path className="art-accent" d="M70 30l1.5 3.6 3.6 1.5-3.6 1.5L70 40.2l-1.5-3.6-3.6-1.5 3.6-1.5Z" stroke="none" />
    </>
  ),
  search: (
    <>
      <circle className="art-soft" cx="44" cy="42" r="17" />
      <circle cx="44" cy="42" r="17" fill="none" />
      <path d="M57 55 68 66" />
      <path d="M37 42c0-4 3-7 7-7" />
    </>
  ),
};

export function EmptyState({
  art,
  title,
  desc,
  action,
  compact = false,
}: {
  art: keyof typeof ART & string;
  title: string;
  desc?: string;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={`empty-state${compact ? " is-compact" : ""}`} role="status">
      <svg viewBox="0 0 96 96" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        {ART[art]}
      </svg>
      <b>{title}</b>
      {desc && <p>{desc}</p>}
      {action}
    </div>
  );
}
