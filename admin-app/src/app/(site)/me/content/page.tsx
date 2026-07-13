import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/current-user";

const TRANSLATION = "和合本";

const TABS = [
  { key: "highlights", label: "高亮" },
  { key: "notes", label: "笔记" },
  { key: "huidu", label: "慧读" },
  { key: "posts", label: "帖子" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function fmt(d: Date) {
  return d.toISOString().slice(0, 16).replace("T", " ");
}

export default async function MyContentPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab: tabParam } = await searchParams;
  const user = await requireUser();
  const tab: TabKey = TABS.some((t) => t.key === tabParam) ? (tabParam as TabKey) : "notes";

  const [highlights, notes, conversations, posts] = await Promise.all([
    db.highlight.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
    db.note.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
    db.conversation.findMany({
      where: { userId: user.id },
      include: { _count: { select: { messages: true } } },
      orderBy: { createdAt: "desc" },
    }),
    db.post.findMany({
      where: { authorId: user.id, status: "VISIBLE" },
      include: { community: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  // Verse text lookups for the highlight list + yellow ref-chips on notes.
  const highlightVerses = await Promise.all(
    highlights.map((h) =>
      db.verse.findUnique({
        where: { translation_book_chapter_verse: { translation: TRANSLATION, book: h.book, chapter: h.chapter, verse: h.verse } },
      })
    )
  );
  const highlightedSet = new Set(highlights.map((h) => `${h.book} ${h.chapter}:${h.verse}`));

  const counts: Record<TabKey, number> = {
    highlights: highlights.length,
    notes: notes.length,
    huidu: conversations.length,
    posts: posts.length,
  };

  const refChip = (ref: string) => (
    <div style={{
      display: "inline-block", fontSize: 11, fontWeight: 800, borderRadius: 6, padding: "2px 8px",
      background: highlightedSet.has(ref) ? "var(--yellow)" : "var(--surface-2)",
    }}>
      {ref}
    </div>
  );

  return (
    <div style={{ flex: 1, overflow: "auto", padding: "24px 28px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <Link href="/me" className="icon-btn" style={{ width: 40, height: 40, textDecoration: "none" }}>‹</Link>
          <div style={{ fontSize: 17, fontWeight: 800 }}>我的内容</div>
          <div style={{ flex: 1 }} />
          <a
            href="/me/content/export"
            style={{ display: "flex", alignItems: "center", gap: 6, height: 36, padding: "0 14px", background: "var(--white)", border: "1px solid var(--line)", borderRadius: 100, boxShadow: "var(--shadow-card)", fontSize: 12, fontWeight: 700, color: "var(--ink)" }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
              <polyline points="16 6 12 2 8 6" /><line x1="12" y1="2" x2="12" y2="15" />
            </svg>
            导出笔记
          </a>
        </div>

        {/* tabs */}
        <div style={{ display: "flex", background: "var(--surface-2)", borderRadius: 100, padding: 3, marginBottom: 14 }}>
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={`/me/content?tab=${t.key}`}
              style={{
                flex: 1, display: "flex", alignItems: "center", justifyContent: "center", height: 32,
                borderRadius: 100, fontSize: 12,
                fontWeight: tab === t.key ? 700 : 600,
                color: tab === t.key ? "var(--ink)" : "var(--body)",
                background: tab === t.key ? "var(--white)" : "transparent",
                boxShadow: tab === t.key ? "var(--shadow-card)" : "none",
              }}
            >
              {t.label}
            </Link>
          ))}
        </div>

        {/* filter row */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, height: 32, padding: "0 12px", background: "var(--white)", border: "1px solid var(--line)", borderRadius: 100, fontSize: 12, fontWeight: 700 }}>约翰福音</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, height: 32, padding: "0 12px", background: "var(--white)", border: "1px solid var(--line)", borderRadius: 100, fontSize: 12, fontWeight: 700 }}>最近优先</div>
          <div style={{ flex: 1 }} />
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--body)" }}>共 {counts[tab]} 条</div>
        </div>

        {/* lists */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {tab === "highlights" && highlights.map((h, i) => {
            const verse = highlightVerses[i];
            return (
              <Link key={h.id} href={`/bible?c=${h.chapter}&v=${h.verse}`} className="card" style={{ padding: "14px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <div style={{ width: 14, height: 14, background: h.color, border: "1px solid var(--line)", borderRadius: 4 }} />
                  <div style={{ fontSize: 11, fontWeight: 800 }}>{h.book} {h.chapter}:{h.verse}</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--body)" }}>{fmt(h.createdAt)}</div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.7 }}>{verse?.text ?? "（经文未找到）"}</div>
              </Link>
            );
          })}

          {tab === "notes" && notes.map((n) => (
            <Link key={n.id} href={`/bible?c=${n.chapter}&v=${n.verse}`} className="card" style={{ padding: "14px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                {refChip(`${n.book} ${n.chapter}:${n.verse}`)}
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--body)" }}>{fmt(n.createdAt)}</div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.7 }}>{n.content}</div>
            </Link>
          ))}

          {tab === "huidu" && conversations.map((c) => (
            <Link key={c.id} href={`/huidu/${c.id}`} className="card" style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                  {refChip(c.verseRefLabel)}
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--body)" }}>{Math.ceil(c._count.messages / 2)} 轮 · {fmt(c.createdAt)}</div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.5 }}>{c.title}</div>
              </div>
              <div style={{ color: "var(--body)" }}>›</div>
            </Link>
          ))}

          {tab === "posts" && posts.map((p) => (
            <Link key={p.id} href={`/community/${p.communityId}`} className="card" style={{ padding: "14px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <div style={{ fontSize: 11, fontWeight: 800, background: "var(--surface-2)", borderRadius: 6, padding: "2px 8px" }}>{p.community.name}</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--body)" }}>{fmt(p.createdAt)} · 赞 {p.likeCount}</div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.7 }}>{p.content}</div>
            </Link>
          ))}

          {counts[tab] === 0 && (
            <div style={{ textAlign: "center", fontSize: 12, color: "var(--body)", padding: "24px 0" }}>
              {tab === "highlights" && "还没有高亮。去读经页点选经文即可添加。"}
              {tab === "notes" && "还没有笔记。去读经页点选经文即可添加。"}
              {tab === "huidu" && "还没有慧读记录。"}
              {tab === "posts" && "还没有发过帖子。"}
            </div>
          )}
        </div>

        <div style={{ textAlign: "center", fontSize: 10, fontWeight: 600, color: "var(--body)", padding: "16px 12px 0" }}>导出内容将附带经文引用出处</div>
      </div>
    </div>
  );
}
