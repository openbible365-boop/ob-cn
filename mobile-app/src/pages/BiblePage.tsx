import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Icon } from "../components/Icon";
import { VerseShareSheet } from "../components/VerseShareSheet";
import { AudioGlyph } from "../components/AudioGlyph";
import {
  downloadBookAudio,
  isBookAudioCached,
  offlineAudioSupported,
  removeBookAudio,
} from "../data/offline-audio";
import { getDailyVerse } from "../data/daily-verse";
import { hapticLight } from "../native/haptics";
import { SkeletonScreen } from "../components/SkeletonScreen";
import { EmptyState } from "../components/EmptyState";
import { getStreak, markTodayRead } from "../data/streak";
import {
  BOOKS,
  VERSIONS,
  OT_BOOKS,
  NT_BOOKS,
  getVersion,
  getBookByCode,
  getReading,
  setReading,
  defaultChapterFor,
  bookName,
  bookChipName,
  loadBook,
  stripHtml,
  type BookData,
  type Verse,
} from "../data/scripture";
import {
  HIGHLIGHT_COLORS,
  getHighlights,
  setHighlight,
  clearHighlight,
  HIGHLIGHTS_CHANGED_EVENT,
  getNotes,
  addNote,
  updateNote,
  deleteNote,
} from "../data/annotations";
import { startConversation } from "../data/huidu";
import { fetchChapterAudio, type AudioTimestamp } from "../data/audio";
import {
  hasAndroidMediaControls,
  listenForAndroidMediaControls,
  requestAndroidMediaPermission,
  stopAndroidMedia,
  updateAndroidMedia,
} from "../data/android-media";
import { useSettings } from "../context/SettingsContext";
import { ANDROID_BACK_EVENT } from "../native/android-back";

const PlayingAudioIcon = () => (
  <span className="playing-audio-icon" aria-hidden="true">
    <i /><i /><i />
  </span>
);

type BibleSearchScope =
  | "all"
  | "ot"
  | "nt"
  | "law"
  | "history"
  | "wisdom"
  | "prophets"
  | "gospels"
  | "acts"
  | "letters"
  | "revelation";

type BibleSearchResult = {
  book: string;
  chapter: number;
  verse: number;
  label: string;
  text: string;
  versionCode: string;
};

type BibleSearchHistoryItem = {
  term: string;
  versionCode: string;
};

const BIBLE_SEARCH_HISTORY_KEY = "ob.bible.searchHistory";
const BIBLE_SEARCH_RESULT_LIMIT = 120;
const BIBLE_SEARCH_SCOPES: Array<{ key: BibleSearchScope; label: string }> = [
  { key: "all", label: "整本圣经" },
  { key: "ot", label: "旧约" },
  { key: "nt", label: "新约" },
  { key: "law", label: "律法书" },
  { key: "history", label: "历史书" },
  { key: "wisdom", label: "诗歌·智慧书" },
  { key: "prophets", label: "先知书" },
  { key: "gospels", label: "四福音" },
  { key: "acts", label: "使徒行传" },
  { key: "letters", label: "书信" },
  { key: "revelation", label: "启示录" },
];

function booksForSearchScope(scope: BibleSearchScope) {
  switch (scope) {
    case "ot": return BOOKS.slice(0, 39);
    case "nt": return BOOKS.slice(39);
    case "law": return BOOKS.slice(0, 5);
    case "history": return BOOKS.slice(5, 17);
    case "wisdom": return BOOKS.slice(17, 22);
    case "prophets": return BOOKS.slice(22, 39);
    case "gospels": return BOOKS.slice(39, 43);
    case "acts": return BOOKS.slice(43, 44);
    case "letters": return BOOKS.slice(44, 65);
    case "revelation": return BOOKS.slice(65, 66);
    default: return BOOKS;
  }
}

function readBibleSearchHistory(): BibleSearchHistoryItem[] {
  try {
    const stored = JSON.parse(localStorage.getItem(BIBLE_SEARCH_HISTORY_KEY) ?? "[]") as unknown;
    if (!Array.isArray(stored)) return [];
    return stored
      .filter((item): item is BibleSearchHistoryItem => (
        typeof item === "object"
        && item !== null
        && typeof (item as BibleSearchHistoryItem).term === "string"
        && typeof (item as BibleSearchHistoryItem).versionCode === "string"
      ))
      .slice(0, 8);
  } catch {
    return [];
  }
}

function highlightKeyword(text: string, keyword: string) {
  if (!keyword) return text;
  const lowerText = text.toLocaleLowerCase();
  const lowerKeyword = keyword.toLocaleLowerCase();
  const index = lowerText.indexOf(lowerKeyword);
  if (index === -1) return text;

  const start = Math.max(0, index - 15);
  const end = Math.min(text.length, index + keyword.length + 20);
  const snippet = `${start > 0 ? "…" : ""}${text.slice(start, end)}${end < text.length ? "…" : ""}`;
  const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return snippet.replace(
    new RegExp(`(${escapedKeyword})`, "gi"),
    '<mark class="bible-search-highlight">$1</mark>',
  );
}

