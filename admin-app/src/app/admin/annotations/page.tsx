import { db } from "@/lib/db";
import { UserAvatar } from "@/components/UserAvatar";
import { deleteNote, deleteHighlight } from "@/lib/actions/content";
import Link from "next/link";
import type { Prisma } from "@/generated/prisma/client";

export default async function AnnotationsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tab?: string }>;
}) {
  const { q, tab = "highlights" } = await searchParams;

  // Global statistics
  const [totalHighlights, totalNotes, annotatingUsersCount] = await Promise.all([
    db.highlight.count(),
    db.note.count(),
    db.user.count({
      where: {
        OR: [
          { highlights: { some: {} } },
          { notes: { some: {} } },
        ],
      },
    }),
  ]);

  const fmtTime = (d: Date) =>
    d ? d.toISOString().slice(0, 16).replace("T", " ") : "";

  // Query records depending on tab
  let highlights: Prisma.HighlightGetPayload<{ include: { user: true } }>[] = [];
  let notes: Prisma.NoteGetPayload<{ include: { user: true } }>[] = [];

  if (tab === "highlights") {
    highlights = await db.highlight.findMany({
      where: q
        ? {
            OR: [
              { user: { name: { contains: q, mode: "insensitive" } } },
              { book: { contains: q, mode: "insensitive" } },
            ],
          }
        : undefined,
      include: { user: true },
      orderBy: { createdAt: "desc" },
    });
  } else {
    notes = await db.note.findMany({
      where: q
        ? {
            OR: [
              { user: { name: { contains: q, mode: "insensitive" } } },
              { book: { contains: q, mode: "insensitive" } },
              { content: { contains: q, mode: "insensitive" } },
            ],
          }
        : undefined,
      include: { user: true },
      orderBy: { createdAt: "desc" },
    });
  }

  return (
    <>
      <div className="admin-header">
        <div className="title">用户标注管理</div>
        <div className="meta">记录并统计所有登录用户的阅读标注数据</div>
        <div style={{ flex: 1 }} />
        <form className="search-box" action="/admin/annotations">
          <input type="hidden" name="tab" value={tab} />
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input name="q" placeholder={tab === "highlights" ? "搜索用户名 / 书卷" : "搜索用户名 / 书卷 / 笔记内容"} defaultValue={q ?? ""} />
        </form>
      </div>

      {/* Statistics Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16 }}>
        <div className="card" style={{ borderRadius: 16, padding: "14px 16px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--body)", marginBottom: 6 }}>高亮总数</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "var(--purple)" }}>{totalHighlights.toLocaleString()} <span style={{ fontSize: 12, fontWeight: 600, color: "var(--body)" }}>处</span></div>
        </div>
        <div className="card" style={{ borderRadius: 16, padding: "14px 16px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--body)", marginBottom: 6 }}>笔记总数</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "var(--orange)" }}>{totalNotes.toLocaleString()} <span style={{ fontSize: 12, fontWeight: 600, color: "var(--body)" }}>条</span></div>
        </div>
        <div className="card" style={{ borderRadius: 16, padding: "14px 16px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--body)", marginBottom: 6 }}>标注活跃用户</div>
          <div style={{ fontSize: 24, fontWeight: 800 }}>{annotatingUsersCount.toLocaleString()} <span style={{ fontSize: 12, fontWeight: 600, color: "var(--body)" }}>人</span></div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <Link href={`/admin/annotations?tab=highlights${q ? `&q=${q}` : ""}`} style={{
          padding: "8px 18px",
          background: tab === "highlights" ? "var(--ink)" : "var(--white)",
          color: tab === "highlights" ? "var(--yellow)" : "var(--body)",
          border: "1px solid var(--line)",
          borderRadius: 100,
          fontSize: 12,
          fontWeight: 800,
          boxShadow: "var(--shadow-card)",
        }}>
          高亮记录 ({tab === "highlights" ? highlights.length : totalHighlights})
        </Link>
        <Link href={`/admin/annotations?tab=notes${q ? `&q=${q}` : ""}`} style={{
          padding: "8px 18px",
          background: tab === "notes" ? "var(--ink)" : "var(--white)",
          color: tab === "notes" ? "var(--yellow)" : "var(--body)",
          border: "1px solid var(--line)",
          borderRadius: 100,
          fontSize: 12,
          fontWeight: 800,
          boxShadow: "var(--shadow-card)",
        }}>
          笔记记录 ({tab === "notes" ? notes.length : totalNotes})
        </Link>
      </div>

      {/* Table Container */}
      <div className="card" style={{ flex: 1, borderRadius: "16px 16px 0 0", padding: "16px 18px", overflow: "auto" }}>
        {tab === "highlights" ? (
          <>
            <div className="admin-table-head" style={{ gridTemplateColumns: "1.4fr 1.2fr 1fr 1.2fr 150px" }}>
              <div>用户</div><div>经文位置</div><div>高亮颜色</div><div>标注时间</div><div>操作</div>
            </div>
            {highlights.map((h) => (
              <div key={h.id} className="admin-table-row" style={{ gridTemplateColumns: "1.4fr 1.2fr 1fr 1.2fr 150px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <UserAvatar name={h.user.name} avatarColor={h.user.avatarColor} avatarUrl={h.user.avatarUrl} />
                  <div>
                    <div style={{ fontWeight: 700 }}>{h.user.name}</div>
                    <div style={{ fontSize: 10, color: "var(--body)" }}>UID {h.user.uid}</div>
                  </div>
                </div>
                <div style={{ fontWeight: 700 }}>{h.book.toUpperCase()} {h.chapter}:{h.verse}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 16, height: 16, borderRadius: "50%", background: h.color, border: "1px solid var(--line)" }} />
                  <span style={{ fontSize: 11, fontWeight: 600, color: "var(--body)" }}>{h.color}</span>
                </div>
                <div style={{ fontWeight: 600, color: "var(--body)" }}>{fmtTime(h.createdAt)}</div>
                <div className="row-actions">
                  <form action={deleteHighlight}>
                    <input type="hidden" name="highlightId" value={h.id} />
                    <button type="submit" className="action-pink">清除高亮</button>
                  </form>
                </div>
              </div>
            ))}
            {highlights.length === 0 && (
              <div style={{ padding: "48px 16px", textAlign: "center", color: "var(--body)", fontWeight: 600 }}>
                没有找到对应的高亮记录
              </div>
            )}
          </>
        ) : (
          <>
            <div className="admin-table-head" style={{ gridTemplateColumns: "1.4fr 1.2fr 2.4fr 1.2fr 120px" }}>
              <div>用户</div><div>经文位置</div><div>笔记内容</div><div>记录时间</div><div>操作</div>
            </div>
            {notes.map((n) => (
              <div key={n.id} className="admin-table-row" style={{ gridTemplateColumns: "1.4fr 1.2fr 2.4fr 1.2fr 120px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <UserAvatar name={n.user.name} avatarColor={n.user.avatarColor} avatarUrl={n.user.avatarUrl} />
                  <div>
                    <div style={{ fontWeight: 700 }}>{n.user.name}</div>
                    <div style={{ fontSize: 10, color: "var(--body)" }}>UID {n.user.uid}</div>
                  </div>
                </div>
                <div style={{ fontWeight: 700 }}>{n.book.toUpperCase()} {n.chapter}:{n.verse}</div>
                <div style={{ fontWeight: 500, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={n.content}>
                  {n.content}
                </div>
                <div style={{ fontWeight: 600, color: "var(--body)" }}>{fmtTime(n.createdAt)}</div>
                <div className="row-actions">
                  <form action={deleteNote}>
                    <input type="hidden" name="noteId" value={n.id} />
                    <button type="submit" className="action-pink">删除笔记</button>
                  </form>
                </div>
              </div>
            ))}
            {notes.length === 0 && (
              <div style={{ padding: "48px 16px", textAlign: "center", color: "var(--body)", fontWeight: 600 }}>
                没有找到匹配的笔记记录
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
