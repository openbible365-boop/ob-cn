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

function commentaryReference(title: string) {
  const rawReference = title.split(" · ")[0];
  return rawReference.match(/^\d+(?::\d+(?:-\d+)?)?/)?.[0] ?? rawReference;
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
  const chapterFallback =
    book.code === reading.book ? reading.chapter : defaultChapterFor(book.code);
  const chapter = Math.min(Math.max(Number(params.get("c")) || chapterFallback, 1), maxChapter);

  const [commentary, setCommentary] = useState<CommentarySection[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [fontSize, setFontSize] = useState(17);
  const [chapterPickerOpen, setChapterPickerOpen] = useState(false);
  const [pickerBook, setPickerBook] = useState<string | null>(null);
  const [locatedAnnotation, setLocatedAnnotation] = useState<string | null>(null);
  const pickerBookData = pickerBook ? getBookByCode(pickerBook) : null;

  const overviewCount = commentary?.filter((section) => section.title.includes("段落综览")).length ?? 0;
  const detailCount = commentary ? commentary.length - overviewCount : 0;

  useEffect(() => {
    setCommentary(null);
    setLoadError(false);
    if (isIntroduction) {
      setCommentary([]);
      return;
    }
    let cancelled = false;
    loadCommentary(book.order, chapter)
      .then((sections) => { if (!cancelled) setCommentary(sections); })
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
    const timeout = window.setTimeout(() => {
      setLocatedAnnotation((value) => value === targetId ? null : value);
    }, 2200);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
    };
  }, [commentary, targetVerse, chapter, isIntroduction]);

  const gotoChapter = (nextChapter: number, bookCode = book.code) => {
    setParams({ t: version.code, bk: bookCode, c: String(nextChapter) });
    setReading({ version: version.code, book: bookCode, chapter: nextChapter });
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
    <div className="screen annotation-reader-screen">
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
          <button
            type="button"
            className="bible-toolbar-action"
            aria-label={`调整注释字体，当前 ${fontSize} 像素`}
            onClick={() => setFontSize((size) => size >= 19 ? 15 : size + 2)}
          >
            <span className="bible-font-mark" aria-hidden="true">
              <span className="small-a">A</span>
              <span className="large-a">A</span>
            </span>
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

      <div
        className={`screen-scroll annotation-reader annotation-reader-scroll${isIntroduction ? " is-introduction" : ""}`}
        onClick={() => chapterPickerOpen && setChapterPickerOpen(false)}
      >
        {isIntroduction ? (
          <BookIntroduction
            book={book}
            displayBook={displayBook}
            fontSize={fontSize}
            onStart={() => gotoChapter(1)}
          />
        ) : (
          <>
            <section className="annotation-guide-card" aria-label="本章导读">
              <h1>本章导读</h1>
              <p>
                {commentary
                  ? `${overviewCount} 个段落综览 · ${detailCount} 条逐节注释`
                  : "正在整理本章注释…"}
              </p>
            </section>

            <div className="annotation-section-list">
              {commentary === null && !loadError && (
                <div className="annotation-status-card">加载注释中…</div>
              )}
              {loadError && (
                <div className="annotation-status-card" role="alert">注释加载失败，请检查网络后重试。</div>
              )}
              {commentary?.map((section, index) => {
                const sectionId = `annotation-section-${index}`;
                const sectionType = section.title.includes("段落综览") ? "段落综览" : "逐节注释";
                return (
                  <article
                    id={sectionId}
                    className={`annotation-section-card${locatedAnnotation === sectionId ? " is-located" : ""}`}
                    key={`${section.title}-${index}`}
                  >
                    <div className="annotation-section-meta">
                      <span className="annotation-reference-chip">{commentaryReference(section.title)}</span>
                      <span>{sectionType}</span>
                    </div>
                    <p
                      className="annotation-section-body"
                      style={{ fontSize, lineHeight: fontSize >= 19 ? 1.76 : 1.85 }}
                    >
                      {commentaryBody(section.body)}
                    </p>
                  </article>
                );
              })}
              {commentary?.length === 0 && (
                <div className="annotation-status-card">
                  <div className="annotation-empty-title">本章暂无精读本注释</div>
                  <div>可以切换到其他章节继续阅读。</div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