export function BiblePage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  // Reading position: book via ?bk= (so links can target a book) with the
  // localStorage reading position as fallback; translation via localStorage.
  const reading = getReading();
  const versionCode = params.get("t") ?? reading.version;
  const bookCode = params.get("bk") ?? reading.book;
  const version = getVersion(versionCode);
  const book = getBookByCode(bookCode);
  const { isTraditional, setIsTraditional, translate } = useSettings();
  const [showHeadings, setShowHeadings] = useState(() => {
    const saved = localStorage.getItem("ob.bible.showHeadings");
    return saved === null ? true : saved === "true";
  });
  const displayBook = bookName(book, version);
  const displayedBook = translate(displayBook);

  const [data, setData] = useState<BookData | null>(null);
  const [loadError, setLoadError] = useState(false);

  const maxChapter = data?.maxChapter ?? book.chapters;
  // Without ?c=, resume where the reader left off (only meaningful when we
  // are still in that same book).
  const chapterFallback =
    book.code === reading.book ? reading.chapter : defaultChapterFor(book.code);
  const chapter = Math.min(Math.max(Number(params.get("c")) || chapterFallback, 1), maxChapter);

  const [selected, setSelected] = useState<Set<number>>(() => new Set());
  const [picker, setPicker] = useState<null | "book" | "version" | "chapter" | "search" | "audio" | "font">(null);
  const [pickerBook, setPickerBook] = useState<string | null>(null); // book focused inside the picker
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [expandedNoteVerse, setExpandedNoteVerse] = useState<number | null>(null);
  const [searchText, setSearchText] = useState("");
  const [searchResults, setSearchResults] = useState<BibleSearchResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchScope, setSearchScope] = useState<BibleSearchScope>("all");
  const [searchHistory, setSearchHistory] = useState<BibleSearchHistoryItem[]>(readBibleSearchHistory);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const searchRequestRef = useRef(0);
  const readingScrollRef = useRef<HTMLDivElement>(null);
  const verseActionSheetRef = useRef<HTMLDivElement>(null);
  const activeChapterButtonRef = useRef<HTMLButtonElement>(null);
  const swipeStartRef = useRef<{
    x: number;
    y: number;
    pointerId: number;
  } | null>(null);
  const suppressVerseClickRef = useRef(false);
  const [fontSize, setFontSize] = useState(() => {
    // 16–24 逐级可调，默认 18（375 宽约每行 18 字）。
    // 旧版每次进页都会把字号写回存储，存着的 19 多半只是旧默认值而不是用户选的，
    // 所以迁移时只把 19 换成新默认 18，主动调过的 17/21/23 原样保留。
    const saved = Number(localStorage.getItem("ob.bible.fontSize.v2") ?? (() => {
      const legacy = Number(localStorage.getItem("ob.bible.fontSize"));
      return legacy === 19 ? 18 : legacy;
    })());
    return Number.isInteger(saved) && saved >= 16 && saved <= 24 ? saved : 18;
  });
  const [storeVersion, setStoreVersion] = useState(0); // bump to re-read stores
  const audioRef = useRef<HTMLAudioElement>(null);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioSpeed, setAudioSpeed] = useState(1);
  const [audioVoice, setAudioVoice] = useState("female");
  const [resolvedAudioVoice, setResolvedAudioVoice] = useState("");
  const [audioRequestVersion, setAudioRequestVersion] = useState(0);
  const [voiceMenuOpen, setVoiceMenuOpen] = useState(false);
  const [audioUrl, setAudioUrl] = useState("");
  const [audioTimestamps, setAudioTimestamps] = useState<AudioTimestamp[]>([]);
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioError, setAudioError] = useState("");
  const [audioCacheBusy, setAudioCacheBusy] = useState<{ done: number; total: number } | null>(null);
  const [audioCacheReady, setAudioCacheReady] = useState(false);
  // 正在播放的章节标签：面板关闭后切章浏览时，迷你条仍如实显示音频来源
  const [audioSourceLabel, setAudioSourceLabel] = useState("");
  // 顶栏滚动收起：向下滚隐藏、向上滚或回到顶部恢复
  const [toolbarHidden, setToolbarHidden] = useState(false);
  const readProgressRef = useRef<HTMLDivElement | null>(null);
  const lastScrollTopRef = useRef(0);
  // 今日金句卡：当天手动收起后不再出现，次日自动回来。
  // 用本地日期而非 toISOString（UTC）——否则晚八点后就跨天错乱
  const todayDate = new Date();
  const todayKey = `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, "0")}-${String(todayDate.getDate()).padStart(2, "0")}`;
  const [dailyDismissed, setDailyDismissed] = useState(() => {
    try { return localStorage.getItem("ob.daily-card-dismissed") === todayKey; } catch { return false; }
  });
  const [dailyShareOpen, setDailyShareOpen] = useState(false);
  // 金句默认只占一行，点开才展开整张卡，首屏留给经文
  const [dailyExpanded, setDailyExpanded] = useState(false);
  // 操作条「更多」
  const [moreOpen, setMoreOpen] = useState(false);
  const dailyVerse = getDailyVerse();
  const readStreak = getStreak();
  const [locatedVerse, setLocatedVerse] = useState<number | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [loadedAudioKey, setLoadedAudioKey] = useState<string | null>(null);
  // 离线缓存章节的音频是 ObjectURL，换章时释放上一章的 MP3 内存
  useEffect(() => {
    if (!audioUrl.startsWith("blob:")) return;
    return () => URL.revokeObjectURL(audioUrl);
  }, [audioUrl]);
  const androidMediaStartedRef = useRef(false);
  const continueAudioAfterLoadRef = useRef(false);

  // 安卓返回键：开着的弹层逐层关闭，全关完才轮到路由回退
  useEffect(() => {
    const closeTopOverlay = (event: Event) => {
      const close =
        (shareOpen && (() => setShareOpen(false)))
        || (dailyShareOpen && (() => setDailyShareOpen(false)))
        || (noteOpen && (() => setNoteOpen(false)))
        || (moreOpen && (() => setMoreOpen(false)))
        || (picker !== null && (() => { setPicker(null); setPickerBook(null); }))
        || (selected.size > 0 && (() => setSelected(new Set())));
      if (close) {
        event.preventDefault();
        close();
      }
    };
    window.addEventListener(ANDROID_BACK_EVENT, closeTopOverlay);
    return () => window.removeEventListener(ANDROID_BACK_EVENT, closeTopOverlay);
  }, [shareOpen, dailyShareOpen, noteOpen, moreOpen, picker, selected]);

  useEffect(() => {
    if (picker === "search") return;
    searchRequestRef.current += 1;
    setSearchResults([]);
    setHasSearched(false);
    setSearchQuery("");
    setSearchText("");
    setSearchLoading(false);
    setSearchError("");
  }, [picker]);

  useEffect(() => {
    const refresh = () => setStoreVersion((value) => value + 1);
    window.addEventListener(HIGHLIGHTS_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(HIGHLIGHTS_CHANGED_EVENT, refresh);
  }, []);

  useEffect(() => {
    setReading({ version: version.code, book: book.code, chapter });
  }, [version.code, book.code, chapter]);

  useEffect(() => {
    readingScrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [book.code, chapter]);

  useEffect(() => {
    setData(null);
    setLoadError(false);
    let cancelled = false;
    loadBook(version.code, book.code)
      .then((d) => { if (!cancelled) setData(d); })
      .catch(() => { if (!cancelled) setLoadError(true); });
    return () => { cancelled = true; };
  }, [version.code, book.code]);

  useEffect(() => {
    localStorage.setItem("ob.bible.fontSize.v2", String(fontSize));
  }, [fontSize]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.playbackRate = audioSpeed;
  }, [audioSpeed]);



  useEffect(() => {
    localStorage.setItem("ob.bible.showHeadings", String(showHeadings));
  }, [showHeadings]);

  useEffect(() => {
    if (picker !== "audio" && !continueAudioAfterLoadRef.current) return;
    const currentKey = `${version.code}-${book.code}-${chapter}-${audioVoice}-${audioRequestVersion}`;
    if (loadedAudioKey === currentKey) return;

    const audio = audioRef.current;
    audio?.pause();
    setAudioPlaying(false);
    setAudioCurrentTime(0);
    setAudioDuration(0);
    setAudioUrl("");
    setAudioTimestamps([]);
    setResolvedAudioVoice("");
    setAudioError("");

    if (version.code !== "cuv") {
      continueAudioAfterLoadRef.current = false;
      setLoadedAudioKey(null);
      setAudioError("当前仅和合本提供语音圣经");
      return;
    }

    let cancelled = false;
    setAudioLoading(true);
    fetchChapterAudio(version.code, book.code, chapter, audioVoice)
      .then((result) => {
        if (cancelled) return;
        setAudioUrl(result.audioUrl);
        setAudioTimestamps(result.timestamps);
        setResolvedAudioVoice(result.voice);
        setAudioSourceLabel(`${displayedBook} ${chapter}`);
        setLoadedAudioKey(currentKey);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          continueAudioAfterLoadRef.current = false;
          setAudioError(error instanceof Error ? error.message : "当前章节暂无音频");
          setLoadedAudioKey(null);
        }
      })
      .finally(() => { if (!cancelled) setAudioLoading(false); });
    return () => { cancelled = true; };
  }, [picker, version.code, book.code, chapter, audioVoice, audioRequestVersion, loadedAudioKey]);

  useEffect(() => {
    const linkedVerse = Number(params.get("v"));
    if (!data || !linkedVerse) return;
    setLocatedVerse(linkedVerse);
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(`bible-verse-${linkedVerse}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    const timeout = window.setTimeout(() => setLocatedVerse((value) => value === linkedVerse ? null : value), 2200);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
    };
  }, [data, params]);

  const displayedAudioVoice = resolvedAudioVoice || audioVoice;

  // 换书卷或换音色后重查整卷缓存状态
  useEffect(() => {
    setAudioCacheReady(isBookAudioCached(book.code, displayedAudioVoice));
  }, [book.code, displayedAudioVoice]);
  const chooseAudioVoice = (voice: string) => {
    setVoiceMenuOpen(false);
    setResolvedAudioVoice("");
    if (voice === audioVoice) setAudioRequestVersion((value) => value + 1);
    else setAudioVoice(voice);
  };

  const verses: Verse[] = useMemo(
    () => data?.chapters.get(chapter) ?? [],
    [data, chapter],
  );
  const highlights = useMemo(() => {
    void storeVersion;
    return getHighlights().filter((h) => h.book === book.code && h.chapter === chapter);
  }, [book.code, chapter, storeVersion]);
  const highlightMap = new Map(highlights.map((h) => [h.verse, h.color]));
  const notes = useMemo(() => {
    void storeVersion;
    return getNotes().filter((n) => n.book === book.code && n.chapter === chapter);
  }, [book.code, chapter, storeVersion]);
  const noteVerseNumbers = new Set(notes.map((note) => note.verse));

  const selectedNumbers = [...selected].sort((a, b) => a - b);
  const selectedRangeLabel = (() => {
    const ranges: string[] = [];
    for (let index = 0; index < selectedNumbers.length; index += 1) {
      const start = selectedNumbers[index];
      let end = start;
      while (index + 1 < selectedNumbers.length && selectedNumbers[index + 1] === end + 1) {
        end = selectedNumbers[index + 1];
        index += 1;
      }
      ranges.push(start === end ? String(start) : `${start}-${end}`);
    }
    return ranges.join("、");
  })();
  const selectedVerses = selectedNumbers
    .map((verseNumber) => verses.find((verse) => verse.verse === verseNumber))
    .filter((verse): verse is Verse => Boolean(verse));
  const selectedVerse = selectedVerses[0] ?? null;
  const selectedNotes = notes.filter((note) => selected.has(note.verse));

  useEffect(() => {
    const scroller = readingScrollRef.current;
    const sheet = verseActionSheetRef.current;
    if (!scroller || !sheet || selected.size === 0) return;

    let revealFrame = 0;
    const revealSelectedVerse = () => {
      window.cancelAnimationFrame(revealFrame);
      revealFrame = window.requestAnimationFrame(() => {
        const targetVerse = Math.max(...selected);
        const verseElement = document.getElementById(`bible-verse-${targetVerse}`);
        if (!verseElement || !scroller.contains(verseElement)) return;

        const scrollerRect = scroller.getBoundingClientRect();
        const sheetRect = sheet.getBoundingClientRect();
        const verseRect = verseElement.getBoundingClientRect();
        const visibleTop = scrollerRect.top + 12;
        const visibleBottom = Math.min(scrollerRect.bottom, sheetRect.top) - 16;

        if (verseRect.bottom > visibleBottom) {
          scroller.scrollBy({
            top: verseRect.bottom - visibleBottom,
            behavior: "smooth",
          });
        } else if (verseRect.top < visibleTop) {
          scroller.scrollBy({
            top: verseRect.top - visibleTop,
            behavior: "smooth",
          });
        }
      });
    };

    revealSelectedVerse();
    const resizeObserver = new ResizeObserver(revealSelectedVerse);
    resizeObserver.observe(sheet);
    resizeObserver.observe(scroller);

    return () => {
      resizeObserver.disconnect();
      window.cancelAnimationFrame(revealFrame);
    };
  }, [selected, noteOpen]);

  const openNoteEditor = (
    verseNumber: number,
    existing?: (typeof notes)[number],
    preserveSelection = false,
  ) => {
    if (!preserveSelection) {
      setSelected(new Set([verseNumber]));
    }
    setNoteText(existing?.content ?? "");
    setEditingNoteId(existing?.id ?? null);
    setNoteOpen(true);
  };
  const toggleVerseSelection = (verseNumber: number) => {
    hapticLight();
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(verseNumber)) next.delete(verseNumber);
      else next.add(verseNumber);
      return next;
    });
    setNoteOpen(false);
    setNoteText("");
    setEditingNoteId(null);
  };

  const gotoChapter = (c: number, bk?: string) => {
    setParams({ t: version.code, bk: bk ?? book.code, c: String(c) });
    setSelected(new Set());
    setPicker(null);
    setPickerBook(null);
  };

  const gotoAdjacentChapter = (direction: -1 | 1) => {
    const bookIndex = BOOKS.findIndex((candidate) => candidate.code === book.code);
    if (direction < 0) {
      if (chapter > 1) {
        gotoChapter(chapter - 1);
      } else if (bookIndex > 0) {
        const previousBook = BOOKS[bookIndex - 1];
        gotoChapter(previousBook.chapters, previousBook.code);
      }
      return;
    }

    if (chapter < maxChapter) {
      gotoChapter(chapter + 1);
    } else if (bookIndex >= 0 && bookIndex < BOOKS.length - 1) {
      gotoChapter(1, BOOKS[bookIndex + 1].code);
    }
  };

  const handleReadingPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary || (event.pointerType === "mouse" && event.button !== 0)) return;
    // 左右边缘 24px 让给系统手势（iOS 侧滑返回 / Android 手势导航），不当作翻章起点
    if (event.clientX < 24 || event.clientX > window.innerWidth - 24) return;
    swipeStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      pointerId: event.pointerId,
    };
  };

  const handleReadingPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    if (!start || start.pointerId !== event.pointerId || !event.isPrimary) return;

    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    if (Math.abs(deltaX) < 64 || Math.abs(deltaX) < Math.abs(deltaY) * 1.35) return;

    suppressVerseClickRef.current = true;
    window.setTimeout(() => {
      suppressVerseClickRef.current = false;
    }, 0);
    hapticLight();
    gotoAdjacentChapter(deltaX < 0 ? 1 : -1);
  };

  const gotoVersion = (t: string) => {
    setParams({ t, bk: book.code, c: String(chapter) });
    setPicker(null);
  };

  // 紧凑操作条无关闭键（与画布一致）：再点已选经文即取消选择
  const saveSearchHistory = (term: string, targetVersionCode: string) => {
    setSearchHistory((current) => {
      const next = [
        { term, versionCode: targetVersionCode },
        ...current.filter((item) => (
          item.term !== term || item.versionCode !== targetVersionCode
        )),
      ].slice(0, 8);
      localStorage.setItem(BIBLE_SEARCH_HISTORY_KEY, JSON.stringify(next));
      return next;
    });
  };

  const clearSearchHistory = () => {
    localStorage.removeItem(BIBLE_SEARCH_HISTORY_KEY);
    setSearchHistory([]);
  };

  const submitSearch = async (queryOverride?: string, versionOverride?: string) => {
    const query = (queryOverride ?? searchText).trim();
    if (!query) return;

    const targetVersion = getVersion(versionOverride ?? version.code);
    const m = query.match(/^(\d+)\s*[:：]\s*(\d+)$/);
    if (m) {
      const c = Math.min(Math.max(Number(m[1]), 1), maxChapter);
      const verse = Math.max(Number(m[2]), 1);
      saveSearchHistory(query, targetVersion.code);
      setParams({ t: targetVersion.code, bk: book.code, c: String(c), v: String(verse) });
      setSelected(new Set([verse]));
      setSearchText("");
      setSearchResults([]);
      setHasSearched(false);
      setPicker(null);
      return;
    }

    const requestId = searchRequestRef.current + 1;
    searchRequestRef.current = requestId;
    setSearchQuery(query);
    setSearchLoading(true);
    setSearchError("");
    setHasSearched(false);
    setSearchResults([]);
    saveSearchHistory(query, targetVersion.code);

    const normalizedQuery = query.toLocaleLowerCase();
    const scopedBooks = booksForSearchScope(searchScope);
    const results: BibleSearchResult[] = [];
    let failedBooks = 0;

    for (let offset = 0; offset < scopedBooks.length && results.length < BIBLE_SEARCH_RESULT_LIMIT; offset += 6) {
      const batch = scopedBooks.slice(offset, offset + 6);
      const loaded = await Promise.allSettled(
        batch.map((targetBook) => loadBook(targetVersion.code, targetBook.code)),
      );
      if (requestId !== searchRequestRef.current) return;

      loaded.forEach((outcome, index) => {
        if (results.length >= BIBLE_SEARCH_RESULT_LIMIT) return;
        if (outcome.status === "rejected") {
          failedBooks += 1;
          return;
        }
        const targetBook = batch[index];
        for (const [chapterNumber, chapterVerses] of outcome.value.chapters.entries()) {
          for (const verse of chapterVerses) {
            const plainText = stripHtml(verse.text);
            if (!plainText.toLocaleLowerCase().includes(normalizedQuery)) continue;
            results.push({
              book: targetBook.code,
              chapter: chapterNumber,
              verse: verse.verse,
              label: verse.label,
              text: plainText,
              versionCode: targetVersion.code,
            });
            if (results.length >= BIBLE_SEARCH_RESULT_LIMIT) return;
          }
          if (results.length >= BIBLE_SEARCH_RESULT_LIMIT) return;
        }
      });
    }

    if (requestId !== searchRequestRef.current) return;
    setSearchResults(results);
    setHasSearched(true);
    setSearchLoading(false);
    if (failedBooks === scopedBooks.length) {
      setSearchError("经文数据暂时无法读取，请稍后重试");
    } else if (failedBooks > 0) {
      setSearchError(`有 ${failedBooks} 卷经文暂时无法读取，以下为已完成的结果`);
    }
  };

  const openSearchResult = (result: BibleSearchResult) => {
    setParams({
      t: result.versionCode,
      bk: result.book,
      c: String(result.chapter),
      v: String(result.verse),
    });
    setSelected(new Set([result.verse]));
    setSearchText("");
    setSearchResults([]);
    setHasSearched(false);
    setPicker(null);
  };

  const askHuidu = () => {
    if (selectedVerses.length === 0 || !selectedVerse) return;
    const fullVerseText = selectedVerses.map(v => `${v.label}节：${stripHtml(v.text)}`).join("\n\n");
    const customRef = `${displayedBook} ${chapter}:${selectedRangeLabel}`;
    const conv = startConversation(
      displayedBook,
      chapter,
      selectedVerse.verse,
      fullVerseText,
      customRef,
      { bookCode: book.code, versionCode: version.code },
    );
    navigate(`/huidu/${conv.id}`, { state: { justCreated: true } });
  };

  const copyVerse = async () => {
    if (selectedVerses.length === 0) return;
    const text = selectedVerses
      .map((verse) => `${displayedBook} ${chapter}:${verse.label} ${stripHtml(translate(verse.text))}`)
      .join("\n");
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* clipboard unavailable */
    }
    setMoreOpen(false);
    setSelected(new Set());
  };

  const pickerBookData = pickerBook ? getBookByCode(pickerBook) : null;

  useEffect(() => {
    if (
      picker !== "chapter"
      || pickerBookData?.code !== book.code
      || !activeChapterButtonRef.current
    ) return;

    activeChapterButtonRef.current.scrollIntoView({
      block: "nearest",
      inline: "nearest",
    });
  }, [book.code, picker, pickerBookData?.code]);

  const formatAudioTime = (seconds: number) => {
    const wholeSeconds = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
    return `${Math.floor(wholeSeconds / 60)}:${String(wholeSeconds % 60).padStart(2, "0")}`;
  };
  const audioProgress = audioDuration > 0 ? Math.min(100, audioCurrentTime / audioDuration * 100) : 0;
  const audioCurrentTimeSecond = Math.floor(audioCurrentTime);
  const timestampDuration = audioTimestamps.at(-1)?.end ?? 0;
  const timestampTime = audioDuration > 0 && timestampDuration > 0
    ? audioCurrentTime * timestampDuration / audioDuration
    : audioCurrentTime;
  const timestampVerse = audioTimestamps.find((item) => timestampTime >= item.start && timestampTime < item.end)
    ?? (timestampTime > 0 ? audioTimestamps.at(-1) : null);
  const fallbackAudioIndex = Math.min(
    Math.max(verses.length - 1, 0),
    Math.floor(audioProgress / 100 * Math.max(verses.length, 1)),
  );
  const audioCurrentVerse = verses.find((verse) => verse.verse === timestampVerse?.verse)
    ?? verses[fallbackAudioIndex]
    ?? verses[0]
    ?? null;
  const audioCurrentVerseNumber = audioCurrentVerse?.verse ?? null;
  const audioCurrentVerseText = audioCurrentVerse ? stripHtml(audioCurrentVerse.text) : "";

  useEffect(() => {
    if (
      !audioUrl
      || !audioCurrentVerse
      || !("mediaSession" in navigator)
      || typeof MediaMetadata === "undefined"
    ) {
      return;
    }

    navigator.mediaSession.metadata = new MediaMetadata({
      title: `${displayedBook} ${chapter}:${audioCurrentVerse.label} · ${version.label}`,
      artist: audioCurrentVerseText,
      album: "OpenBible · 语音圣经",
      artwork: hasAndroidMediaControls() ? [] : [
        {
          src: new URL("/openbible-now-playing.png", window.location.href).href,
          sizes: "1024x1024",
          type: "image/png",
        },
      ],
    });
  }, [
    audioUrl,
    displayedBook,
    chapter,
    version.label,
    audioCurrentVerse,
    audioCurrentVerseText,
  ]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.playbackState = audioPlaying ? "playing" : "paused";
  }, [audioPlaying]);

  useEffect(() => {
    if (!hasAndroidMediaControls()) return;
    let handle: Awaited<ReturnType<typeof listenForAndroidMediaControls>> | null = null;
    let cancelled = false;
    listenForAndroidMediaControls((event) => {
      const audio = audioRef.current;
      if (!audio) return;
      if (event.action === "play") void audio.play();
      else if (event.action === "pause") audio.pause();
      else if (event.action === "stop") {
        audio.pause();
        void stopAndroidMedia();
        androidMediaStartedRef.current = false;
      } else if (event.action === "seekBackward") seekAudio(-30);
      else if (event.action === "seekForward") seekAudio(30);
      else if (event.action === "seekTo" && typeof event.positionMs === "number") {
        audio.currentTime = Math.min(audio.duration || 0, Math.max(0, event.positionMs / 1000));
      }
    }).then((listenerHandle) => {
      if (cancelled) void listenerHandle.remove();
      else handle = listenerHandle;
    });
    return () => {
      cancelled = true;
      void handle?.remove();
      if (androidMediaStartedRef.current) {
        void stopAndroidMedia();
        androidMediaStartedRef.current = false;
      }
    };
  }, []);

  useEffect(() => {
    if (!hasAndroidMediaControls() || !audioUrl || !audioCurrentVerse) return;
    let cancelled = false;
    const updateNativeMedia = async () => {
      if (audioPlaying && !androidMediaStartedRef.current) {
        await requestAndroidMediaPermission();
        if (cancelled) return;
        androidMediaStartedRef.current = true;
      }
      if (!androidMediaStartedRef.current) return;
      try {
        await updateAndroidMedia({
          title: `${displayedBook} ${chapter}:${audioCurrentVerse.label} · ${version.label}`,
          text: audioCurrentVerseText,
          album: "OpenBible · 语音圣经",
          playing: audioPlaying,
          durationMs: Math.round(audioDuration * 1000),
          positionMs: audioCurrentTimeSecond * 1000,
          speed: audioSpeed,
        });
      } catch {
        // Android media controls must not interrupt in-app audio playback.
      }
    };
    void updateNativeMedia();
    return () => { cancelled = true; };
  }, [
    audioUrl,
    audioPlaying,
    audioDuration,
    audioCurrentTimeSecond,
    audioSpeed,
    displayedBook,
    chapter,
    version.label,
    audioCurrentVerse,
    audioCurrentVerseText,
  ]);

  useEffect(() => {
    if (!audioPlaying || picker === "audio" || audioCurrentVerseNumber === null) return;
    const verseNumber = audioCurrentVerseNumber;
    const frame = window.requestAnimationFrame(() => {
      document
        .getElementById(`bible-verse-${verseNumber}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [audioPlaying, audioCurrentVerseNumber, picker]);

  // 歌词式视图只露三节：上一节 / 当前节 / 下一节，播放推进时窗口自动跟随
  const audioLyricIndex = Math.max(
    0,
    verses.findIndex((verse) => verse.verse === audioCurrentVerseNumber),
  );
  const audioLyricWindow = verses.slice(
    Math.max(0, audioLyricIndex - 1),
    audioLyricIndex + 2,
  );

  useEffect(() => {
    if (
      !("mediaSession" in navigator)
      || typeof navigator.mediaSession.setPositionState !== "function"
      || audioDuration <= 0
    ) {
      return;
    }
    try {
      navigator.mediaSession.setPositionState({
        duration: audioDuration,
        playbackRate: audioSpeed,
        position: Math.min(audioDuration, Math.max(0, audioCurrentTime)),
      });
    } catch {
      // Some WebKit versions expose Media Session without position updates.
    }
  }, [audioCurrentTime, audioDuration, audioSpeed]);

  const seekAudio = (seconds: number) => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(audio.duration)) return;
    audio.currentTime = Math.min(audio.duration, Math.max(0, audio.currentTime + seconds));
  };
  const toggleAudio = async () => {
    const audio = audioRef.current;
    if (!audio || !audioUrl) return;
    try {
      if (audio.paused) await audio.play();
      else audio.pause();
    } catch {
      setAudioError("音频播放失败，请检查网络后重试");
    }
  };
  const closeAudio = () => {
    setVoiceMenuOpen(false);
    setPicker(null);
  };
  // 上一章/下一章支持跨书卷：自动续播本来就会跨卷，手动按钮在卷首卷尾
  // 却被禁用，行为不一致——创世记 50 章的下一章就是出埃及记 1 章。
  const audioBookIndex = BOOKS.findIndex((item) => item.code === book.code);
  const prevAudioTarget = chapter > 1
    ? { bookCode: book.code, chapter: chapter - 1 }
    : audioBookIndex > 0
      ? { bookCode: BOOKS[audioBookIndex - 1].code, chapter: BOOKS[audioBookIndex - 1].chapters }
      : null;
  const nextAudioTarget = chapter < maxChapter
    ? { bookCode: book.code, chapter: chapter + 1 }
    : audioBookIndex < BOOKS.length - 1
      ? { bookCode: BOOKS[audioBookIndex + 1].code, chapter: 1 }
      : null;
  const gotoAudioTarget = (target: { bookCode: string; chapter: number } | null) => {
    if (!target) return;
    continueAudioAfterLoadRef.current = false;
    audioRef.current?.pause();
    setParams({ t: version.code, bk: target.bookCode, c: String(target.chapter) });
    setSelected(new Set());
  };
  // 整卷音频缓存：把当前书卷全部章节（当前音色）缓存到本机，离线可听。
  // 单章 mp3 走跨域 CDN，一律经同域代理 /api/mobile/audio/file 拉取。
  const cacheBookAudio = async () => {
    if (audioCacheBusy) return;
    if (audioCacheReady) {
      if (!window.confirm(`已缓存《${displayedBook}》整卷音频。删除本卷离线音频？`)) return;
      await removeBookAudio(version.code, book.code, book.chapters, displayedAudioVoice);
      setAudioCacheReady(false);
      return;
    }
    if (!offlineAudioSupported()) {
      setAudioError("当前环境不支持离线缓存");
      return;
    }
    setAudioCacheBusy({ done: 0, total: book.chapters });
    try {
      await downloadBookAudio(
        version.code,
        book.code,
        book.chapters,
        displayedAudioVoice,
        (done, total) => setAudioCacheBusy({ done, total }),
      );
      setAudioCacheReady(true);
    } catch (error) {
      setAudioError(error instanceof Error ? error.message : "整卷缓存失败，请检查网络后重试");
    } finally {
      setAudioCacheBusy(null);
    }
  };
  const continueToNextAudioChapter = () => {
    const bookIndex = BOOKS.findIndex((item) => item.code === book.code);
    const nextBook = chapter < maxChapter ? book : BOOKS[bookIndex + 1];
    if (!nextBook) {
      continueAudioAfterLoadRef.current = false;
      return;
    }
    const nextChapter = chapter < maxChapter ? chapter + 1 : 1;
    continueAudioAfterLoadRef.current = true;
    setParams({ t: version.code, bk: nextBook.code, c: String(nextChapter) });
    setSelected(new Set());
  };
  // 歌词式视图：点某节从该节开始听（有时间戳才可点）
  const seekToVerse = (verseNumber: number) => {
    const audio = audioRef.current;
    const stamp = audioTimestamps.find((item) => item.verse === verseNumber);
    if (!audio || !stamp || !Number.isFinite(audio.duration)) return;
    audio.currentTime = Math.min(audio.duration, stamp.start + 0.01);
  };
  const locateAudioVerse = () => {
    if (!audioCurrentVerse) return;
    const verseNumber = audioCurrentVerse.verse;
    closeAudio();
    setLocatedVerse(verseNumber);
    window.requestAnimationFrame(() => {
      document.getElementById(`bible-verse-${verseNumber}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    window.setTimeout(() => setLocatedVerse((value) => value === verseNumber ? null : value), 1800);
  };

  return (
    <div className="screen">
      <audio
        ref={audioRef}
        src={audioUrl || undefined}
        preload="metadata"
        onLoadedMetadata={(event) => {
          setAudioDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0);
          event.currentTarget.playbackRate = audioSpeed;
        }}
        onCanPlay={(event) => {
          if (!continueAudioAfterLoadRef.current) return;
          continueAudioAfterLoadRef.current = false;
          void event.currentTarget.play().catch(() => {
            setAudioError("下一章自动播放失败，请点击播放继续");
          });
        }}
        onTimeUpdate={(event) => {
          const time = event.currentTarget.currentTime;
          // timeupdate 约 4 次/秒，每次都会整页重渲；歌词按节高亮，半秒粒度足够
          setAudioCurrentTime((prev) => (Math.abs(time - prev) >= 0.5 || time === 0 ? time : prev));
        }}
        onPlay={() => setAudioPlaying(true)}
        onPause={() => setAudioPlaying(false)}
        onEnded={() => {
          setAudioPlaying(false);
          continueToNextAudioChapter();
        }}
        onError={() => {
          continueAudioAfterLoadRef.current = false;
          if (audioUrl) setAudioError("音频文件加载失败，请稍后重试");
        }}
      />
      {/* reading toolbar */}
      <div className={`bible-toolbar${toolbarHidden ? " is-hidden" : ""}`} inert={toolbarHidden || undefined}>
        <div className="bible-reader-selectors" aria-label="经卷章节及译本选择">
          <button
            className={`bible-reader-selector book${picker === "book" ? " is-open" : ""}`}
            onClick={() => {
              setPicker(picker === "book" ? null : "book");
              setPickerBook(null);
            }}
            aria-label={`选择书卷，当前为${displayedBook}`}
            aria-expanded={picker === "book"}
          >
            {translate(bookChipName(book, version))}
          </button>
          <button
            className={`bible-reader-selector chapter-number is-wide${picker === "chapter" ? " is-open" : ""}`}
            onClick={() => {
              if (picker === "chapter") {
                setPicker(null);
                setPickerBook(null);
                return;
              }
              setPicker("chapter");
              setPickerBook(book.code);
            }}
            aria-label={`选择章节，当前为${displayedBook}第${chapter}章`}
            aria-expanded={picker === "chapter"}
          >
            {chapter}
          </button>
          <button
            className={`bible-reader-selector version${picker === "version" ? " is-open" : ""}`}
            onClick={() => setPicker(picker === "version" ? null : "version")}
            aria-label={`选择译本，当前为${version.label}`}
          >
            {version.label}
          </button>
        </div>

        <div className="bible-toolbar-actions" aria-label="阅读工具">
          <button data-icon-button="default"
            className="bible-toolbar-action"
            title="有声圣经"
            aria-label="有声圣经"
            onClick={() => setPicker("audio")}
          >
            {audioPlaying ? <PlayingAudioIcon /> : <Icon name="volume-2" size={24} />}
          </button>
          <button data-icon-button="default"
            className="bible-toolbar-action"
            title="搜索"
            aria-label="搜索经文"
            aria-expanded={picker === "search"}
            onClick={() => setPicker(picker === "search" ? null : "search")}
          >
            <Icon name="search" size={20} />
          </button>
          <button data-icon-button="default"
            className="bible-toolbar-action"
            title="字体设置"
            aria-label="字体设置"
            aria-expanded={picker === "font"}
            onClick={() => setPicker(picker === "font" ? null : "font")}
          >
            <span className="bible-font-mark" aria-hidden="true">
              <span className="small-a">A</span><span className="large-a">A</span>
            </span>
          </button>
        </div>

        {/* 章内阅读进度：2px 金色细线，随滚动更新位置感 */}
      <div className="bible-read-progress" aria-hidden="true">
        <div ref={readProgressRef} style={{ width: "0%" }} />
      </div>

      {picker === "version" && (
          <div className="bible-version-picker">
            <div className="bible-popup-title">选择译本</div>
            {VERSIONS.map((ver) => (
              <button
                key={ver.code}
                type="button"
                className={`bible-version-option${ver.code === version.code ? " active" : ""}`}
                onClick={() => gotoVersion(ver.code)}
              >
                {ver.label}
                {ver.code === version.code && <Icon name="check" size={16} />}
              </button>
            ))}
            {/* 列表尾部通往资源管理：译本的离线下载都在那里 */}
            <button
              type="button"
              className="bible-version-add"
              onClick={() => { setPicker(null); navigate("/me/resources"); }}
            >
              <Icon name="download" size={15} />
              添加译本
            </button>
          </div>
        )}

        {(picker === "book" || picker === "chapter") && (
          <div className={`bible-chapter-picker ${picker === "chapter" ? "chapter-list" : "book-list"}`}>
            {picker === "chapter" && pickerBookData ? (
              <>
                <div className="bible-popup-title">{bookName(pickerBookData, version)} · 选择章</div>
                <div className="bible-chapter-grid">
                  {Array.from({ length: pickerBookData.chapters }, (_, i) => i + 1).map((n) => (
                    <button
                      key={n}
                      type="button"
                      ref={pickerBookData.code === book.code && n === chapter ? activeChapterButtonRef : undefined}
                      className={pickerBookData.code === book.code && n === chapter ? "active" : undefined}
                      onClick={() => gotoChapter(n, pickerBookData.code)}
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
                          onClick={() => gotoChapter(bk.code === book.code ? chapter : 1, bk.code)}
                          className={`bible-book-option${bk.code === book.code ? " active" : ""}${bookName(bk, version).length >= 7 ? " is-long" : ""}`}
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

        {picker === "search" && (
          <section
            className="bible-search-panel"
            role="dialog"
            aria-modal="true"
            aria-label="搜索圣经"
          >
            <header className="bible-search-header">
              <form
                className="bible-search-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  void submitSearch();
                }}
              >
                <label className="bible-search-field">
                  <Icon name="search" size={20} />
                  <input
                    autoFocus
                    aria-label="搜索圣经"
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    placeholder="请输入要搜索的文字"
                  />
                  {searchText && (
                    <button data-icon-button="default"
                      type="button"
                      className="bible-search-clear"
                      aria-label="清空搜索文字"
                      onClick={() => {
                        searchRequestRef.current += 1;
                        setSearchText("");
                        setSearchResults([]);
                        setHasSearched(false);
                        setSearchQuery("");
                        setSearchLoading(false);
                        setSearchError("");
                      }}
                    >
                      <Icon name="x" size={16} />
                    </button>
                  )}
                </label>
                <button type="submit" className="sr-only">搜索</button>
              </form>
              <button
                type="button"
                className="bible-search-cancel"
                onClick={() => setPicker(null)}
              >
                取消
              </button>
            </header>

            <div className="bible-search-filters">
              <label className="bible-search-version">
                <span className="sr-only">搜索译本</span>
                <select
                  aria-label="搜索译本"
                  value={version.code}
                  onChange={(event) => {
                    searchRequestRef.current += 1;
                    setParams({ t: event.target.value, bk: book.code, c: String(chapter) });
                    setSearchResults([]);
                    setHasSearched(false);
                    setSearchQuery("");
                    setSearchLoading(false);
                    setSearchError("");
                  }}
                >
                  {VERSIONS.map((targetVersion) => (
                    <option key={targetVersion.code} value={targetVersion.code}>
                      {targetVersion.label}
                    </option>
                  ))}
                </select>
                <span aria-hidden="true">▾</span>
              </label>
              <div className="bible-search-scopes" role="tablist" aria-label="搜索范围">
                {BIBLE_SEARCH_SCOPES.map((scope) => (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={searchScope === scope.key}
                    className={searchScope === scope.key ? "active" : ""}
                    key={scope.key}
                    onClick={() => {
                      searchRequestRef.current += 1;
                      setSearchScope(scope.key);
                      setSearchResults([]);
                      setHasSearched(false);
                      setSearchQuery("");
                      setSearchLoading(false);
                      setSearchError("");
                    }}
                  >
                    {scope.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="bible-search-content" aria-live="polite">
              {searchLoading && (
                <div className="bible-search-status" role="status">
                  <span className="bible-search-spinner" aria-hidden="true" />
                  正在搜索经文…
                </div>
              )}

              {searchError && (
                <div className="bible-search-error" role="alert">{searchError}</div>
              )}

              {!hasSearched && !searchLoading && (
                <section className="bible-search-history">
                  {searchHistory.length > 0 && (
                    <div className="bible-search-section-heading">
                      <h2>搜索历史</h2>
                      <button data-icon-button="danger"
                        type="button"
                        aria-label="清空搜索历史"
                        onClick={clearSearchHistory}
                      >
                        <Icon name="trash" size={20} />
                      </button>
                    </div>
                  )}
                  {searchHistory.length === 0 ? (
                    <EmptyState compact art="search" title="输入关键词，搜索整本圣经" desc="也可以输入“章:节”，快速跳到当前书卷" />
                  ) : (
                    <div className="bible-search-history-list">
                      {searchHistory.map((item) => (
                        <button
                          type="button"
                          key={`${item.versionCode}-${item.term}`}
                          onClick={() => {
                            setSearchText(item.term);
                            if (item.versionCode !== version.code) {
                              setParams({
                                t: item.versionCode,
                                bk: book.code,
                                c: String(chapter),
                              });
                            }
                            void submitSearch(item.term, item.versionCode);
                          }}
                        >
                          <span className="bible-search-history-icon" aria-hidden="true">
                            <Icon name="rotate-ccw" size={20} />
                          </span>
                          <span>{item.term}</span>
                          <small>{getVersion(item.versionCode).label}</small>
                        </button>
                      ))}
                    </div>
                  )}
                </section>
              )}

              {hasSearched && !searchLoading && (
                <section className="bible-search-results">
                  <div className="bible-search-section-heading bible-search-results-heading">
                    <h2>搜索结果</h2>
                    <span>{searchResults.length} 条</span>
                  </div>
                  {searchResults.length === 0 ? (
                    <EmptyState compact art="search" title={`没有找到“${searchQuery}”`} desc="试试更短的关键词，或切换译本和搜索范围" />
                  ) : (
                    <div className="bible-search-result-list">
                      {searchResults.map((result) => {
                        const resultVersion = getVersion(result.versionCode);
                        const resultBook = getBookByCode(result.book);
                        return (
                          <button
                            type="button"
                            key={`${result.versionCode}-${result.book}-${result.chapter}-${result.verse}`}
                            onClick={() => openSearchResult(result)}
                          >
                            <span className="bible-search-result-meta">
                              <b>
                                {translate(bookName(resultBook, resultVersion))} {result.chapter}:{result.label}
                              </b>
                              <small>{resultVersion.label}</small>
                            </span>
                            <span
                              className="bible-search-result-text"
                              dangerouslySetInnerHTML={{
                                __html: highlightKeyword(
                                  isTraditional ? translate(result.text) : result.text,
                                  isTraditional ? translate(searchQuery) : searchQuery,
                                ),
                              }}
                            />
                          </button>
                        );
                      })}
                      {searchResults.length >= BIBLE_SEARCH_RESULT_LIMIT && (
                        <p className="bible-search-limit">
                          已显示前 {BIBLE_SEARCH_RESULT_LIMIT} 条，请缩小搜索范围以查看更精确的结果
                        </p>
                      )}
                    </div>
                  )}
                </section>
              )}
            </div>
          </section>
        )}

        {picker === "font" && (
          <div className="bible-reading-settings" role="dialog" aria-label="阅读设置">
            <div className="bible-reading-setting-row">
              <span>字体大小</span>
              <div className="bible-font-size-control">
                <button
                  type="button"
                  aria-label="缩小字体"
                  disabled={fontSize === 16}
                  onClick={() => setFontSize((size) => Math.max(16, size - 1))}
                >
                  −
                </button>
                <button
                  type="button"
                  className="font-size-value"
                  aria-label="恢复默认字号"
                  disabled={fontSize === 18}
                  onClick={() => setFontSize(18)}
                >
                  {fontSize}px
                  {fontSize !== 18 && <small>恢复默认</small>}
                </button>
                <button
                  type="button"
                  aria-label="放大字体"
                  disabled={fontSize === 24}
                  onClick={() => setFontSize((size) => Math.min(24, size + 1))}
                >
                  +
                </button>
              </div>
            </div>

            <div className="bible-reading-setting-row">
              <span>语言简繁</span>
              <div className="bible-setting-segment">
                <button type="button" className={!isTraditional ? "active" : ""} onClick={() => setIsTraditional(false)}>简</button>
                <button type="button" className={isTraditional ? "active" : ""} onClick={() => setIsTraditional(true)}>繁</button>
              </div>
            </div>

            <div className="bible-reading-setting-row">
              <span>显示标题</span>
              <div className="bible-setting-segment">
                <button type="button" className={showHeadings ? "active" : ""} onClick={() => setShowHeadings(true)}>显示</button>
                <button type="button" className={!showHeadings ? "active" : ""} onClick={() => setShowHeadings(false)}>隐藏</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* verses */}
      <div
        ref={readingScrollRef}
        className={`screen-scroll bible-reading-scroll${version.code === "pinyin" ? " is-pinyin-reader" : ""}${version.lang === "ko" ? " is-korean-reader" : ""}${selectedVerses.length > 0 ? " has-verse-action-sheet" : ""}`}
        style={{ padding: version.code === "pinyin" ? "12px 22px 24px" : version.lang === "ko" ? "14px 22px 24px" : "8px var(--reading-gutter) 24px" }}
        onClick={() => picker && setPicker(null)}
        onScroll={(event) => {
          const top = event.currentTarget.scrollTop;
          const delta = top - lastScrollTopRef.current;
          lastScrollTopRef.current = top;
          const range = event.currentTarget.scrollHeight - event.currentTarget.clientHeight;
          // 进度线直接写样式：滚动是最高频事件，不值得整页重渲
          if (readProgressRef.current) {
            readProgressRef.current.style.width = `${range > 0 ? Math.min(100, Math.max(0, (top / range) * 100)) : 0}%`;
          }
          // 选择器打开或接近顶部时始终显示；小幅抖动（±6px）不触发切换
          if (picker || top < 48) {
            setToolbarHidden(false);
          } else if (delta > 6) {
            setToolbarHidden(true);
          } else if (delta < -6) {
            setToolbarHidden(false);
          }
        }}
        onPointerDown={handleReadingPointerDown}
        onPointerUp={handleReadingPointerUp}
        onPointerCancel={() => {
          swipeStartRef.current = null;
        }}
      >
        {/* 今日金句：每日仪式感的入口——今天一句、连续天数、直达经文与分享 */}
        {!dailyDismissed && !dailyExpanded && (
          <section className="daily-verse-peek" aria-label="今日金句">
            <button type="button" className="daily-verse-peek-main" aria-expanded={false} onClick={() => setDailyExpanded(true)}>
              <span className="daily-verse-kicker">今日金句</span>
              <span className="daily-verse-peek-text">{translate(dailyVerse.text)}</span>
              <Icon name="chevron-down" size={14} />
            </button>
            <button data-icon-button="default"
              type="button"
              className="daily-verse-close"
              aria-label="今天先收起金句卡"
              onClick={() => {
                setDailyDismissed(true);
                try { localStorage.setItem("ob.daily-card-dismissed", todayKey); } catch { /* 存不了就只收本次 */ }
              }}
            >
              <Icon name="x" size={14} />
            </button>
          </section>
        )}
        {!dailyDismissed && dailyExpanded && (
          <section className="daily-verse-card" aria-label="今日金句">
            <div className="daily-verse-head">
              <button type="button" className="daily-verse-kicker" aria-expanded onClick={() => setDailyExpanded(false)}>
                今日金句 · {new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", weekday: "short" }).format(new Date())}
              </button>
              {readStreak > 0 && (
                <span className="daily-verse-streak" title={`连续读经 ${readStreak} 天`}>
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true"><path d="M12 2c1 3-1 4.5-2.2 6C8.5 9.6 8 11 8.4 12.8 6.9 12 6 10.6 6 9c-2 2-3 4.2-3 6.3C3 19 6.6 22 12 22s9-3 9-6.7c0-4.6-3.6-6.6-5-9.3-.7 1.3-.8 2.6-.2 4-1.8-1-3.3-3.4-3.8-8z"></path></svg>
                  {readStreak} 天
                </span>
              )}
              <button data-icon-button="default"
                type="button"
                className="daily-verse-close"
                aria-label="今天先收起金句卡"
                onClick={() => {
                  setDailyDismissed(true);
                  try { localStorage.setItem("ob.daily-card-dismissed", todayKey); } catch { /* 存不了就只收本次 */ }
                }}
              >
                <Icon name="x" size={14} />
              </button>
            </div>
            <p className="daily-verse-text">{translate(dailyVerse.text)}</p>
            <div className="daily-verse-foot">
              <b>{translate(dailyVerse.reference)}</b>
              <div className="daily-verse-actions">
                <button
                  type="button"
                  onClick={() => {
                    markTodayRead();
                    setParams({ t: "cuv", bk: dailyVerse.book, c: String(dailyVerse.chapter), v: String(dailyVerse.verse) });
                  }}
                >
                  读这节
                </button>
                <button type="button" onClick={() => setDailyShareOpen(true)}>分享</button>
              </div>
            </div>
          </section>
        )}

        {!data && !loadError && (
          <SkeletonScreen variant="verses" label="正在加载经文" />
        )}
        {loadError && (
          <div style={{ fontSize: 13, color: "var(--body)" }}>经文加载失败，请检查网络后重试。</div>
        )}
        <div
          key={`${version.code}-${book.code}-${chapter}`}
          className={`bible-verse-content${version.code === "pinyin" ? " is-pinyin" : ""}${version.lang === "ko" ? " is-korean" : ""}`}
          style={{
            fontSize: version.lang === "ko" ? Math.max(16, fontSize - 1) : fontSize,
            lineHeight: version.code === "pinyin" ? 2.18 : version.lang === "ko" ? 1.82 : 1.8,
          }}
        >
          {verses.map((v) => {
            const color = highlightMap.get(v.verse);
            const isSelected = selected.has(v.verse);
            const isAudioCurrent = audioPlaying && audioCurrentVerseNumber === v.verse;
            const verseNotes = notes.filter((note) => note.verse === v.verse);
            const noteExpanded = expandedNoteVerse === v.verse;
            return (
              <span key={v.label} className="bible-verse">
                {showHeadings && v.heading && (
                  <span className="bible-heading">{translate(v.heading)}</span>
                )}
                <span
                  id={`bible-verse-${v.verse}`}
                  className={`bible-verse-main${isAudioCurrent ? " is-audio-current" : ""}${isSelected ? " is-selected" : ""}`}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSelected}
                  onClick={() => {
                    if (suppressVerseClickRef.current) return;
                    toggleVerseSelection(v.verse);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      toggleVerseSelection(v.verse);
                    }
                  }}
                >
                  {/* 章首大字号章码（书面排版惯例）：替代第 1 节节号，首两行环绕 */}
                  {v.verse === 1 && version.code !== "pinyin" && (
                    <span className="chapter-dropcap" aria-hidden="true">{chapter}</span>
                  )}
                  {/* 结尾的 U+2060 字连接符禁止在节号和经文之间断行，避免节号孤零零挂在行尾 */}
                  {!(v.verse === 1 && version.code !== "pinyin") && (
                    <sup className="bible-verse-number">{v.label}{"\u2060"}</sup>
                  )}
                  <span
                    className="verse-text"
                    style={{
                      background: locatedVerse === v.verse ? "rgba(244, 204, 120, 0.58)" : color ?? "transparent",
                      // 高亮底色是用户选的浅色，字固定深色——否则暗色主题下浅字压浅底看不清
                      color: color || locatedVerse === v.verse ? "#2b2926" : undefined,
                      padding: color || locatedVerse === v.verse ? "1px 2px" : undefined,
                      textDecoration: isSelected ? "underline" : undefined,
                      textDecorationColor: isSelected ? "rgba(217, 154, 37, 0.52)" : undefined,
                      textDecorationThickness: isSelected ? "1px" : undefined,
                      textUnderlineOffset: isSelected ? "5px" : undefined,
                    }}
                    dangerouslySetInnerHTML={{ __html: translate(v.text) }}
                  />
                </span>
                {noteVerseNumbers.has(v.verse) && (
                  <button data-icon-button="default" data-icon-button-size="inline"
                    type="button"
                    className={`bible-verse-note-indicator${noteExpanded ? " is-open" : ""}`}
                    aria-label={noteExpanded ? "收起本节笔记" : "展开本节笔记"}
                    aria-expanded={noteExpanded}
                    onClick={() => setExpandedNoteVerse(noteExpanded ? null : v.verse)}
                  >
                    <Icon name="edit" size={12} />
                  </button>
                )}
                {noteExpanded && (
                  <span className="bible-inline-note" role="note" aria-label={`${displayedBook}${chapter}章${v.label}节的笔记`}>
                    <span className="bible-inline-note-label">笔记</span>
                    <span className="bible-inline-note-list">
                      {verseNotes.map((note) => (
                        <span className="bible-inline-note-row" key={note.id}>
                          <span className="bible-inline-note-copy">{note.content}</span>
                          <span className="bible-inline-note-actions">
                            <button type="button" onClick={() => openNoteEditor(v.verse, note)}>编辑</button>
                            <button
                              type="button"
                              onClick={() => {
                                deleteNote(note.id);
                                setStoreVersion((value) => value + 1);
                                if (verseNotes.length === 1) setExpandedNoteVerse(null);
                              }}
                            >
                              删除
                            </button>
                          </span>
                        </span>
                      ))}
                    </span>
                  </span>
                )}
              </span>
            );
          })}
        </div>

      </div>

      {/* audio modal */}
      {/* 只在播放中显示：暂停时隐藏，不占阅读空间（进度保留，从顶栏喇叭键可回到面板） */}
      {audioUrl && picker !== "audio" && audioPlaying && (
        <div className="audio-mini-bar">
          <button type="button" className="audio-mini-main" aria-label="展开语音圣经" onClick={() => setPicker("audio")}>
            <span className="audio-mini-eq" aria-hidden="true">
              {audioPlaying ? <PlayingAudioIcon /> : <Icon name="volume-2" size={16} />}
            </span>
            <span className="audio-mini-copy">
              <b>{audioSourceLabel || "语音圣经"}</b>
              <small>{formatAudioTime(audioCurrentTime)} / {formatAudioTime(audioDuration)}</small>
            </span>
          </button>
          <button data-icon-button="primary" type="button" className="audio-mini-play" aria-label={audioPlaying ? "暂停" : "播放"} onClick={() => void toggleAudio()}>
            <AudioGlyph name={audioPlaying ? "pause" : "play"} size={18} />
          </button>
        </div>
      )}

      {picker === "audio" && (
        <>
          <div className="audio-player-scrim" onClick={closeAudio} />
          <section className="audio-player-sheet is-lyrics" role="dialog" aria-modal="true" aria-label={`${displayedBook}第${chapter}章语音圣经`}>
            <div className="audio-player-handle" />
            <div className="audio-player-kicker">
              <Icon name="volume-2" size={20} />
              <span>语音圣经</span>
              <button data-icon-button="default"
                type="button"
                className={`audio-player-download${audioCacheReady ? " is-done" : ""}`}
                aria-label={audioCacheBusy
                  ? `正在缓存${displayedBook}整卷音频，第 ${audioCacheBusy.done} 章，共 ${audioCacheBusy.total} 章`
                  : audioCacheReady
                    ? `已缓存${displayedBook}整卷音频，点击可删除`
                    : `缓存${displayedBook}整卷音频到本机`}
                title={audioCacheBusy ? "整卷缓存中…" : audioCacheReady ? "已缓存整卷 · 点击删除" : "缓存整卷音频"}
                disabled={Boolean(audioCacheBusy)}
                onClick={() => void cacheBookAudio()}
              >
                {audioCacheBusy
                  ? <b className="audio-cache-progress">{audioCacheBusy.done}/{audioCacheBusy.total}</b>
                  : <Icon name={audioCacheReady ? "check" : "download"} size={18} />}
              </button>
              <button data-icon-button="default" type="button" className="audio-player-close" aria-label="关闭语音圣经" onClick={closeAudio}>
                <Icon name="x" size={20} />
              </button>
            </div>
            <div className="audio-player-titlebar">
              <h2 className="audio-player-title">{displayedBook} {chapter}</h2>
              <button data-icon-button="default" type="button" className="audio-locate-btn" aria-label="在正文中定位当前经节" title="定位正文" onClick={locateAudioVerse}>
                <Icon name="map-pin" size={16} />
              </button>
            </div>
            {(audioError || audioLoading || !audioUrl) && (
              <div
                className={`audio-player-status${audioError ? " error" : " loading"}`}
                role="status"
                aria-live="polite"
              >
                <span className="audio-status-indicator" aria-hidden="true" />
                <span>{audioError || "正在准备本章音频"}</span>
                {audioError && version.code !== "cuv" && (
                  <button
                    type="button"
                    className="audio-status-action"
                    onClick={() => {
                      // 就地换到和合本：不关面板，加载完成后自动开始朗读
                      continueAudioAfterLoadRef.current = true;
                      setParams({ t: "cuv", bk: book.code, c: String(chapter) });
                    }}
                  >
                    切换到和合本
                  </button>
                )}
              </div>
            )}

            {/* 歌词式经文：只露上一节/当前节/下一节，当前节高亮，点某节从该节开始听 */}
            <div className="audio-lyrics" aria-label="当前朗读经文及前后节">
              {audioLyricWindow.map((verse) => {
                const isCurrent = verse.verse === audioCurrentVerseNumber;
                const seekable = audioTimestamps.some((item) => item.verse === verse.verse);
                return (
                  <button
                    type="button"
                    key={verse.verse}
                    id={`audio-lyric-${verse.verse}`}
                    className={`audio-lyric${isCurrent ? " is-current" : ""}`}
                    disabled={!seekable}
                    aria-current={isCurrent || undefined}
                    onClick={() => seekToVerse(verse.verse)}
                  >
                    <span className="audio-lyric-num">{verse.label}</span>
                    <span className="audio-lyric-text">{stripHtml(verse.text)}</span>
                  </button>
                );
              })}
            </div>

            <div className="audio-progress-wrap">
              <input
                className="audio-progress"
                type="range"
                min="0"
                max="100"
                step="0.1"
                value={audioProgress}
                disabled={!audioUrl || audioDuration <= 0}
                aria-label="播放进度"
                style={{ "--audio-progress": `${audioProgress}%` } as React.CSSProperties}
                onChange={(event) => {
                  const audio = audioRef.current;
                  if (audio?.duration) audio.currentTime = audio.duration * Number(event.target.value) / 100;
                }}
              />
              <div className="audio-time-row">
                <span>{formatAudioTime(audioCurrentTime)}</span>
                <span>{formatAudioTime(audioDuration)}</span>
                <button type="button" onClick={() => setAudioSpeed((speed) => speed === 2 ? 0.75 : speed + 0.25)}>
                  {audioSpeed.toFixed(2).replace(/0$/, "")}×
                </button>
              </div>
            </div>

            <div className="audio-controls">
              <button data-icon-button="default" type="button" aria-label="上一章" disabled={!prevAudioTarget || audioLoading} onClick={() => gotoAudioTarget(prevAudioTarget)}><AudioGlyph name="prev" size={24} /></button>
              <button type="button" aria-label="后退30秒" disabled={!audioUrl} onClick={() => seekAudio(-30)}>
                <span className="audio-seek-icon"><AudioGlyph name="replay" size={26} /><b>30</b></span>
              </button>
              <button data-icon-button="primary" type="button" className="audio-play-button" disabled={!audioUrl || audioLoading} aria-label={audioPlaying ? "暂停" : "播放"} onClick={toggleAudio}>
                <AudioGlyph name={audioPlaying ? "pause" : "play"} size={26} />
              </button>
              <button type="button" aria-label="前进30秒" disabled={!audioUrl} onClick={() => seekAudio(30)}>
                <span className="audio-seek-icon"><AudioGlyph name="forward" size={26} /><b>30</b></span>
              </button>
              <button data-icon-button="default" type="button" aria-label="下一章" disabled={!nextAudioTarget || audioLoading} onClick={() => gotoAudioTarget(nextAudioTarget)}><AudioGlyph name="next" size={24} /></button>
            </div>

            <div className="audio-voice-section">
              <div className="audio-voice-picker">
                <button
                  type="button"
                  className={`audio-voice-select-wrap${voiceMenuOpen ? " open" : ""}`}
                  aria-haspopup="listbox"
                  aria-expanded={voiceMenuOpen}
                  onClick={() => setVoiceMenuOpen((open) => !open)}
                >
                  <span className="audio-voice-avatar" aria-hidden="true">
                    {displayedAudioVoice === "female" ? "女" : "男"}
                  </span>
                  <span className="audio-voice-selected">
                    音色 · {displayedAudioVoice === "female" ? "知性女声 · 温柔自然" : "开朗学长 · 清晰沉稳"}
                  </span>
                  <span className="audio-voice-chevron" aria-hidden="true"><AudioGlyph name="chevron" size={16} /></span>
                </button>
                {voiceMenuOpen && (
                  <div className="audio-voice-menu" role="listbox" aria-label="朗读音色">
                    {[
                      { id: "female", mark: "女", name: "知性女声", detail: "温柔自然" },
                      { id: "male", mark: "男", name: "开朗学长", detail: "清晰沉稳" },
                    ].map((voice) => (
                      <button
                        type="button"
                        role="option"
                        aria-selected={displayedAudioVoice === voice.id}
                        className={displayedAudioVoice === voice.id ? "active" : ""}
                        key={voice.id}
                        onClick={() => chooseAudioVoice(voice.id)}
                      >
                        <span className="audio-voice-avatar">{voice.mark}</span>
                        <span><b>{voice.name}</b><small>{voice.detail}</small></span>
                        <span className="audio-voice-menu-check">{displayedAudioVoice === voice.id && <Icon name="check" size={16} />}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>
        </>
      )}

      {/* Docked actions reserve their own space beneath the reader. */}
      {selectedVerses.length > 0 && selectedVerse && (
        <>
          <div ref={verseActionSheetRef} className="verse-action-sheet is-docked" role="dialog" aria-label="经文操作" data-testid="verse-action-sheet">
            <div className="verse-dock-header">
              <div><strong>{displayedBook} {chapter}:{selectedRangeLabel}</strong><span aria-live="polite">已选 {selectedVerses.length} 节</span></div>
              <button data-icon-button="default" type="button" aria-label="关闭经文操作" onClick={() => { setSelected(new Set()); setNoteOpen(false); setMoreOpen(false); }}><Icon name="x" /></button>
            </div>
            {noteOpen && selectedVerses.length === 1 ? (
              <form
                className="verse-compact-note-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (noteText.trim()) {
                    if (editingNoteId) updateNote(editingNoteId, noteText.trim());
                    else addNote(book.code, chapter, selectedVerse.verse, noteText.trim(), version.code);
                    setStoreVersion((v) => v + 1);
                    setExpandedNoteVerse(selectedVerse.verse);
                    setSelected(new Set());
                    setNoteText("");
                    setNoteOpen(false);
                    setEditingNoteId(null);
                  }
                }}
              >
                <input
                  autoFocus
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="写下你的笔记…"
                />
                <button type="submit">{editingNoteId ? "更新" : "保存"}</button>
              </form>
            ) : (
              <div className="verse-dock-body">
                <div className="verse-dock-highlight"><span>高亮</span>
                <div className="verse-compact-swatches" role="group" aria-label="高亮颜色">
                  {HIGHLIGHT_COLORS.map((color, colorIndex) => {
                    const active = selectedVerses.length > 0
                      && selectedVerses.every((verse) => highlightMap.get(verse.verse) === color);
                    return (
                      <button
                        key={color}
                        type="button"
                        aria-label={active ? "取消高亮" : `使用第 ${colorIndex + 1} 种高亮颜色`}
                        aria-pressed={active}
                        onClick={() => {
                          hapticLight();
                          if (active) selectedVerses.forEach((verse) => clearHighlight(book.code, chapter, verse.verse));
                          else selectedVerses.forEach((verse) => setHighlight(book.code, chapter, verse.verse, color, version.code));
                          setStoreVersion((v) => v + 1);
                        }}
                      >
                        <span className={`verse-highlight-swatch${active ? " active" : ""}`} style={{ background: color }}>
                          {active && <Icon name="check" size={12} />}
                        </span>
                      </button>
                    );
                  })}
                </div>
                </div>
                <div className="verse-dock-actions">
                  <button type="button" onClick={() => openNoteEditor(selectedVerse.verse, selectedNotes[0], true)}><Icon name="edit" /><span>笔记</span></button>
                  <button type="button" onClick={() => navigate(`/annotations?t=${version.code}&bk=${book.code}&c=${chapter}&v=${selectedVerse.verse}`)}><Icon name="book" /><span>注释</span></button>
                  <button type="button" onClick={askHuidu}><Icon name="sparkle" /><span>慧读</span></button>
                  <button type="button" onClick={() => setShareOpen(true)}><Icon name="share" /><span>分享</span></button>
                  <button type="button" onClick={() => void copyVerse()}><Icon name="copy" /><span>复制经文</span></button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {dailyShareOpen && (
        <VerseShareSheet
          data={{
            verseText: dailyVerse.text,
            reference: dailyVerse.reference,
            versionLabel: "和合本",
            shareUrl: `https://app.openbible.live/#/bible?t=cuv&bk=${dailyVerse.book}&c=${dailyVerse.chapter}&v=${dailyVerse.verse}`,
          }}
          onClose={() => setDailyShareOpen(false)}
        />
      )}

      {shareOpen && selectedVerses.length > 0 && (
        <VerseShareSheet
          data={{
            verseText: selectedVerses.map((verse) => stripHtml(translate(verse.text))).join(" "),
            reference: `${displayedBook} ${chapter}:${selectedRangeLabel}`,
            versionLabel: version.label,
            shareUrl: `https://app.openbible.live/#/bible?t=${version.code}&bk=${book.code}&c=${chapter}&v=${selectedVerse?.verse ?? selectedVerses[0].verse}`,
          }}
          onClose={() => setShareOpen(false)}
        />
      )}
    </div>
  );
}
