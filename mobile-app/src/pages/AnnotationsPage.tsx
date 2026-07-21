import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Icon } from "../components/Icon";
import { CompactToolbar } from "../components/CompactToolbar";
import { BookIntroduction } from "../components/BookIntroduction";
import {
  OT_BOOKS,
  NT_BOOKS,
  getVersion,
  getBookByCode,
  getReading,
  setReading,
  defaultChapterFor,
  bookName,
  loadCommentary,
  type CommentarySection,
} from "../data/scripture";

function commentaryTitleCoversVerse(title: string, chapter: number, verse: number) {
  const match = title.match(/^(\d+):(\d+)(?:\s*[-–,]\s*(?:(\d+):)?(\d+))?/);
  if (!match) return false;
  const startChapter = Number(match[1]);
  const startVerse = Number(match[2]);
  const endChapter = match[3] ? Number(match[3]) : startChapter;
  const endVerse = match[4] ? Number(match[4]) : startVerse;
  const target = chapter * 1000 + verse;
  return target >= startChapter * 1000 + startVerse && target <= endChapter * 1000 + endVerse;
}

// 注释页（design 2b）— real 精读本 (jingdu) commentary for every book.
export function AnnotationsPage() {
  const [params, setParams] = useSearchParams();
  const reading = getReading();
  const version = getVersion(params.get("t") ?? reading.version);
  const book = getBookByCode(params.get("bk") ?? reading.book);
  const displayBook = bookName(book, version);
  const isIntroduction = params.get("intro") === "1";
  const targetVerse = Number(params.get("v")) || null;
  const maxChapter = book.chapters;
  // Follow the reading position so the 注释 tab opens on the chapter the
  // reader is currently in.
  const chapterFallback =
    book.code === reading.book ? reading.chapter : defaultChapterFor(book.code);
  const chapter = Math.min(Math.max(Number(params.get("c")) || chapterFallback, 1), maxChapter);

  const [commentary, setCommentary] = useState<CommentarySection[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [fontSize, setFontSize] = useState(15);
  const [chapterPickerOpen, setChapterPickerOpen] = useState(false);
  const [pickerBook, setPickerBook] = useState<string | null>(null);
  const [locatedAnnotation, setLocatedAnnotation] = useState<string | null>(null);
  const pickerBookData = pickerBook ? getBookByCode(pickerBook) : null;

  const overviewSections = commentary?.filter((section) => section.title.includes("段落综览")) ?? [];
  const verseSections = commentary?.filter((section) => !section.title.includes("段落综览")) ?? [];

  useEffect(() => {
    setCommentary(null);
    setLoadError(false);
    if (isIntroduction) {
      setCommentary([]);
      return;
    }
    let cancelled = false;
    loadCommentary(book.order, chapter)
      .then((c) => { if (!cancelled) setCommentary(c); })
      .catch(() => { if (!cancelled) setLoadError(true); });
    return () => { cancelled = true; };
  }, [book.order, chapter, isIntroduction]);

  useEffect(() => {
    if (!commentary || !targetVerse || isIntroduction) return;
    const verseIndex = commentary.findIndex((section) =>
      !section.title.includes("段落综览") && commentaryTitleCoversVerse(section.title, chapter, targetVerse));
    const overviewIndex = commentary.findIndex((section) =>
      section.title.includes("段落综览") && commentaryTitleCoversVerse(section.title, chapter, targetVerse));
    const targetIndex = verseIndex >= 0 ? verseIndex : overviewIndex;
    if (targetIndex < 0) return;
    const targetId = `annotation-section-${targetIndex}`;
    setLocatedAnnotation(targetId);
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    const timeout = window.setTimeout(() => setLocatedAnnotation((value) => value === targetId ? null : value), 2200);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
    };
  }, [commentary, targetVerse, chapter, isIntroduction]);

  // Keep the reading position in sync so 圣经 tab follows chapter changes
  // made from this page.
  const gotoChapter = (c: number, bookCode = book.code) => {
    setParams({ t: version.code, bk: bookCode, c: String(c) });
    setReading({ version: version.code, book: bookCode, chapter: c });
    setChapterPickerOpen(false);
    setPickerBook(null);
  };

  const gotoIntroduction = (bookCode = book.code) => {
    setParams({ t: version.code, bk: bookCode, intro: "1" });
    setReading({ version: version.code, book: bookCode, chapter: 1 });
    setChapterPickerOpen(false);
    setPickerBook(null);
  };

  const commentaryBody = (body: string) => {
    const colonIndex = body.search(/[：:]/);
    if (colonIndex <= 0 || colonIndex > 18) return body;
    return (
      <>
        <strong>{body.slice(0, colonIndex + 1)}</strong>
        {body.slice(colonIndex + 1)}
      </>
    );
  };

  return (
    <div className="screen">
      <CompactToolbar
        ariaLabel="当前注释卷章与版本"
        primary={`${displayBook} ${isIntroduction ? "绪论" : chapter}`}
        secondary="精读本注释"
        primaryAriaLabel={`选择书卷和章节，当前为${displayBook}${isIntroduction ? "绪论" : `第${chapter}章`}`}
        primaryOpen={chapterPickerOpen}
        onPrimaryClick={() => {
          setChapterPickerOpen((open) => !open);
          setPickerBook(null);
        }}
        actions={(
          <button className="bible-toolbar-action" aria-label="调整注释字体" onClick={() => setFontSize((size) => size >= 19 ? 15 : size + 2)}>
            <span className="bible-font-mark" aria-hidden="true"><span className="small-a">A</span><span className="large-a">A</span></span>
          </button>
        )}
        overlay={chapterPickerOpen && (
          <div className={`bible-chapter-picker ${pickerBookData ? "chapter-list" : "book-list"}`}>
            {pickerBookData ? (
              <>
                <div className="annotation-picker-heading">
                  <button type="button" onClick={() => setPickerBook(null)}>
                    <Icon name="chevron-left" size={14} /> 书卷
                  </button>
                  <div>{bookName(pickerBookData, version)} · 选择章</div>
                </div>
                <button
                  type="button"
                  className={`annotation-intro-picker-option${isIntroduction && pickerBookData.code === book.code ? " active" : ""}`}
                  onClick={() => gotoIntroduction(pickerBookData.code)}
                >
                  <span><Icon name="book" size={17} /> {bookName(pickerBookData, version)}绪论</span>
                  <Icon name="chevron-right" size={16} />
                </button>
                <div className="annotation-chapter-grid">
                  {Array.from({ length: pickerBookData.chapters }, (_, index) => index + 1).map((number) => (
                    <button
                      type="button"
                      key={number}
                      aria-label={`${bookName(pickerBookData, version)}第${number}章`}
                      className={pickerBookData.code === book.code && number === chapter ? "active" : ""}
                      onClick={() => gotoChapter(number, pickerBookData.code)}
                    >
                      {number}
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
                      {group.books.map((candidate) => (
                        <button
                          type="button"
                          key={candidate.code}
                          onClick={() => setPickerBook(candidate.code)}
                          className={`bible-book-option${candidate.code === book.code ? " active" : ""}`}
                        >
                          {bookName(candidate, version)}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      />

      <div className={`screen-scroll annotation-reader${isIntroduction ? " is-introduction" : ""}`} onClick={() => chapterPickerOpen && setChapterPickerOpen(false)}>
        {isIntroduction ? (
          <BookIntroduction
            book={book}
            displayBook={displayBook}
            fontSize={fontSize}
            onStart={() => gotoChapter(1)}
          />
        ) : (
          <>
        <div className="annotation-guide">
          <div className="annotation-guide-title">本章导读</div>
          <div className="annotation-guide-meta">
            {commentary === null
              ? "正在整理本章内容…"
              : `${overviewSections.length} 个段落综览 · ${verseSections.length} 条逐节注释`}
          </div>
        </div>

        <div className="annotation-content">
          {commentary === null && !loadError && (
            <div className="annotation-status">加载注释中…</div>
          )}
          {loadError && (
            <div className="annotation-status">注释加载失败，请检查网络后重试。</div>
          )}

          {overviewSections.length > 0 && (
            <section className="annotation-overviews" aria-label="段落综览">
              {overviewSections.map((section, index) => {
                const [verses] = section.title.split(" · ");
                const sourceIndex = commentary?.indexOf(section) ?? index;
                const sectionId = `annotation-section-${sourceIndex}`;
                return (
                  <article id={sectionId} className={`annotation-overview-card${locatedAnnotation === sectionId ? " is-located" : ""}`} key={`${section.title}-${index}`}>
                    <div className="annotation-overview-heading">
                      <span className="annotation-verse-pill">{verses}</span>
                      <span>段落综览</span>
                    </div>
                    <p style={{ fontSize, lineHeight: fontSize >= 19 ? 1.76 : 1.85 }}>{section.body}</p>
                  </article>
                );
              })}
            </section>
          )}

          {verseSections.length > 0 && (
            <section className="annotation-verses" aria-label="逐节注释">
              <div className="annotation-section-heading">
                <span>逐节注释</span>
                <span>{verseSections.length} 条</span>
              </div>
              {verseSections.map((section, index) => {
                const sourceIndex = commentary?.indexOf(section) ?? index;
                const sectionId = `annotation-section-${sourceIndex}`;
                return (
                  <article id={sectionId} className={`annotation-verse-item${locatedAnnotation === sectionId ? " is-located" : ""}`} key={`${section.title}-${index}`}>
                    <div className="annotation-verse-reference">{section.title}</div>
                    <p style={{ fontSize, lineHeight: fontSize >= 19 ? 1.76 : 1.85 }}>
                      {commentaryBody(section.body)}
                    </p>
                  </article>
                );
              })}
            </section>
          )}

          {commentary?.length === 0 && (
            <div className="annotation-status">本章暂无精读本注释。</div>
          )}
        </div>
          </>
        )}
      </div>
    </div>
  );
}
