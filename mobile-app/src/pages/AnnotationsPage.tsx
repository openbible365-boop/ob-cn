import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Icon } from "../components/Icon";
import {
  getVersion,
  getBookByCode,
  getReading,
  bookName,
  loadCommentary,
  type CommentarySection,
} from "../data/scripture";

// 注释页（design 2b）— real 精读本 (jingdu) commentary for every book.
export function AnnotationsPage() {
  const [params, setParams] = useSearchParams();
  const reading = getReading();
  const version = getVersion(reading.version);
  const book = getBookByCode(params.get("bk") ?? reading.book);
  const displayBook = bookName(book, version);
  const maxChapter = book.chapters;
  const defaultChapter = book.code === "jhn" ? 3 : 1;
  const chapter = Math.min(Math.max(Number(params.get("c")) || defaultChapter, 1), maxChapter);

  const [commentary, setCommentary] = useState<CommentarySection[] | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    setCommentary(null);
    setLoadError(false);
    let cancelled = false;
    loadCommentary(book.order, chapter)
      .then((c) => { if (!cancelled) setCommentary(c); })
      .catch(() => { if (!cancelled) setLoadError(true); });
    return () => { cancelled = true; };
  }, [book.order, chapter]);

  const gotoChapter = (c: number) => setParams({ bk: book.code, c: String(c) });

  return (
    <div className="screen">
      <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 8, padding: "10px 16px 14px", borderBottom: "1px solid var(--line)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, height: 40, padding: "0 12px", background: "var(--yellow)", border: "1px solid var(--line)", borderRadius: 12, boxShadow: "var(--shadow-card)", fontSize: 14, fontWeight: 700 }}>
          精读本
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, height: 40, padding: "0 12px", background: "var(--white)", border: "1px solid var(--line)", borderRadius: 12, boxShadow: "var(--shadow-card)", fontSize: 14, fontWeight: 700 }}>
          {displayBook} {chapter}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {chapter > 1 && (
            <button className="icon-btn" onClick={() => gotoChapter(chapter - 1)}><Icon name="chevron-left" size={16} /></button>
          )}
          {chapter < maxChapter && (
            <button className="icon-btn" onClick={() => gotoChapter(chapter + 1)}><Icon name="chevron-right" size={16} /></button>
          )}
        </div>
        <div style={{ flex: 1 }} />
      </div>

      <div className="screen-scroll" style={{ padding: "22px 24px 24px" }}>
        <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>{displayBook} 第 {chapter} 章</div>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--body)", letterSpacing: "0.08em", marginBottom: 16 }}>
          精读本注释 · 逐段释义
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {commentary === null && !loadError && (
            <div style={{ fontSize: 13, color: "var(--body)" }}>加载注释中…</div>
          )}
          {loadError && (
            <div style={{ fontSize: 13, color: "var(--body)" }}>注释加载失败，请检查网络后重试。</div>
          )}
          {commentary?.map((c, i) => (
            <div key={`${c.title}-${i}`} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{
                alignSelf: "flex-start", fontSize: 12, fontWeight: 800,
                ...(c.highlight
                  ? { background: "var(--yellow)", borderRadius: 6, padding: "2px 8px" }
                  : { color: "var(--purple)" }),
              }}>
                {c.title}
              </div>
              <p style={{ fontSize: 15, fontWeight: 400, lineHeight: 1.85, color: "var(--ink)", textWrap: "pretty" }}>{c.body}</p>
            </div>
          ))}
          {commentary?.length === 0 && (
            <div style={{ fontSize: 13, color: "var(--body)" }}>本章暂无精读本注释。</div>
          )}
        </div>
      </div>
    </div>
  );
}
