import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import { startReadTimer } from "../data/reading-stats";
import { useSearchParams } from "react-router-dom";
import { EmptyState } from "../components/EmptyState";
import { Icon } from "../components/Icon";
import { CompactToolbar } from "../components/CompactToolbar";
import { BookIntroduction } from "../components/BookIntroduction";
import { useSettings } from "../context/SettingsContext";
import { ANDROID_BACK_EVENT } from "../native/android-back";
import { PlayingAudioIcon } from "../components/PlayingAudioIcon";
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
  bookChipName,
  loadBook,
  loadCommentary,
  loadIntroduction,
  stripHtml,
  type CommentarySection,
  type Verse,
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

// 解析引用范围（11:1-44 / 11:8-10 / 11:1），用于按开始节排序并识别多节条目
function commentaryRange(title: string) {
  const match = title.match(/^(\d+):(\d+)(?:\s*[-–,]\s*(?:(\d+):)?(\d+))?/);
  if (!match) return null;
  const startChapter = Number(match[1]);
  const startVerse = Number(match[2]);
  const endChapter = match[3] ? Number(match[3]) : startChapter;
  const endVerse = match[4] ? Number(match[4]) : startVerse;
  const start = startChapter * 1000 + startVerse;
  const end = endChapter * 1000 + endVerse;
  return { start, end, isRange: end > start };
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
  const { translate, isTraditional, setIsTraditional } = useSettings();
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

  const [introSections, setIntroSections] = useState<CommentarySection[] | null>(null);
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
  const [chapterPickerOpen, setChapterPickerOpen] = useState(false);
  const [copyrightOpen, setCopyrightOpen] = useState(false);
  const [fontSettingsOpen, setFontSettingsOpen] = useState(false);
  const [audioOpen, setAudioOpen] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [audioCurrentSegment, setAudioCurrentSegment] = useState<string | null>(null);
  const [pickerBook, setPickerBook] = useState<string | null>(null);
  const [locatedAnnotation, setLocatedAnnotation] = useState<string | null>(null);
  // 注释↔经文对照：点条目的引用徽章，就地展开对应经文
  const [expandedScripture, setExpandedScripture] = useState<string | null>(null);
  const [scriptureVerses, setScriptureVerses] = useState<Verse[] | null>(null);
  const expandedScriptureRef = useRef<string | null>(null);
  // 进度线用 ref 直写 style：滚动是最高频事件，不值得整页重渲（与圣经页同策略）
  const readProgressRef = useRef<HTMLDivElement>(null);
  const gestureStartRef = useRef<{ x: number; y: number } | null>(null);
  const suppressClickRef = useRef(false);

  // 安卓返回键：先关掉打开的面板，再轮到路由回退
  useEffect(() => {
    const closeTopOverlay = (event: Event) => {
      const close =
        (audioOpen && (() => setAudioOpen(false)))
        || (fontSettingsOpen && (() => setFontSettingsOpen(false)))
        || (copyrightOpen && (() => setCopyrightOpen(false)))
        || (chapterPickerOpen && (() => { setChapterPickerOpen(false); setPickerBook(null); }));
      if (close) {
        event.preventDefault();
        close();
      }
    };
    window.addEventListener(ANDROID_BACK_EVENT, closeTopOverlay);
    return () => window.removeEventListener(ANDROID_BACK_EVENT, closeTopOverlay);
  }, [audioOpen, fontSettingsOpen, copyrightOpen, chapterPickerOpen]);
  const pickerBookData = pickerBook ? getBookByCode(pickerBook) : null;
  const displayedBook = translate(displayBook);

  const indexedCommentary = loadedCommentaryKey === commentaryChapterKey
    ? commentary?.map((section, index) => ({ section, index })) ?? []
    : [];
  // 段落综览与逐节注释合成一条流，统一按「开始节」排序：
  // 11:1-44 这类多节条目就落在它起始的那一节前面，而不是全部堆在章首。
  const orderedSections = indexedCommentary
    .map((entry) => ({
      ...entry,
      variant: entry.section.title.includes("段落综览") ? ("overview" as const) : ("detail" as const),
      range: commentaryRange(entry.section.title),
    }))
    .sort((a, b) => {
      const aStart = a.range?.start ?? Number.MAX_SAFE_INTEGER;
      const bStart = b.range?.start ?? Number.MAX_SAFE_INTEGER;
      if (aStart !== bStart) return aStart - bStart;
      // 同一开始节时，覆盖范围大的在前（段落综览先于该节的逐节注释）
      const span = (entry: typeof a) => (entry.range?.end ?? 0) - (entry.range?.start ?? 0);
      return span(b) - span(a);
    });
  const detailCount = orderedSections.filter(({ variant }) => variant === "detail").length;
  const annotationAudioSegments: AnnotationAudioSegment[] = orderedSections
    .map(({ section, index }) => ({
      id: `annotation-section-${index}`,
      reference: commentaryReference(section.title),
      label: translate(commentaryTopic(section.title)),
      text: translate(section.body),
    }));
  const annotationLineHeight = lineSpacing === "compact"
    ? (fontSize >= 19 ? 1.62 : 1.7)
    : (fontSize >= 19 ? 1.76 : 1.85);

  const locateCommentaryVerse = useCallback((verse: number) => {
    if (!commentary || isIntroduction) return;
    // 覆盖该节的条目可能有多个（整章综览、段落综览、逐节注释），
    // 取范围最窄的那条——点第 31 节应落在 11:31-33，而不是 11:1-44。
    const candidates = commentary
      .map((section, index) => ({ section, index, range: commentaryRange(section.title) }))
      .filter(({ section }) => commentaryTitleCoversVerse(section.title, chapter, verse));
    if (candidates.length === 0) return;
    const span = (item: (typeof candidates)[number]) =>
      (item.range?.end ?? 0) - (item.range?.start ?? 0);
    const targetIndex = candidates.reduce((best, item) => {
      const diff = span(item) - span(best);
      if (diff !== 0) return diff < 0 ? item : best;
      // 范围一样窄时优先逐节注释
      const isDetail = (x: typeof item) => !x.section.title.includes("段落综览");
      return isDetail(item) && !isDetail(best) ? item : best;
    }).index;
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
    setIntroSections(null);
    let cancelled = false;
    if (isIntroduction) {
      setCommentary([]);
      loadIntroduction(book.order)
        .then((sections) => { if (!cancelled) setIntroSections(sections); })
        .catch(() => { if (!cancelled) setLoadError(true); });
      return () => { cancelled = true; };
    }
    loadCommentary(book.order, chapter)
      .then((sections) => {
        if (cancelled) return;
        setCommentary(sections);
        setLoadedCommentaryKey(commentaryChapterKey);
      })
      .catch(() => { if (!cancelled) setLoadError(true); });
    return () => { cancelled = true; };
  }, [book.order, chapter, commentaryChapterKey, isIntroduction]);

  // 阅读统计：注释（含书卷绪论，记为第 0 章）停留满 8 秒记为读过一次
  const commentaryReady = isIntroduction ? introSections !== null : loadedCommentaryKey === commentaryChapterKey;
  useEffect(() => {
    if (!commentaryReady) return;
    return startReadTimer({ kind: "commentary", book: book.code, chapter: isIntroduction ? 0 : chapter });
  }, [commentaryReady, book.code, chapter, isIntroduction]);

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
    // 与圣经页一致：左右边缘 24px 让给系统手势（iOS 侧滑返回 / Android 手势导航）
    if (event.clientX < 24 || event.clientX > window.innerWidth - 24) return;
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
    // 滑动收尾落在引用徽章等可点元素上时，抑制这记 click，避免翻章+展开经文同时触发
    suppressClickRef.current = true;
    window.setTimeout(() => { suppressClickRef.current = false; }, 0);
    gotoAdjacentChapter(deltaX < 0 ? 1 : -1);
  };

  // 换章时收起经文对照、进度线归零
  useEffect(() => {
    expandedScriptureRef.current = null;
    setExpandedScripture(null);
    setScriptureVerses(null);
    if (readProgressRef.current) readProgressRef.current.style.width = "0%";
  }, [commentaryChapterKey, isIntroduction]);

  // 章内阅读进度：与圣经页一致的 2px 金色细线
  useEffect(() => {
    const scroller = document.querySelector<HTMLElement>(".annotation-reader-scroll");
    if (!scroller) return;
    const update = () => {
      if (!readProgressRef.current) return;
      const total = scroller.scrollHeight - scroller.clientHeight;
      readProgressRef.current.style.width = `${total > 0 ? Math.min(100, (scroller.scrollTop / total) * 100) : 0}%`;
    };
    update();
    scroller.addEventListener("scroll", update, { passive: true });
    return () => scroller.removeEventListener("scroll", update);
  }, [commentaryChapterKey, isIntroduction, commentary]);

  const toggleScripture = async (sectionId: string, title: string) => {
    if (expandedScripture === sectionId) {
      expandedScriptureRef.current = null;
      setExpandedScripture(null);
      setScriptureVerses(null);
      return;
    }
    const range = commentaryRange(title);
    if (!range) return;
    expandedScriptureRef.current = sectionId;
    setExpandedScripture(sectionId);
    setScriptureVerses(null);
    try {
      const bookData = await loadBook(version.code, book.code);
      if (expandedScriptureRef.current !== sectionId) return; // 已切到别的条目
      const startVerse = range.start % 1000;
      // 跨章的范围只展示当前章内的部分，避免一次贴出几十节
      const endVerse = Math.floor(range.end / 1000) === chapter ? range.end % 1000 : Number.MAX_SAFE_INTEGER;
      const verses = (bookData.chapters.get(chapter) ?? []).filter(
        (verse) => verse.verse >= startVerse && verse.verse <= endVerse,
      );
      setScriptureVerses(verses);
    } catch {
      if (expandedScriptureRef.current === sectionId) setScriptureVerses([]);
    }
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

  const renderSection = (
    { section, index, variant, range }: {
      section: CommentarySection;
      index: number;
      variant: "overview" | "detail";
      range: ReturnType<typeof commentaryRange>;
    },
  ) => {
    const sectionId = `annotation-section-${index}`;
    const topic = commentaryTopic(section.title);
    // 跨多节的条目给底色，和只讲一节的注释区分开
    const rangeClass = range?.isRange ? " is-range" : "";
    return (
      <article
        id={sectionId}
        className={`annotation-entry annotation-entry-${variant}${rangeClass}${locatedAnnotation === sectionId ? " is-located" : ""}`}
        key={`${section.title}-${index}`}
      >
        <p
          className="annotation-section-body"
          style={{ fontSize, lineHeight: annotationLineHeight }}
        >
          <button
            type="button"
            className={`annotation-reference-chip${expandedScripture === sectionId ? " is-expanded" : ""}`}
            aria-expanded={expandedScripture === sectionId}
            aria-label={`${commentaryReference(section.title)}，${expandedScripture === sectionId ? translate("收起经文") : translate("展开对应经文")}`}
            onClick={() => {
              if (suppressClickRef.current) return; // 刚完成滑动翻章，这记 click 是滑动的尾巴
              void toggleScripture(sectionId, section.title);
            }}
          >
            {commentaryReference(section.title)}
          </button>
          {topic && <strong className="annotation-entry-topic">{translate(topic)}</strong>}
          {variant === "detail" ? commentaryBody(translate(section.body)) : translate(section.body)}
        </p>
        {expandedScripture === sectionId && (
          <blockquote className="annotation-scripture-quote" style={{ fontSize: Math.max(fontSize - 2, 13) }}>
            {scriptureVerses === null && <span className="annotation-scripture-loading">{translate("正在取经文…")}</span>}
            {scriptureVerses?.length === 0 && <span className="annotation-scripture-loading">{translate("暂时取不到这段经文")}</span>}
            {scriptureVerses?.map((verse) => (
              <span className="annotation-scripture-verse" key={verse.verse}>
                <sup>{verse.label}</sup>
                {translate(stripHtml(verse.text))}
              </span>
            ))}
          </blockquote>
        )}
      </article>
    );
  };

  return (
    <div className="screen annotation-reader-screen">
      <CompactToolbar
        ariaLabel={translate("当前注释卷章与版本")}
        primary={translate(bookChipName(book, version))}
        middle={isIntroduction ? translate("绪论") : chapter}
        secondary={translate("精读本注释")}
        secondaryChip
        primaryAriaLabel={`${translate("选择书卷，当前为")}${displayedBook}`}
        middleAriaLabel={isIntroduction
          ? `${translate("选择章节，当前为")}${displayedBook}${translate("绪论")}`
          : `${translate("选择章节，当前为第")}${chapter}${translate("章")}`}
        primaryOpen={chapterPickerOpen && !pickerBookData}
        middleOpen={chapterPickerOpen && pickerBookData?.code === book.code}
        middleWide={isIntroduction}
        onPrimaryClick={() => {
          setChapterPickerOpen((open) => !(open && !pickerBookData));
          setCopyrightOpen(false);
          setFontSettingsOpen(false);
          setAudioOpen(false);
          setPickerBook(null);
        }}
        onMiddleClick={() => {
          const currentChapterPickerOpen =
            chapterPickerOpen && pickerBookData?.code === book.code;
          setChapterPickerOpen(!currentChapterPickerOpen);
          setCopyrightOpen(false);
          setFontSettingsOpen(false);
          setAudioOpen(false);
          setPickerBook(currentChapterPickerOpen ? null : book.code);
        }}
        actions={(
          <>
            <button data-icon-button="default"
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
              {audioPlaying ? <PlayingAudioIcon /> : <Icon name="volume-2" size={24} />}
            </button>
            <button data-icon-button="default"
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
            <button data-icon-button="default"
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
                          className={`bible-book-option${candidate.code === book.code ? " active" : ""}${bookName(candidate, version).length >= 7 ? " is-long" : ""}`}
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
                    <button
                      type="button"
                      className="font-size-value"
                      aria-label={translate("恢复默认字号")}
                      disabled={fontSize === 17}
                      onClick={() => setFontSize(17)}
                    >
                      {fontSize}px
                      {fontSize !== 17 && <small>{translate("恢复默认")}</small>}
                    </button>
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

      <div className="annotation-read-progress" aria-hidden="true">
        <div ref={readProgressRef} style={{ width: "0%" }} />
      </div>

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
            sections={introSections}
            loadError={loadError}
            fontSize={fontSize}
            translate={translate}
            onStart={() => gotoChapter(1)}
          />
        ) : (
          <section className="annotation-comparison-section" aria-label={translate("精读本注释阅读")}>
              {chapter === 1 && (
                <button type="button" className="annotation-book-intro-entry" onClick={() => gotoIntroduction()}>
                  <span className="annotation-book-intro-index">{translate("绪论")}</span>
                  <span className="annotation-book-intro-copy">
                    <b>{translate("读")}{displayedBook}{translate("前，先看这一篇")}</b>
                    <small>{translate("书卷档案 · 综览 · 全书大纲")}</small>
                  </span>
                  <Icon name="chevron-right" size={16} />
                </button>
              )}

              {loadError && (
                <EmptyState compact art="content" title={translate("注释加载失败")} desc={translate("请检查网络后重试。")} />
              )}
              {commentary === null && !loadError && (
                <div className="annotation-status-card">{translate("加载注释中…")}</div>
              )}
              <div
                className="annotation-comparison-list"
                onCopy={(e) => e.preventDefault()}
                onContextMenu={(e) => e.preventDefault()}
              >
                {orderedSections.map((entry) => renderSection(entry))}
              </div>
              {commentary !== null && detailCount === 0 && (
                <EmptyState compact art="content" title={translate("本章暂无更多注释")} desc={translate("可以切换到其他章节继续阅读。")} />
              )}
              {/* 读到底的顺手延续：只留轻量「下一章」，回看走顶部章节芯片或左右滑动 */}
              <div className="annotation-chapter-nav">
                <button type="button" onClick={() => gotoAdjacentChapter(1)}>
                  {chapter < maxChapter ? translate("下一章") : translate("下一卷")}
                  <Icon name="chevron-right" size={15} />
                </button>
              </div>
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
              <button data-icon-button="default"
                type="button"
                className="annotation-copyright-close"
                aria-label={translate("关闭")}
                onClick={() => setCopyrightOpen(false)}
              >
                <Icon name="x" size={20} />
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
                <dd><a href="mailto:openbible365@gmail.com">openbible365@gmail.com</a></dd>
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
