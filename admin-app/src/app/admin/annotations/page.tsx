import { db } from "@/lib/db";
import { SearchShortcut, ShortcutHint } from "@/components/ui/SearchShortcut";
import { pageInfo, pageQuery, parsePage } from "@/lib/pagination";
import { Pagination } from "@/components/Pagination";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/States";

const HIGHLIGHT_COLUMNS: Column[] = [
  { key: "user", label: "用户", width: "1.4fr" },
  { key: "ref", label: "经文位置", width: "1.2fr" },
  { key: "color", label: "高亮颜色", width: "1fr" },
  { key: "time", label: "标注时间", width: "1.2fr" },
  { key: "ops", label: "操作", width: "150px" },
];

const NOTE_COLUMNS: Column[] = [
  { key: "user", label: "用户", width: "1.4fr" },
  { key: "ref", label: "经文位置", width: "1.2fr" },
  { key: "content", label: "笔记内容", width: "2.4fr" },
  { key: "time", label: "记录时间", width: "1.2fr" },
  { key: "ops", label: "操作", width: "120px" },
];
import { UserAvatar } from "@/components/UserAvatar";
import { deleteNote, deleteHighlight } from "@/lib/actions/content";
import Link from "next/link";
import type { Prisma } from "@/generated/prisma/client";
import { formatDateTime } from "@/lib/format";

export default async function AnnotationsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tab?: string; page?: string }>;
}) {
  const { q, tab = "highlights", page: pageParam } = await searchParams;
  const page = parsePage(pageParam);

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
    d ? formatDateTime(d) : "";

  // Query records depending on tab
  let highlights: Prisma.HighlightGetPayload<{ include: { user: true } }>[] = [];
  let notes: Prisma.NoteGetPayload<{ include: { user: true } }>[] = [];

  let listTotal = 0;
  if (tab === "highlights") {
    const where = q
      ? {
          OR: [
            { user: { name: { contains: q, mode: "insensitive" as const } } },
            { book: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : undefined;
    [highlights, listTotal] = await Promise.all([
      db.highlight.findMany({
        where,
        include: { user: true },
        orderBy: { createdAt: "desc" },
        ...pageQuery(page),
      }),
      db.highlight.count({ where }),
    ]);
  } else {
    const where = q
      ? {
          OR: [
            { user: { name: { contains: q, mode: "insensitive" as const } } },
            { book: { contains: q, mode: "insensitive" as const } },
            { content: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : undefined;
    [notes, listTotal] = await Promise.all([
      db.note.findMany({
        where,
        include: { user: true },
        orderBy: { createdAt: "desc" },
        ...pageQuery(page),
      }),
      db.note.count({ where }),
    ]);
  }
  const info = pageInfo(page, listTotal);

  return (
    <>
      <SearchShortcut />
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
            <DataTable columns={HIGHLIGHT_COLUMNS} label="用户高亮列表">
              {highlights.map((h) => (
                <DataTable.Row key={h.id}>
                  <DataTable.Cell>
                    <div className="user-cell">
                      <UserAvatar name={h.user.name} avatarColor={h.user.avatarColor} avatarUrl={h.user.avatarUrl} />
                      <div className="user-cell-text">
                        <div className="user-cell-name" title={h.user.name}>{h.user.name}</div>
                        <div className="user-cell-sub">UID {h.user.uid}</div>
                      </div>
                    </div>
                  </DataTable.Cell>
                  <DataTable.Cell><strong>{h.book.toUpperCase()} {h.chapter}:{h.verse}</strong></DataTable.Cell>
                  <DataTable.Cell>
                    <span className="color-chip">
                      <span className="color-dot" style={{ background: h.color }} />
                      {h.color}
                    </span>
                  </DataTable.Cell>
                  <DataTable.Cell>{fmtTime(h.createdAt)}</DataTable.Cell>
                  <DataTable.Cell>
                    <div className="row-actions">
                      <form action={deleteHighlight}>
                        <input type="hidden" name="highlightId" value={h.id} />
                        <button type="submit" className="action-pink">清除高亮</button>
                      </form>
                    </div>
                  </DataTable.Cell>
                </DataTable.Row>
              ))}
              {highlights.length === 0 && (
                <EmptyState title="没有找到高亮记录" hint="用户在 App 或网页端标记经文颜色后，记录会出现在这里" />
              )}
            </DataTable>
          </>
        ) : (
          <>
            <DataTable columns={NOTE_COLUMNS} label="用户笔记列表">
              {notes.map((n) => (
                <DataTable.Row key={n.id}>
                  <DataTable.Cell>
                    <div className="user-cell">
                      <UserAvatar name={n.user.name} avatarColor={n.user.avatarColor} avatarUrl={n.user.avatarUrl} />
                      <div className="user-cell-text">
                        <div className="user-cell-name" title={n.user.name}>{n.user.name}</div>
                        <div className="user-cell-sub">UID {n.user.uid}</div>
                      </div>
                    </div>
                  </DataTable.Cell>
                  <DataTable.Cell><strong>{n.book.toUpperCase()} {n.chapter}:{n.verse}</strong></DataTable.Cell>
                  <DataTable.Cell truncate title={n.content}>{n.content}</DataTable.Cell>
                  <DataTable.Cell>{fmtTime(n.createdAt)}</DataTable.Cell>
                  <DataTable.Cell>
                    <div className="row-actions">
                      <form action={deleteNote}>
                        <input type="hidden" name="noteId" value={n.id} />
                        <button type="submit" className="action-pink">删除笔记</button>
                      </form>
                    </div>
                  </DataTable.Cell>
                </DataTable.Row>
              ))}
              {notes.length === 0 && (
                <EmptyState title="没有找到笔记记录" hint="用户在经文上写笔记后，记录会出现在这里" />
              )}
            </DataTable>
          </>
        )}

        <Pagination info={info} basePath="/admin/annotations" params={{ q, tab }} />
      </div>
    </>
  );
}
