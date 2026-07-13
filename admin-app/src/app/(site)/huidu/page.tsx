import Link from "next/link";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";

function isSameDay(a: Date, b: Date) {
  return a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10);
}

export default async function HuiduHomePage() {
  const user = await getCurrentUser();
  const conversations = await db.conversation.findMany({
    where: { userId: user.id },
    include: { _count: { select: { messages: true } } },
    orderBy: { createdAt: "desc" },
  });

  const now = new Date();
  const today = conversations.filter((c) => isSameDay(c.createdAt, now));
  const earlier = conversations.filter((c) => !isSameDay(c.createdAt, now));

  const renderItem = (c: (typeof conversations)[number]) => (
    <Link
      key={c.id}
      href={`/huidu/${c.id}`}
      style={{ display: "flex", alignItems: "center", gap: 12, background: "var(--white)", border: "1px solid var(--line)", borderRadius: 16, boxShadow: "var(--shadow-card)", padding: "14px 16px", marginBottom: 10 }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
          <div style={{ fontSize: 11, fontWeight: 800, background: "var(--yellow)", borderRadius: 6, padding: "2px 8px" }}>{c.verseRefLabel}</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--body)" }}>
            {Math.ceil(c._count.messages / 2)} 轮 · {c.createdAt.toISOString().slice(11, 16)}
          </div>
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.5 }}>{c.title}</div>
      </div>
      <div style={{ color: "var(--body)" }}>›</div>
    </Link>
  );

  return (
    <div style={{ flex: 1, overflow: "auto", padding: "24px 28px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
          <div style={{ fontSize: 20, fontWeight: 800 }}>慧读</div>
          <div style={{ flex: 1 }} />
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--body)" }}>今日剩余 12/20 次</div>
        </div>

        <Link
          href="/bible"
          style={{ display: "flex", alignItems: "center", gap: 14, background: "var(--purple)", borderRadius: 16, boxShadow: "var(--shadow-card)", padding: "18px 16px", marginBottom: 20 }}
        >
          <div style={{ flex: "none", display: "flex", alignItems: "center", justifyContent: "center", width: 44, height: 44, background: "rgba(255,255,255,.25)", borderRadius: 100, color: "#fff" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l2.2 6.3L20.5 12l-6.3 2.7L12 21l-2.2-6.3L3.5 12l6.3-2.7z" /><path d="M19 2v4" /><path d="M17 4h4" /></svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", marginBottom: 2 }}>开始新对话</div>
            <div style={{ fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,.85)" }}>在读经页划选经文，直达慧读</div>
          </div>
          <div style={{ color: "#fff" }}>›</div>
        </Link>

        {today.length > 0 && (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--body)", marginBottom: 10 }}>今天</div>
            {today.map(renderItem)}
          </>
        )}
        {earlier.length > 0 && (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--body)", margin: "8px 0 10px" }}>更早</div>
            {earlier.map(renderItem)}
          </>
        )}
        {conversations.length === 0 && (
          <div style={{ fontSize: 13, color: "var(--body)", padding: "8px 2px" }}>还没有慧读记录。在读经页点选一节经文，问慧读试试。</div>
        )}

        <div style={{ textAlign: "center", fontSize: 10, fontWeight: 600, color: "var(--body)", padding: "16px 12px 0" }}>AI 解释仅供参考，不替代教会教导与权威释经</div>
      </div>
    </div>
  );
}
