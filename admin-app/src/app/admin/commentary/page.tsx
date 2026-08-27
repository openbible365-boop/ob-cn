import Link from "next/link";
import { db } from "@/lib/db";
import { BOOKS, getBook } from "@/lib/bible-books";
import { chapterVerses } from "@/lib/web-compat";
import { markChapterStatus, publishCommentary, saveCommentaryEntry } from "@/lib/actions/commentary";
import { SearchBox } from "@/components/Pagination";
import { Badge, PageHeader } from "@/components/ui/Primitives";
import { EmptyState } from "@/components/ui/States";
import type { Tone } from "@/components/ui/Primitives";
import { auth } from "@/auth";

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "草稿中",
  REVIEWED: "已校对",
  PUBLISHED: "已发布",
};
const STATUS_TONE: Record<string, Tone> = {
  DRAFT: "warn",
  REVIEWED: "info",
  PUBLISHED: "neutral",
};

export default async function CommentaryPage({
  searchParams,
}: {
  searchParams: Promise<{ book?: string; chapter?: string; q?: string }>;
}) {
  const { book, chapter, q } = await searchParams;
  const session = await auth();
  const canPublish = session?.user?.role === "SUPER_ADMIN";

  // ── 搜索模式：跨全库定位条目，点结果跳到所在章 ──
  if (q) {
    const hits = await db.commentaryEntry.findMany({
      where: { text: { contains: q, mode: "insensitive" } },
      orderBy: [{ bookOrder: "asc" }, { chapter: "asc" }, { sortOrder: "asc" }],
      take: 50,
    });
    return (
      <>
        <PageHeader title="注释校对" meta={`搜索到 ${hits.length} 条（最多显示 50 条）`} />
        <div className="card" style={{ padding: "16px 18px", flex: 1, overflow: "auto" }}>
          <SearchBox basePath="/admin/commentary" defaultValue={q} placeholder="搜索注释正文" />
          {hits.length === 0 && <EmptyState title="没有找到匹配的注释" hint="换个关键词试试" />}
          {hits.map((hit) => (
            <Link
              key={hit.id}
              href={`/admin/commentary?book=${hit.bookOrder}&chapter=${hit.chapter}`}
              className="commentary-hit"
            >
              <span className="commentary-hit-ref">
                {getBook(hit.bookOrder).zh} {hit.verses}
              </span>
              <span className="commentary-hit-text">{hit.text.slice(0, 90)}…</span>
              <Badge tone={STATUS_TONE[hit.status]}>{STATUS_LABEL[hit.status]}</Badge>
            </Link>
          ))}
        </div>
      </>
    );
  }

  const bookOrder = Number(book) || 1;
  const activeBook = getBook(bookOrder);

  // 本卷各章的条目数与待校对数，用于章节网格上的提示
  const chapterRows = await db.commentaryEntry.groupBy({
    by: ["chapter"],
    where: { bookOrder },
    _count: { _all: true },
    orderBy: { chapter: "asc" },
  });
  const draftRows = await db.commentaryEntry.groupBy({
    by: ["chapter"],
    where: { bookOrder, status: { not: "PUBLISHED" } },
    _count: { _all: true },
  });
  const draftByChapter = new Map(draftRows.map((r) => [r.chapter, r._count._all]));

  const activeChapter = Number(chapter) || chapterRows[0]?.chapter || 1;

  // 当前章的注释条目 + 经文原文（校对时左右对照）
  const [entries, verses] = await Promise.all([
    db.commentaryEntry.findMany({
      where: { bookOrder, chapter: activeChapter },
      orderBy: [{ rangeStart: "asc" }, { sortOrder: "asc" }],
      include: { revisions: { orderBy: { createdAt: "desc" }, take: 1 } },
    }),
    chapterVerses("cuv", activeBook.code, activeChapter),
  ]);
  const verseText = new Map(verses.map((v) => [v.verse, v.text]));

  return (
    <>
      <PageHeader
        title="注释校对"
        meta={`${activeBook.zh} 第 ${activeChapter} 章 · ${entries.length} 条`}
        actions={canPublish ? (
          <form action={publishCommentary}>
            <input type="hidden" name="bookOrder" value={bookOrder} />
            <button type="submit" className="action-purple" title="把本卷内容导出到静态文件，读者才会看到改动">
              发布本卷
            </button>
          </form>
        ) : undefined}
      />

      <div className="commentary-layout">
        {/* 左：卷 + 章导航 */}
        <aside className="card commentary-nav">
          <SearchBox basePath="/admin/commentary" placeholder="搜索注释正文" />

          <div className="commentary-nav-label">书卷</div>
          <div className="commentary-book-list">
            {BOOKS.map((b) => (
              <Link
                key={b.order}
                href={`/admin/commentary?book=${b.order}`}
                className={`commentary-book${b.order === bookOrder ? " is-active" : ""}`}
              >
                {b.zh}
              </Link>
            ))}
          </div>

          <div className="commentary-nav-label">章节</div>
          <div className="commentary-chapter-grid">
            {chapterRows.map((row) => {
              const pending = draftByChapter.get(row.chapter) ?? 0;
              return (
                <Link
                  key={row.chapter}
                  href={`/admin/commentary?book=${bookOrder}&chapter=${row.chapter}`}
                  className={`commentary-chapter${row.chapter === activeChapter ? " is-active" : ""}${pending ? " has-pending" : ""}`}
                  title={pending ? `${pending} 条待发布` : `${row._count._all} 条`}
                >
                  {row.chapter}
                </Link>
              );
            })}
          </div>
        </aside>

        {/* 右：本章条目编辑 */}
        <section className="card commentary-editor">
          <div className="commentary-editor-head">
            <div style={{ fontSize: 13, fontWeight: 800 }}>
              {activeBook.zh} 第 {activeChapter} 章
            </div>
            <div style={{ flex: 1 }} />
            {["REVIEWED", "DRAFT"].map((s) => (
              <form key={s} action={markChapterStatus}>
                <input type="hidden" name="bookOrder" value={bookOrder} />
                <input type="hidden" name="chapter" value={activeChapter} />
                <input type="hidden" name="status" value={s} />
                <button type="submit" className="action-body">
                  全章标记为{STATUS_LABEL[s]}
                </button>
              </form>
            ))}
          </div>

          {entries.length === 0 && (
            <EmptyState title="本章暂无注释" hint="换一章，或先导入注释数据" />
          )}

          {entries.map((entry) => (
            <form key={entry.id} action={saveCommentaryEntry} className="commentary-entry">
              <input type="hidden" name="id" value={entry.id} />

              <div className="commentary-entry-head">
                <input
                  name="verses"
                  defaultValue={entry.verses}
                  className="commentary-verses"
                  aria-label="经文引用"
                />
                <Badge tone={STATUS_TONE[entry.status]}>{STATUS_LABEL[entry.status]}</Badge>
                <span className="commentary-type">
                  {entry.entryType === "overview" ? "段落综览" : "逐节注释"}
                </span>
                <div style={{ flex: 1 }} />
                {entry.revisions[0] && (
                  <span className="commentary-revised">
                    上次修改 {entry.revisions[0].createdAt.toISOString().slice(0, 16).replace("T", " ")}
                  </span>
                )}
              </div>

              {/* 校对对照：这条注释覆盖的经文原文 */}
              {entry.rangeStart > 0 && (
                <div className="commentary-scripture">
                  {Array.from(
                    { length: Math.min(entry.rangeEnd - entry.rangeStart + 1, 12) },
                    (_, i) => entry.rangeStart + i,
                  )
                    .filter((n) => verseText.has(n))
                    .map((n) => (
                      <p key={n}>
                        <b>{n}</b> {verseText.get(n)}
                      </p>
                    ))}
                </div>
              )}

              <textarea
                name="text"
                defaultValue={entry.text}
                rows={Math.min(12, Math.max(3, Math.ceil(entry.text.length / 46)))}
                className="commentary-text"
                aria-label="注释正文"
              />

              <div className="commentary-entry-actions">
                <select name="status" defaultValue={entry.status} aria-label="校对状态">
                  <option value="DRAFT">草稿中</option>
                  <option value="REVIEWED">已校对</option>
                  <option value="PUBLISHED">已发布</option>
                </select>
                <button type="submit" className="action-purple">保存</button>
              </div>
            </form>
          ))}
        </section>
      </div>
    </>
  );
}
