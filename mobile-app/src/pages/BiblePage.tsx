import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Icon } from "../components/Icon";
import { VerseShareSheet } from "../components/VerseShareSheet";
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
  const [isDarkMode, setIsDarkMode] = useState(
    () => localStorage.getItem("ob.bible.isDarkMode") === "true",
  );
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
  const [picker, setPicker] = useState<null | "version" | "chapter" | "search" | "audio" | "font">(null);
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
  const activeChapterButtonRef = useRef<HTMLButtonElement>(null);
  const swipeStartRef = useRef<{
    x: number;
    y: number;
    pointerId: number;
  } | null>(null);
  const suppressVerseClickRef = useRef(false);
  const [fontSize, setFontSize] = useState(() => {
    const saved = Number(localStorage.getItem("ob.bible.fontSize"));
    return [17, 19, 21, 23].includes(saved) ? saved : 19;
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
  const [locatedVerse, setLocatedVerse] = useState<number | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [loadedAudioKey, setLoadedAudioKey] = useState<string | null>(null);
  const androidMediaStartedRef = useRef(false);
  const continueAudioAfterLoadRef = useRef(false);

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
    localStorage.setItem("ob.bible.fontSize", String(fontSize));
  }, [fontSize]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.playbackRate = audioSpeed;
  }, [audioSpeed]);


  useEffect(() => {
    localStorage.setItem("ob.bible.isDarkMode", String(isDarkMode));
    document.body.classList.toggle("dark", isDarkMode);
    document.querySelector('meta[name="theme-color"]')?.setAttribute(
      "content",
      isDarkMode ? "#101116" : "#F6F7F8",
    );
  }, [isDarkMode]);

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
      setAudioError("当前仅和合本提供语音圣经，请先切换到和合本");
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
    gotoAdjacentChapter(deltaX < 0 ? 1 : -1);
  };

  const gotoVersion = (t: string) => {
    setParams({ t, bk: book.code, c: String(chapter) });
    setPicker(null);
  };

  const closeSheet = () => {
    setSelected(new Set());
    setNoteOpen(false);
    setNoteText("");
    setEditingNoteId(null);
  };

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
    closeSheet();
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
  const gotoAudioChapter = (nextChapter: number) => {
    continueAudioAfterLoadRef.current = false;
    audioRef.current?.pause();
    setParams({ t: version.code, bk: book.code, c: String(nextChapter) });
    setSelected(new Set());
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
        onTimeUpdate={(event) => setAudioCurrentTime(event.currentTarget.currentTime)}
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
      <div className="bible-toolbar">
        <div className="bible-reader-selectors" aria-label="经卷章节及译本选择">
          <button
            className={`bible-reader-selector book${picker === "chapter" && !pickerBookData ? " is-open" : ""}`}
            onClick={() => {
              if (picker === "chapter" && !pickerBookData) {
                setPicker(null);
                return;
              }
              setPicker("chapter");
              setPickerBook(null);
            }}
            aria-label={`选择书卷，当前为${displayedBook}`}
          >
            {displayedBook}
          </button>
          <button
            className={`bible-reader-selector chapter-number${picker === "chapter" && pickerBookData ? " is-open" : ""}`}
            onClick={() => {
              if (picker === "chapter" && pickerBookData?.code === book.code) {
                setPicker(null);
                setPickerBook(null);
                return;
              }
              setPicker("chapter");
              setPickerBook(book.code);
            }}
            aria-label={`选择章节，当前为第${chapter}章`}
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
          <button
            className="bible-toolbar-action"
            title="有声圣经"
            aria-label="有声圣经"
            onClick={() => setPicker("audio")}
          >
            {audioPlaying ? <PlayingAudioIcon /> : <Icon name="volume-2" size={23} />}
          </button>
          <button
            className="bible-toolbar-action"
            title="搜索"
            aria-label="搜索经文"
            onClick={() => setPicker(picker === "search" ? null : "search")}
          >
            <Icon name="search" size={22} />
          </button>
          <button
            className="bible-toolbar-action"
            title="字体设置"
            aria-label="字体设置"
            onClick={() => setPicker(picker === "font" ? null : "font")}
          >
            <span className="bible-font-mark" aria-hidden="true">
              <span className="small-a">A</span><span className="large-a">A</span>
            </span>
          </button>
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
                      ref={pickerBookData.code === book.code && n === chapter ? activeChapterButtonRef : undefined}
                      onClick={() => gotoChapter(n, pickerBookData.code)}
                      style={{
                        height: 40, borderRadius: 8, fontSize: 13, fontWeight: 700,
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
                  <Icon name="search" size={21} />
                  <input
                    autoFocus
                    aria-label="搜索圣经"
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    placeholder="请输入要搜索的文字"
                  />
                  {searchText && (
                    <button
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
                      <Icon name="x" size={17} />
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
                  <div className="bible-search-section-heading">
                    <h2>搜索历史</h2>
                    {searchHistory.length > 0 && (
                      <button
                        type="button"
                        aria-label="清空搜索历史"
                        onClick={clearSearchHistory}
                      >
                        <Icon name="trash" size={19} />
                      </button>
                    )}
                  </div>
                  {searchHistory.length === 0 ? (
                    <div className="bible-search-empty">
                      <Icon name="search" size={25} />
                      <p>输入关键词，搜索整本圣经</p>
                      <small>也可以输入“章:节”，快速跳到当前书卷</small>
                    </div>
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
                    <div className="bible-search-empty">
                      <Icon name="search" size={25} />
                      <p>没有找到“{searchQuery}”</p>
                      <small>试试更短的关键词，或切换译本和搜索范围</small>
                    </div>
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
          <>
            <div className="bible-reading-settings-backdrop" onClick={() => setPicker(null)} />
            <div className="bible-reading-settings" role="dialog" aria-label="阅读设置">
              <div className="bible-reading-setting-row">
                <span>字体大小</span>
                <div className="bible-font-size-control">
                  <button
                    type="button"
                    aria-label="缩小字体"
                    disabled={fontSize === 17}
                    onClick={() => setFontSize((size) => Math.max(17, size - 2))}
                  >
                    −
                  </button>
                  <b>{fontSize}px</b>
                  <button
                    type="button"
                    aria-label="放大字体"
                    disabled={fontSize === 23}
                    onClick={() => setFontSize((size) => Math.min(23, size + 2))}
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
                <span>阅读模式</span>
                <div className="bible-setting-segment">
                  <button type="button" className={!isDarkMode ? "active" : ""} onClick={() => setIsDarkMode(false)}>浅色</button>
                  <button type="button" className={isDarkMode ? "active" : ""} onClick={() => setIsDarkMode(true)}>深色</button>
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
          </>
        )}
      </div>

      {/* verses */}
      <div
        ref={readingScrollRef}
        className={`screen-scroll bible-reading-scroll${version.code === "pinyin" ? " is-pinyin-reader" : ""}${version.lang === "ko" ? " is-korean-reader" : ""}`}
        style={{ padding: version.code === "pinyin" ? "12px 22px 24px" : version.lang === "ko" ? "14px 22px 24px" : "8px 24px 24px" }}
        onClick={() => picker && setPicker(null)}
        onPointerDown={handleReadingPointerDown}
        onPointerUp={handleReadingPointerUp}
        onPointerCancel={() => {
          swipeStartRef.current = null;
        }}
      >
        {!data && !loadError && (
          <div style={{ fontSize: 13, color: "var(--body)" }}>加载经文中…</div>
        )}
        {loadError && (
          <div style={{ fontSize: 13, color: "var(--body)" }}>经文加载失败，请检查网络后重试。</div>
        )}
        <div
          className={`bible-verse-content${version.code === "pinyin" ? " is-pinyin" : ""}${version.lang === "ko" ? " is-korean" : ""}`}
          style={{
            fontSize: version.lang === "ko" ? Math.max(17, fontSize - 1) : fontSize,
            fontWeight: 400,
            lineHeight: version.code === "pinyin" ? 2.18 : version.lang === "ko" ? 1.82 : 1.95,
            color: "var(--ink)",
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
                  <span style={{ display: "block", fontSize: 14, fontWeight: 800, margin: "14px 0 6px", color: "var(--ink)" }}>{translate(v.heading)}</span>
                )}
                <span
                  id={`bible-verse-${v.verse}`}
                  className={`bible-verse-main${isAudioCurrent ? " is-audio-current" : ""}`}
                  role="button"
                  tabIndex={0}
                  aria-label={`选择${displayedBook}第${chapter}章${v.label}节`}
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
                  <sup className="bible-verse-number" style={{ fontSize: 12, color: "var(--body)", margin: "0 4px" }}>{v.label}</sup>
                  <span
                    className="verse-text"
                    style={{
                      background: locatedVerse === v.verse ? "rgba(244, 204, 120, 0.58)" : color ?? "transparent",
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
                  <button
                    type="button"
                    className={`bible-verse-note-indicator${noteExpanded ? " is-open" : ""}`}
                    aria-label={noteExpanded ? "收起本节笔记" : "展开本节笔记"}
                    aria-expanded={noteExpanded}
                    onClick={() => setExpandedNoteVerse(noteExpanded ? null : v.verse)}
                  >
                    <Icon name="edit" size={11} />
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
      {picker === "audio" && (
        <>
          <div className="audio-player-scrim" onClick={closeAudio} />
          <section className="audio-player-sheet" role="dialog" aria-modal="true" aria-label={`${displayedBook}第${chapter}章语音圣经`}>
            <div className="audio-player-handle" />
            <div className="audio-player-kicker">
              <Icon name="volume-2" size={18} />
              <span>语音圣经</span>
              <button type="button" className="audio-player-close" aria-label="关闭语音圣经" onClick={closeAudio}>
                <Icon name="x" size={22} />
              </button>
            </div>
            <h2 className="audio-player-title">{displayedBook} {chapter}</h2>
            <div
              className={`audio-player-status${audioError ? " error" : audioLoading || !audioUrl ? " loading" : " ready"}`}
              role="status"
              aria-live="polite"
            >
              <span className="audio-status-indicator" aria-hidden="true" />
              <span>{audioError || (audioLoading || !audioUrl ? "正在准备本章音频" : "本章音频已就绪")}</span>
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
              <button type="button" aria-label="上一章" disabled={chapter <= 1 || audioLoading} onClick={() => gotoAudioChapter(chapter - 1)}><Icon name="skip-back" size={27} /></button>
              <button type="button" aria-label="后退30秒" disabled={!audioUrl} onClick={() => seekAudio(-30)}>
                <span className="audio-seek-icon"><Icon name="rotate-ccw" size={24} /><b>30</b></span>
              </button>
              <button type="button" className="audio-play-button" disabled={!audioUrl || audioLoading} aria-label={audioPlaying ? "暂停" : "播放"} onClick={toggleAudio}>
                <Icon name={audioPlaying ? "pause" : "play"} size={28} />
              </button>
              <button type="button" aria-label="前进30秒" disabled={!audioUrl} onClick={() => seekAudio(30)}>
                <span className="audio-seek-icon"><Icon name="rotate-cw" size={24} /><b>30</b></span>
              </button>
              <button type="button" aria-label="下一章" disabled={chapter >= maxChapter || audioLoading} onClick={() => gotoAudioChapter(chapter + 1)}><Icon name="skip-forward" size={27} /></button>
            </div>

            <button type="button" className="audio-current-passage" onClick={locateAudioVerse}>
              <span className="audio-current-copy">
                <b>正在朗读 · {displayedBook} {chapter}:{audioCurrentVerse?.label ?? 1}</b>
                <small>{audioCurrentVerse ? stripHtml(audioCurrentVerse.text) : "经文加载中…"}</small>
              </span>
              <Icon name="chevron-right" size={20} />
            </button>

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
                  <span className="audio-voice-chevron" aria-hidden="true"><Icon name="chevron-down" size={18} /></span>
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

      {/* selection sheet (design 1b) */}
      {selectedVerses.length > 0 && selectedVerse && (
        <>
          <div className="sheet verse-action-sheet" role="dialog" aria-label="经文操作" data-testid="verse-action-sheet">
            <header className="verse-action-sheet-header">
              <div className="verse-action-reference">
                <strong>{displayedBook} {chapter}:{selectedRangeLabel}</strong>
                <span>{selectedVerses.length} 节 · {version.label}</span>
              </div>
              <button type="button" className="icon-btn icon-btn-ghost sheet-close-btn" aria-label="关闭经文选择" onClick={closeSheet}><Icon name="x" size={17} /></button>
            </header>

            <div className="verse-highlight-row">
              <span className="verse-highlight-label">高亮</span>
              {HIGHLIGHT_COLORS.map((color, colorIndex) => (
                <button
                  key={color}
                  type="button"
                  className="verse-highlight-choice"
                  aria-label={`使用第 ${colorIndex + 1} 种高亮颜色`}
                  onClick={() => {
                    selectedVerses.forEach((verse) => setHighlight(book.code, chapter, verse.verse, color, version.code));
                    setStoreVersion((v) => v + 1);
                  }}
                >
                  <span
                    className={`verse-highlight-swatch${selectedVerses.every((verse) => highlightMap.get(verse.verse) === color) ? " active" : ""}`}
                    style={{ background: color }}
                  >
                    {selectedVerses.every((verse) => highlightMap.get(verse.verse) === color) && <Icon name="check" size={13} />}
                  </span>
                </button>
              ))}
              <button
                type="button"
                className="verse-highlight-choice"
                onClick={() => {
                  selectedVerses.forEach((verse) => clearHighlight(book.code, chapter, verse.verse));
                  setStoreVersion((v) => v + 1);
                }}
                aria-label="取消高亮"
              >
                <span className="verse-highlight-swatch verse-highlight-clear" />
              </button>
            </div>

            {noteOpen && selectedVerses.length === 1 ? (
              <form
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
                style={{ display: "flex", gap: 8, marginBottom: 8 }}
              >
                <input
                  autoFocus
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="写下你的笔记…"
                  style={{ flex: 1, height: 44, padding: "0 12px", border: "1px solid var(--line)", borderRadius: 12, fontSize: 14 }}
                />
                <button type="submit" style={{ height: 44, padding: "0 16px", background: "var(--purple)", borderRadius: 100, color: "#fff", fontSize: 13, fontWeight: 800 }}>{editingNoteId ? "更新" : "保存"}</button>
              </form>
            ) : (
              <div className="verse-action-grid">
                {[
                  {
                    label: selectedNotes.length ? "编辑笔记" : "笔记",
                    icon: "edit",
                    onClick: () => openNoteEditor(selectedVerse.verse, selectedNotes[0], true),
                    disabled: selectedVerses.length === 0,
                  },
                  { label: "复制", icon: "align-justify", onClick: copyVerse },
                  { label: "分享", icon: "share", onClick: () => setShareOpen(true) },
                  { label: "慧读", icon: "star", onClick: askHuidu, primary: true, disabled: selectedVerses.length === 0 },
                  {
                    label: "注释",
                    icon: "message-square",
                    onClick: () => selectedVerse && navigate(`/annotations?t=${version.code}&bk=${book.code}&c=${chapter}&v=${selectedVerse.verse}`),
                    disabled: selectedVerses.length === 0,
                  },
                ].map((a) => (
                  <button
                    type="button"
                    key={a.label}
                    className={`verse-action-button${a.primary ? " primary" : ""}`}
                    disabled={a.disabled}
                    onClick={a.onClick}
                  >
                    <span className="verse-action-icon">
                      <Icon name={a.icon} size={20} />
                    </span>
                    <span className="verse-action-label">{a.label}</span>
                  </button>
                ))}
              </div>
            )}

          </div>
        </>
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
