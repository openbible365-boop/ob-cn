import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { Icon } from "../components/Icon";
import { CompactToolbar } from "../components/CompactToolbar";
import { BookIntroduction } from "../components/BookIntroduction";
import { useSettings } from "../context/SettingsContext";
import { PlayingAudioIcon } from "../components/AudioBiblePlayer";
import {
  AnnotationAudioPlayer,
  type AnnotationAudioSegment,
} from "../components/AnnotationAudioPlayer";
import {
  OT_BOOKS,
  NT_BOOKS,
  BOOKS,
  getVersion,
  getBookByCode,
  getReading,
  setReading,
  defaultChapterFor,
  bookName,
  loadCommentary,
  type CommentarySection,
} from "../data/scripture";

const commentaryReferencePattern =
  /^\d+:\d+(?:(?:\s*[-–]\s*(?:\d+:)?\d+)|(?:\s*,\s*\d+))*/;

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
  const rawReference = title.split(" · ")[0].trim();
  return rawReference
    .match(commentaryReferencePattern)?.[0]
    .replace(/\s+/g, "") ?? rawReference;
}

function commentaryTopic(title: string) {
  const match = title.match(commentaryReferencePattern);
  if (!match) return "";
  return title
    .slice(match[0].length)
    .replace(/\s*·\s*段落综览\s*$/, "")
    .replace(/^[\s·：:—–-]+|[\s：:]+$/g, "")
    .trim();
}

