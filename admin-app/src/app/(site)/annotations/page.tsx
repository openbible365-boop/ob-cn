import Link from "next/link";
import { db } from "@/lib/db";
import { OT_BOOKS, NT_BOOKS, DEFAULT_BOOK_ORDER, getBook } from "@/lib/bible-books";

export default async function AnnotationsPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string; b?: string; c?: string }>;
}) {
  const { t, b, c } = await searchParams;

  const book = getBook(Number(b) || DEFAULT_BOOK_ORDER);
  const maxChapter = book.chapters;
  const defaultChapter = book.order === DEFAULT_BOOK_ORDER ? 3 : 1;
  const chapter = Math.min(Math.max(Number(c) || defaultChapter, 1), maxChapter);

  // Threads the translation through so 圣经 ↔ 注释 round-trips keep it.
  const hrefFor = (path: string, bookOrder: number, ch: number) => {
    const params = new URLSearchParams();
    if (t) params.set("t", t);
    params.set("b", String(bookOrder));
    params.set("c", String(ch));
    return `${path}?${params.toString()}`;
  };

  const commentary = await db.commentary.findMany({ where: { book: book.zh, chapter }, orderBy: { rangeStart: "asc" } });

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 8, padding: "10px 28px", borderBottom: "1px solid var(--line)", background: "var(--white)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, height: 36, padding: "0 12px", background: "var(--yellow)", border: "1px solid var(--line)", borderRadius: 12, fontSize: 13, fontWeight: 700 }}>精读本</div>
        <details style={{ position: "relative" }}>
          <summary style={{ listStyle: "none", display: "flex", alignItems: "center", gap: 6, height: 36, padding: "0 12px", background: "var(--white)", border: "1px solid var(--line)", borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: "pointer", userSelect: "none" }}>
            {book.zh} {chapter} ▾
          </summary>
          <div style={{ position: "absolute", top: 42, left: 0, zIndex: 40, width: 560, maxHeight: 420, overflow: "auto", background: "var(--white)", border: "1px solid var(--line)", borderRadius: 12, boxShadow: "0 12px 32px rgba(48,49,51,.16)", padding: 12 }}>
            {[{ label: "旧约", books: OT_BOOKS }, { label: "新约", books: NT_BOOKS }].map((group) => (
              <div key={group.label} style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "var(--body)", margin: "4px 2px 6px" }}>{group.label}</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 4 }}>
                  {group.books.map((bk) => (
                    <Link key={bk.order} href={hrefFor("/annotations", bk.order, 1)} style={{
                      padding: "6px 8px", borderRadius: 8, fontSize: 12, textAlign: "center", textDecoration: "none",
                      fontWeight: bk.order === book.order ? 800 : 600,
                      background: bk.order === book.order ? "var(--ink)" : "var(--surface)",
                      color: bk.order === book.order ? "var(--yellow)" : "var(--ink)",
                    }}>
                      {bk.zh}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </details>
        <div style={{ display: "flex", gap: 6, marginLeft: 6 }}>
          {chapter > 1 && <Link href={hrefFor("/annotations", book.order, chapter - 1)} className="icon-btn" style={{ width: 36, height: 36, textDecoration: "none" }}>‹</Link>}
          {chapter < maxChapter && <Link href={hrefFor("/annotations", book.order, chapter + 1)} className="icon-btn" style={{ width: 36, height: 36, textDecoration: "none" }}>›</Link>}
        </div>
        <div style={{ flex: 1 }} />
        <Link href={hrefFor("/bible", book.order, chapter)} style={{ fontSize: 13, fontWeight: 700, color: "var(--body)" }}>去读经 →</Link>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: "32px 40px" }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <div style={{ fontSize: 26, fontWeight: 800, marginBottom: 4 }}>{book.zh} 第 {chapter} 章</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--body)", letterSpacing: "0.08em", marginBottom: 20 }}>精读本注释 · 逐段释义</div>

          {commentary.map((cmt) => (
            <div key={cmt.id} style={{ marginBottom: 20 }}>
              <div style={{ display: "inline-block", fontSize: 13, fontWeight: 800, marginBottom: 8, ...(cmt.highlight ? { background: "var(--yellow)", borderRadius: 6, padding: "2px 8px" } : { color: "var(--purple)" }) }}>{cmt.title}</div>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 400, lineHeight: 1.9, color: "var(--ink)", textWrap: "pretty" }}>{cmt.body}</p>
            </div>
          ))}
          {commentary.length === 0 && (
            <div style={{ fontSize: 13, color: "var(--body)" }}>本章暂无精读本注释。</div>
          )}
        </div>
      </div>
    </div>
  );
}
