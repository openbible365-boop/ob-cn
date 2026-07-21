import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Icon } from "../components/Icon";
import {
  getVersion,
  getBookByCode,
  getReading,
  setReading,
  defaultChapterFor,
  bookName,
  loadCommentary,
  type CommentarySection,
  OT_BOOKS,
  NT_BOOKS,
  VERSIONS,
} from "../data/scripture";

// 注释页（design 2b）— real 精读本 (jingdu) commentary for every book.
export function AnnotationsPage() {
  const [params, setParams] = useSearchParams();
  const reading = getReading();
  const version = getVersion(params.get("t") ?? reading.version);
  const book = getBookByCode(params.get("bk") ?? reading.book);
  const displayBook = bookName(book, version);
  const maxChapter = book.chapters;
  // Follow the reading position so the 注释 tab opens on the chapter the
  // reader is currently in.
  const chapterFallback =
    book.code === reading.book ? reading.chapter : defaultChapterFor(book.code);
  const chapter = Math.min(Math.max(Number(params.get("c")) || chapterFallback, 1), maxChapter);

  const [commentary, setCommentary] = useState<CommentarySection[] | null>(null);
  const [loadError, setLoadError] = useState(false);

  const [picker, setPicker] = useState<"chapter" | "version" | null>(null);
  const [pickerBook, setPickerBook] = useState<string | null>(null);
  const pickerBookData = pickerBook ? getBookByCode(pickerBook) : null;

  useEffect(() => {
    setCommentary(null);
    setLoadError(false);
    let cancelled = false;
    loadCommentary(book.order, chapter)
      .then((c) => { if (!cancelled) setCommentary(c); })
      .catch(() => { if (!cancelled) setLoadError(true); });
    return () => { cancelled = true; };
  }, [book.order, chapter]);

  // Keep the reading position in sync so 圣经 tab follows chapter changes
  // made from this page.
  const gotoChapter = (c: number, bk?: string) => {
    setPicker(null);
    const nextBook = bk ?? book.code;
    setParams({ t: version.code, bk: nextBook, c: String(c) });
    setReading({ version: version.code, book: nextBook, chapter: c });
  };

  const gotoVersion = (code: string) => {
    setPicker(null);
    setParams({ t: code, bk: book.code, c: String(chapter) });
    setReading({ version: code, book: book.code, chapter });
  };

  return (
    <div className="screen">
      {/* reading toolbar - aligned with BiblePage header */}
      <div className="bible-toolbar">
        <div className="bible-reader-selectors" aria-label="经卷章节及译本选择">
          <button
            className={`bible-reader-selector chapter${picker === "chapter" ? " is-open" : ""}`}
            onClick={() => { setPicker(picker === "chapter" ? null : "chapter"); setPickerBook(null); }}
            aria-label={`选择经卷和章节，当前为${displayBook}第${chapter}章`}
          >
            {displayBook} {chapter}
          </button>
          <button
            className={`bible-reader-selector version${picker === "version" ? " is-open" : ""}`}
            onClick={() => setPicker(picker === "version" ? null : "version")}
            aria-label={`选择译本，当前为${version.label}`}
          >
            {version.label}
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 32, padding: "0 12px", background: "var(--yellow)", border: "1px solid var(--line)", borderRadius: 10, boxShadow: "var(--shadow-card)", fontSize: 12, fontWeight: 800, color: "var(--ink)", marginLeft: "auto" }}>
          精读本
        </div>

        {picker === "version" && (
          <div className="bible-version-picker" style={{ position: "absolute", top: 46, left: 16, width: 220, background: "var(--white)", border: "1px solid var(--line)", borderRadius: 16, boxShadow: "0 12px 32px rgba(48,49,51,.16)", padding: 8, zIndex: 30 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: "var(--body)", padding: "4px 6px 8px" }}>选择译本</div>
            {VERSIONS.map((ver) => (
              <button
                key={ver.code}
                className={`bible-version-option${ver.code === version.code ? " active" : ""}`}
                onClick={() => gotoVersion(ver.code)}
                style={{
                  display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "9px 10px",
                  borderRadius: 10, fontSize: 14, textAlign: "left",
                  fontWeight: ver.code === version.code ? 800 : 600,
                  background: ver.code === version.code ? "#ffedbd" : "transparent",
                  color: "var(--ink)",
                }}
              >
                {ver.label}
                {ver.code === version.code && <span style={{ marginLeft: "auto", color: "var(--purple)" }}><Icon name="check" size={15} /></span>}
              </button>
            ))}
          </div>
        )}

        {picker === "chapter" && (
          <div className={`bible-chapter-picker ${pickerBookData ? "chapter-list" : "book-list"}`}>
            {pickerBookData ? (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <button onClick={() => setPickerBook(null)} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 700, color: "var(--body)" }}>
                    <Icon name="chevron-left" size={14} /> 书卷
                  </button>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "var(--body)" }}>{bookName(pickerBookData, version)} · 选择章</div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
                  {Array.from({ length: pickerBookData.chapters }, (_, i) => i + 1).map((n) => (
                    <button
                      key={n}
                      onClick={() => gotoChapter(n, pickerBookData.code)}
                      style={{
                        height: 34, borderRadius: 8, fontSize: 13, fontWeight: 700,
                        border: "1px solid var(--line)",
                        background: pickerBookData.code === book.code && n === chapter ? "var(--ink)" : "var(--white)",
                        color: pickerBookData.code === book.code && n === chapter ? "var(--yellow)" : "var(--ink)",
                      }}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                {[{ label: "旧约", books: OT_BOOKS }, { label: "新约", books: NT_BOOKS }].map((group) => (
                  <div key={group.label} className="bible-book-group">
                    <div className="bible-book-group-title">{group.label}</div>
                    <div className="bible-book-grid">
                      {group.books.map((bk) => (
                        <button
                          key={bk.code}
                          onClick={() => setPickerBook(bk.code)}
                          className={`bible-book-option${bk.code === book.code ? " active" : ""}`}
                        >
                          {bookName(bk, version)}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      <div className="screen-scroll" style={{ padding: "22px 24px 24px" }} onClick={() => picker && setPicker(null)}>
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