// 注释页（design 2b）— real 精读本 (jingdu) commentary for every book.
export function AnnotationsPage() {
  const { translate } = useSettings();
  const [params, setParams] = useSearchParams();
  const reading = getReading();
  const version = getVersion(params.get("t") ?? reading.version);
  const book = getBookByCode(params.get("bk") ?? reading.book);
  const displayBook = translate(bookName(book, version));
  const isIntroduction = params.get("intro") === "1";
  const targetVerse = Number(params.get("v")) || null;
  const maxChapter = book.chapters;
  const chapterFallback =
    book.code === reading.book ? reading.chapter : defaultChapterFor(book.code);
  const chapter = Math.min(Math.max(Number(params.get("c")) || chapterFallback, 1), maxChapter);
  const commentaryChapterKey = `${book.code}-${chapter}`;

  const [commentary, setCommentary] = useState<CommentarySection[] | null>(null);
  const [loadedCommentaryKey, setLoadedCommentaryKey] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [fontSize, setFontSize] = useState(() => {
    const saved = Number(localStorage.getItem("ob.annotations.fontSize"));
    return [15, 17, 19, 21].includes(saved) ? saved : 17;
  });
  const [lineSpacing, setLineSpacing] = useState<"compact" | "comfortable">(
    () => localStorage.getItem("ob.annotations.lineSpacing") === "compact"
      ? "compact"
      : "comfortable",
  );
  const [isTraditional, setIsTraditional] = useState(
    () => localStorage.getItem("ob.bible.isTraditional") === "true",
  );
  const [isDarkMode, setIsDarkMode] = useState(
    () => localStorage.getItem("ob.bible.isDarkMode") === "true",
  );
  const [chapterPickerOpen, setChapterPickerOpen] = useState(false);
  const [copyrightOpen, setCopyrightOpen] = useState(false);
  const [fontSettingsOpen, setFontSettingsOpen] = useState(false);
  const [audioOpen, setAudioOpen] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [audioCurrentSegment, setAudioCurrentSegment] = useState<string | null>(null);
  const [pickerBook, setPickerBook] = useState<string | null>(null);
  const [locatedAnnotation, setLocatedAnnotation] = useState<string | null>(null);
  const gestureStartRef = useRef<{ x: number; y: number } | null>(null);
  const pickerBookData = pickerBook ? getBookByCode(pickerBook) : null;
  const displayedBook = translate(displayBook);

  const indexedCommentary = loadedCommentaryKey === commentaryChapterKey
    ? commentary?.map((section, index) => ({ section, index })) ?? []
    : [];
  const overviewSections = indexedCommentary.filter(({ section }) => section.title.includes("段落综览"));
  const detailSections = indexedCommentary.filter(({ section }) => !section.title.includes("段落综览"));
  const overviewCount = overviewSections.length;
  const detailCount = detailSections.length;
  const annotationAudioSegments: AnnotationAudioSegment[] = [
    ...overviewSections.map(({ section, index }) => ({
      id: `annotation-section-${index}`,
      reference: commentaryReference(section.title),
      label: translate(commentaryTopic(section.title) || "段落导读"),
      text: translate(section.body),
    })),
    ...detailSections.map(({ section, index }) => ({
      id: `annotation-section-${index}`,
      reference: commentaryReference(section.title),
      label: translate(commentaryTopic(section.title) || "逐节注释"),
      text: translate(section.body),
    })),
  ];
  const annotationLineHeight = lineSpacing === "compact"
    ? (fontSize >= 19 ? 1.62 : 1.7)
    : (fontSize >= 19 ? 1.76 : 1.85);

  const locateCommentaryVerse = useCallback((verse: number) => {
    if (!commentary || isIntroduction) return;
    const verseIndex = commentary.findIndex((section) =>
      !section.title.includes("段落综览")
      && commentaryTitleCoversVerse(section.title, chapter, verse));
    const overviewIndex = commentary.findIndex((section) =>
      section.title.includes("段落综览")
      && commentaryTitleCoversVerse(section.title, chapter, verse));
    const targetIndex = verseIndex >= 0 ? verseIndex : overviewIndex;
    if (targetIndex < 0) return;
    const targetId = `annotation-section-${targetIndex}`;
    setLocatedAnnotation(targetId);
    window.requestAnimationFrame(() => {
      document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    window.setTimeout(() => {
      setLocatedAnnotation((value) => value === targetId ? null : value);
    }, 1800);
  }, [commentary, chapter, isIntroduction]);

  const locateCommentarySection = useCallback((sectionId: string) => {
    setLocatedAnnotation(sectionId);
    window.requestAnimationFrame(() => {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    window.setTimeout(() => {
      setLocatedAnnotation((value) => value === sectionId ? null : value);
    }, 1800);
  }, []);

  useEffect(() => {
    setCommentary(null);
    setLoadedCommentaryKey(null);
    setLoadError(false);
    if (isIntroduction) {
      setCommentary([]);
      return;
    }
    let cancelled = false;
    loadCommentary(book.order, chapter)
      .then((sections) => {
        if (cancelled) return;
        setCommentary(sections);
        setLoadedCommentaryKey(commentaryChapterKey);
      })
      .catch(() => { if (!cancelled) setLoadError(true); });
    return () => { cancelled = true; };
  }, [book.order, chapter, commentaryChapterKey, isIntroduction]);

  useEffect(() => {
    if (!commentary || !targetVerse || isIntroduction) return;
    locateCommentaryVerse(targetVerse);
  }, [commentary, targetVerse, isIntroduction, locateCommentaryVerse]);

  useEffect(() => {
    localStorage.setItem("ob.annotations.fontSize", String(fontSize));
  }, [fontSize]);

  useEffect(() => {
    localStorage.setItem("ob.annotations.lineSpacing", lineSpacing);
  }, [lineSpacing]);

  useEffect(() => {
    localStorage.setItem("ob.bible.isTraditional", String(isTraditional));
  }, [isTraditional]);

  useEffect(() => {
    localStorage.setItem("ob.bible.isDarkMode", String(isDarkMode));
    document.body.classList.toggle("dark", isDarkMode);
    document.querySelector('meta[name="theme-color"]')?.setAttribute(
      "content",
      isDarkMode ? "#101116" : "#F6F7F8",
    );
  }, [isDarkMode]);

  useEffect(() => {
    if (!audioPlaying || audioOpen || !audioCurrentSegment) return;
    locateCommentarySection(audioCurrentSegment);
  }, [audioPlaying, audioOpen, audioCurrentSegment, locateCommentarySection]);

  useEffect(() => {
    if (!copyrightOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setCopyrightOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [copyrightOpen]);

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

  const gotoAdjacentChapter = (direction: -1 | 1) => {
    const bookIndex = BOOKS.findIndex((candidate) => candidate.code === book.code);
    if (isIntroduction) {
      if (direction > 0) {
        gotoChapter(1);
      } else if (bookIndex > 0) {
        const previousBook = BOOKS[bookIndex - 1];
        gotoChapter(previousBook.chapters, previousBook.code);
      }
      return;
    }

    if (direction < 0) {
      if (chapter > 1) {
        gotoChapter(chapter - 1);
      } else {
        gotoIntroduction();
      }
      return;
    }

    if (chapter < maxChapter) {
      gotoChapter(chapter + 1);
    } else if (bookIndex >= 0 && bookIndex < BOOKS.length - 1) {
      const nextBook = BOOKS[bookIndex + 1];
      gotoIntroduction(nextBook.code);
    }
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary || (event.pointerType === "mouse" && event.button !== 0)) return;
    gestureStartRef.current = { x: event.clientX, y: event.clientY };
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const start = gestureStartRef.current;
    gestureStartRef.current = null;
    if (
      !start
      || !event.isPrimary
      || chapterPickerOpen
      || copyrightOpen
      || fontSettingsOpen
      || audioOpen
    ) {
      return;
    }
    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    if (Math.abs(deltaX) < 64 || Math.abs(deltaX) < Math.abs(deltaY) * 1.35) return;
    gotoAdjacentChapter(deltaX < 0 ? 1 : -1);
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
        ariaLabel={translate("当前注释卷章与版本")}
        primary={`${displayedBook} ${isIntroduction ? translate("绪论") : chapter}`}
        secondary={translate("精读本注释")}
        primaryAriaLabel={`${translate("选择书卷和章节，当前为")}${displayedBook}${isIntroduction ? translate("绪论") : `${translate("第")}${chapter}${translate("章")}`}`}
        primaryOpen={chapterPickerOpen}
        onPrimaryClick={() => {
          setChapterPickerOpen((open) => !open);
          setCopyrightOpen(false);
          setFontSettingsOpen(false);
          setAudioOpen(false);
          setPickerBook(null);
        }}
        actions={(
          <>
            <button
              type="button"
              className="bible-toolbar-action annotation-audio-trigger"
              title={translate("注释朗读")}
              aria-label={isIntroduction ? translate("绪论页暂无注释朗读") : translate("注释朗读")}
              aria-expanded={audioOpen}
              disabled={isIntroduction}
              onClick={() => {
                setChapterPickerOpen(false);
                setCopyrightOpen(false);
                setFontSettingsOpen(false);
                setPickerBook(null);
                setAudioOpen(true);
              }}
            >
              {audioPlaying ? <PlayingAudioIcon /> : <Icon name="volume-2" size={23} />}
            </button>
            <button
              type="button"
              className="bible-toolbar-action annotation-copyright-trigger"
              aria-label={translate("查看精读本注释版权与版本信息")}
              aria-expanded={copyrightOpen}
              aria-controls="annotation-copyright-dialog"
              onClick={() => {
                setChapterPickerOpen(false);
                setFontSettingsOpen(false);
                setAudioOpen(false);
                setPickerBook(null);
                setCopyrightOpen(true);
              }}
            >
              <Icon name="info" size={20} />
            </button>
            <button
              type="button"
              className="bible-toolbar-action annotation-font-trigger"
              title={translate("字体设置")}
              aria-label={translate("字体设置")}
              aria-expanded={fontSettingsOpen}
              onClick={() => {
                setChapterPickerOpen(false);
                setCopyrightOpen(false);
                setAudioOpen(false);
                setPickerBook(null);
                setFontSettingsOpen((open) => !open);
              }}
            >
              <span className="bible-font-mark" aria-hidden="true">
                <span className="small-a">A</span>
                <span className="large-a">A</span>
              </span>
            </button>
          </>
        )}
        overlay={(
          <>
            {chapterPickerOpen && (
              <div className={`bible-chapter-picker ${pickerBookData ? "chapter-list" : "book-list"}`}>
            {pickerBookData ? (
              <>
                <div className="annotation-picker-heading">
                  <button type="button" onClick={() => setPickerBook(null)}>
                    <Icon name="chevron-left" size={14} /> {translate("书卷")}
                  </button>
                  <div>{translate(bookName(pickerBookData, version))} · {translate("选择章")}</div>
                </div>
                <div className="annotation-chapter-grid">
                  {Array.from({ length: pickerBookData.chapters }, (_, index) => index + 1).map((number) => (
                    <button
                      type="button"
                      key={number}
                      aria-label={`${translate(bookName(pickerBookData, version))}${translate("第")}${number}${translate("章")}`}
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
                    <div className="bible-book-group-title">{translate(group.label)}</div>
                    <div className="bible-book-grid">
                      {group.books.map((candidate) => (
                        <button
                          type="button"
                          key={candidate.code}
                          onClick={() => setPickerBook(candidate.code)}
                          className={`bible-book-option${candidate.code === book.code ? " active" : ""}`}
                        >
                          {translate(bookName(candidate, version))}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </>
            )}
              </div>
            )}
            {fontSettingsOpen && (
              <div className="bible-reading-settings" role="dialog" aria-label={translate("注释阅读设置")}>
                <div className="bible-reading-setting-row">
                  <span>{translate("字体大小")}</span>
                  <div className="bible-font-size-control">
                    <button
                      type="button"
                      aria-label="缩小字体"
                      disabled={fontSize === 15}
                      onClick={() => setFontSize((size) => Math.max(15, size - 2))}
                    >
                      −
                    </button>
                    <b>{fontSize}px</b>
                    <button
                      type="button"
                      aria-label="放大字体"
                      disabled={fontSize === 21}
                      onClick={() => setFontSize((size) => Math.min(21, size + 2))}
                    >
                      +
                    </button>
                  </div>
                </div>
                <div className="bible-reading-setting-row">
                  <span>{translate("语言简繁")}</span>
                  <div className="bible-setting-segment">
                    <button
                      type="button"
                      className={!isTraditional ? "active" : ""}
                      onClick={() => setIsTraditional(false)}
                    >
                      简
                    </button>
                    <button
                      type="button"
                      className={isTraditional ? "active" : ""}
                      onClick={() => setIsTraditional(true)}
                    >
                      繁
                    </button>
                  </div>
                </div>
                <div className="bible-reading-setting-row">
                  <span>{translate("阅读模式")}</span>
                  <div className="bible-setting-segment">
                    <button
                      type="button"
                      className={!isDarkMode ? "active" : ""}
                      onClick={() => setIsDarkMode(false)}
                    >
                      {translate("浅色")}
                    </button>
                    <button
                      type="button"
                      className={isDarkMode ? "active" : ""}
                      onClick={() => setIsDarkMode(true)}
                    >
                      {translate("深色")}
                    </button>
                  </div>
                </div>
                <div className="bible-reading-setting-row">
                  <span>{translate("行间距")}</span>
                  <div className="bible-setting-segment">
                    <button
                      type="button"
                      className={lineSpacing === "compact" ? "active" : ""}
                      onClick={() => setLineSpacing("compact")}
                    >
                      {translate("紧凑")}
                    </button>
                    <button
                      type="button"
                      className={lineSpacing === "comfortable" ? "active" : ""}
                      onClick={() => setLineSpacing("comfortable")}
                    >
                      {translate("舒适")}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      />

      <div
        className={`screen-scroll annotation-reader annotation-reader-scroll${isIntroduction ? " is-introduction" : ""}`}
        onClick={() => {
          if (chapterPickerOpen) setChapterPickerOpen(false);
          if (fontSettingsOpen) setFontSettingsOpen(false);
        }}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
      >
        {isIntroduction ? (
          <BookIntroduction
            book={book}
            displayBook={displayedBook}
            fontSize={fontSize}
            translate={translate}
            onStart={() => gotoChapter(1)}
          />
        ) : (
          <section className="annotation-comparison-section" aria-label={translate("精读本注释阅读")}>
              <header className="annotation-comparison-heading">
                <div>
                  <span className="annotation-paper-kicker">{displayedBook} · {translate("第")} {chapter} {translate("章")}</span>
                  <h1>{translate("精读本注释")}</h1>
                  <p>{translate("按经节范围连续阅读")}</p>
                </div>
                <span>{detailCount} {translate("条")}</span>
              </header>

              {chapter === 1 && (
                <button type="button" className="annotation-book-intro-entry" onClick={() => gotoIntroduction()}>
                  <span className="annotation-book-intro-index">{translate("绪论")}</span>
                  <span>
                    <strong>{displayedBook}{translate("绪论")}</strong>
                    <small>{translate("概述 · 阅读重点 · 全书大纲")}</small>
                  </span>
                  <Icon name="chevron-right" size={17} />
                </button>
              )}

              {overviewSections.length > 0 && (
                <details className="annotation-overview-details" open>
                  <summary>
                    <span>{translate("本章综览")}</span>
                    <small>{overviewCount} {translate("段")}</small>
                  </summary>
                  <div className="annotation-chapter-overviews">
                    {overviewSections.map(({ section, index }) => {
                      const sectionId = `annotation-section-${index}`;
                      const topic = commentaryTopic(section.title);
                      return (
                        <article
                          id={sectionId}
                          className={`annotation-chapter-overview${locatedAnnotation === sectionId ? " is-located" : ""}`}
                          key={`${section.title}-${index}`}
                        >
                          <div className="annotation-section-meta">
                            <span className="annotation-reference-chip">{commentaryReference(section.title)}</span>
                            <span>{translate(topic || "段落导读")}</span>
                          </div>
                          <p
                            className="annotation-section-body"
                            style={{ fontSize, lineHeight: annotationLineHeight }}
                          >
                            {translate(section.body)}
                          </p>
                        </article>
                      );
                    })}
                  </div>
                </details>
              )}

              {loadError && (
                <div className="annotation-status-card" role="alert">{translate("注释加载失败，请检查网络后重试。")}</div>
              )}
              {commentary === null && !loadError && (
                <div className="annotation-status-card">{translate("加载注释中…")}</div>
              )}
              <div className="annotation-comparison-list">
                {detailSections.map(({ section, index }) => {
                  const sectionId = `annotation-section-${index}`;
                  const reference = commentaryReference(section.title);
                  const topic = commentaryTopic(section.title);
                  return (
                    <article
                      id={sectionId}
                      className={`annotation-comparison-card${locatedAnnotation === sectionId ? " is-located" : ""}`}
                      key={`${section.title}-${index}`}
                    >
                      <header className="annotation-entry-heading">
                        <span className="annotation-reference-chip">{reference}</span>
                        <h2>{translate(topic || "逐节注释")}</h2>
                      </header>
                      <div className="annotation-commentary-panel">
                        <p
                          className="annotation-section-body"
                          style={{ fontSize, lineHeight: annotationLineHeight }}
                        >
                          {commentaryBody(translate(section.body))}
                        </p>
                      </div>
                    </article>
                  );
                })}
              </div>
              {commentary !== null && detailCount === 0 && (
                <div className="annotation-status-card">
                  <div className="annotation-empty-title">{translate("本章暂无逐节注释")}</div>
                  <div>{translate("可以阅读本章综览，或切换到其他章节继续阅读。")}</div>
                </div>
              )}
              <div className="annotation-swipe-hint">{translate("左右滑动切换绪论、上一章或下一章")}</div>
          </section>
        )}
      </div>

      <AnnotationAudioPlayer
        open={audioOpen}
        displayBook={displayedBook}
        chapter={chapter}
        maxChapter={maxChapter}
        segments={annotationAudioSegments}
        isTraditional={isTraditional}
        translate={translate}
        onClose={() => setAudioOpen(false)}
        onChapterChange={(nextChapter) => gotoChapter(nextChapter)}
        onLocateSegment={(segmentId) => {
          setAudioOpen(false);
          locateCommentarySection(segmentId);
        }}
        onPlayingChange={setAudioPlaying}
        onCurrentSegmentChange={setAudioCurrentSegment}
      />

      {copyrightOpen && (
        <div className="annotation-copyright-layer">
          <button
            className="annotation-copyright-scrim"
            type="button"
            aria-label={translate("关闭版权与版本信息")}
            onClick={() => setCopyrightOpen(false)}
          />
          <section
            id="annotation-copyright-dialog"
            className="annotation-copyright-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="annotation-copyright-title"
          >
            <header className="annotation-copyright-heading">
              <div>
                <span className="annotation-copyright-symbol" aria-hidden="true">©</span>
                <span>
                  <h2 id="annotation-copyright-title">{translate("版权与版本信息")}</h2>
                  <p>{translate("精读本圣经注释")}</p>
                </span>
              </div>
              <button
                type="button"
                className="annotation-copyright-close"
                aria-label={translate("关闭")}
                onClick={() => setCopyrightOpen(false)}
              >
                <Icon name="x" size={19} />
              </button>
            </header>

            <dl className="annotation-copyright-details">
              <div>
                <dt>{translate("作者")}</dt>
                <dd>{translate("牧声出版有限公司")}</dd>
              </div>
              <div>
                <dt>{translate("出版")}</dt>
                <dd>{translate("牧声出版有限公司")}</dd>
              </div>
              <div>
                <dt>{translate("国际标准书号")}</dt>
                <dd>978-988-16431-1-7</dd>
              </div>
              <div>
                <dt>{translate("联系方式")}</dt>
                <dd><a href="mailto:mushengbooks@gmail.com">mushengbooks@gmail.com</a></dd>
              </div>
              <div>
                <dt>{translate("版本")}</dt>
                <dd>{translate("2026 最新修订版")}</dd>
              </div>
              <div>
                <dt>{translate("版权")}</dt>
                <dd>{translate("未经授权，请勿搬运")}</dd>
              </div>
            </dl>
          </section>
        </div>
      )}
    </div>
  );
}
