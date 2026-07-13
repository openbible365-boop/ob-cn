import Link from "next/link";
import { db } from "@/lib/db";

const BOOK = "约翰福音";
const TRANSLATION = "和合本";

export default async function AnnotationsPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  const { c } = await searchParams;

  const chapterAgg = await db.verse.aggregate({ where: { translation: TRANSLATION, book: BOOK }, _max: { chapter: true } });
  const maxChapter = chapterAgg._max.chapter ?? 1;
  const chapter = Math.min(Math.max(Number(c) || 3, 1), maxChapter);

  const commentary = await db.commentary.findMany({ where: { book: BOOK, chapter }, orderBy: { rangeStart: "asc" } });

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 8, padding: "10px 28px", borderBottom: "1px solid var(--line)", background: "var(--white)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, height: 36, padding: "0 12px", background: "var(--yellow)", border: "1px solid var(--line)", borderRadius: 12, fontSize: 13, fontWeight: 700 }}>和合本</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, height: 36, padding: "0 12px", background: "var(--white)", border: "1px solid var(--line)", borderRadius: 12, fontSize: 13, fontWeight: 700 }}>{BOOK} {chapter}</div>
        <div style={{ display: "flex", gap: 6, marginLeft: 6 }}>
          {chapter > 1 && <Link href={`/annotations?c=${chapter - 1}`} className="icon-btn" style={{ width: 36, height: 36, textDecoration: "none" }}>‹</Link>}
          {chapter < maxChapter && <Link href={`/annotations?c=${chapter + 1}`} className="icon-btn" style={{ width: 36, height: 36, textDecoration: "none" }}>›</Link>}
        </div>
        <div style={{ flex: 1 }} />
        <Link href={`/bible?c=${chapter}`} style={{ fontSize: 13, fontWeight: 700, color: "var(--body)" }}>去读经 →</Link>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: "32px 40px" }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <div style={{ fontSize: 26, fontWeight: 800, marginBottom: 4 }}>{BOOK} 第 {chapter} 章</div>
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
