import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Icon } from "../components/Icon";
import { VerseShareSheet } from "../components/VerseShareSheet";
import {
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
import { translateToTraditional } from "../utils/cc";


const PlayingAudioIcon = () => (
  <span className="playing-audio-icon" aria-hidden="true">
    <i /><i /><i />
  </span>
);

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

  const [isTraditional, setIsTraditional] = useState(() => {
    return localStorage.getItem("ob.bible.isTraditional") === "true";
  });
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem("ob.bible.isDarkMode") === "true";
  });
  const [showHeadings, setShowHeadings] = useState(() => {
    const saved = localStorage.getItem("ob.bible.showHeadings");
    return saved === null ? true : saved === "true";
  });

  const t = (text: string) => {
    if (isTraditional && text) {
      return translateToTraditional(text);
    }
    return text;
  };

  const displayBook = bookName(book, version);
  const displayedBook = t(displayBook);


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

  useEffect(() => {
    const refresh = () => setStoreVersion((value) => value + 1);
    window.addEventListener(HIGHLIGHTS_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(HIGHLIGHTS_CHANGED_EVENT, refresh);
  }, []);

  useEffect(() => {
    setReading({ version: version.code, book: book.code, chapter });
  }, [version.code, book.code, chapter]);

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
    localStorage.setItem("ob.bible.isTraditional", String(isTraditional));
  }, [isTraditional]);

  useEffect(() => {
    localStorage.setItem("ob.bible.isDarkMode", String(isDarkMode));
    if (isDarkMode) {
      document.body.classList.add("dark");
    } else {
      document.body.classList.remove("dark");
    }
  }, [isDarkMode]);

  useEffect(() => {
    localStorage.setItem("ob.bible.showHeadings", String(showHeadings));
  }, [showHeadings]);


  useEffect(() => {
    if (picker !== "audio") return;
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
  const openNoteEditor = (verseNumber: number, existing?: (typeof notes)[number]) => {
    setSelected(new Set([verseNumber]));
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

  const submitSearch = () => {
    const m = searchText.trim().match(/^(\d+)\s*[:：]\s*(\d+)$/);
    if (m) {
      const c = Math.min(Math.max(Number(m[1]), 1), maxChapter);
      setParams({ t: version.code, bk: book.code, c: String(c) });
      setSelected(new Set([Number(m[2])]));
    }
    setSearchText("");
    setPicker(null);
  };

  const askHuidu = () => {
    if (selectedVerses.length === 0 || !selectedVerse) return;
    const fullVerseText = selectedVerses.map(v => stripHtml(v.text)).join("");
    const customRef = `${displayedBook} ${chapter}:${selectedRangeLabel}`;
    const conv = startConversation(displayedBook, chapter, selectedVerse.verse, fullVerseText, customRef);
    navigate(`/huidu/${conv.id}`, { state: { justCreated: true } });
  };

  const copyVerse = async () => {
    if (selectedVerses.length === 0) return;
    const text = selectedVerses
      .map((verse) => `${displayedBook} ${chapter}:${verse.label} ${stripHtml(verse.text)}`)
      .join("\n");
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* clipboard unavailable */
    }
    closeSheet();
  };

  const pickerBookData = pickerBook ? getBookByCode(pickerBook) : null;
  const formatAudioTime = (seconds: number) => {
    const wholeSeconds = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
    return `${Math.floor(wholeSeconds / 60)}:${String(wholeSeconds % 60).padStart(2, "0")}`;
  };
  const audioProgress = audioDuration > 0 ? Math.min(100, audioCurrentTime / audioDuration * 100) : 0;
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
  const audioCurrentVerseText = audioCurrentVerse ? stripHtml(audioCurrentVerse.text) : "";

  useEffect(() => {
    if (
      picker !== "audio"
      || !audioUrl
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
    picker,
    audioUrl,
    displayedBook,
    chapter,
    version.label,
    audioCurrentVerse?.verse,
    audioCurrentVerse?.label,
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
    if (!hasAndroidMediaControls() || picker !== "audio" || !audioUrl || !audioCurrentVerse) return;
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
          positionMs: Math.round(audioCurrentTime * 1000),
          speed: audioSpeed,
        });
      } catch {
        // Android media controls must not interrupt in-app audio playback.
      }
    };
    void updateNativeMedia();
    return () => { cancelled = true; };
  }, [
    picker,
    audioUrl,
    audioPlaying,
    audioDuration,
    Math.floor(audioCurrentTime),
    audioSpeed,
    displayedBook,
    chapter,
    version.label,
    audioCurrentVerse?.verse,
    audioCurrentVerse?.label,
    audioCurrentVerseText,
  ]);

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
    audioRef.current?.pause();
    setParams({ t: version.code, bk: book.code, c: String(nextChapter) });
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
        onTimeUpdate={(event) => setAudioCurrentTime(event.currentTarget.currentTime)}
        onPlay={() => setAudioPlaying(true)}
        onPause={() => setAudioPlaying(false)}
        onEnded={() => setAudioPlaying(false)}
        onError={() => audioUrl && setAudioError("音频文件加载失败，请稍后重试")}
      />
      {/* reading toolbar */}
      <div className="bible-toolbar">
        <div className="bible-reader-selectors" aria-label="经卷章节及译本选择">
          <button
            className={`bible-reader-selector chapter${picker === "chapter" ? " is-open" : ""}`}
            onClick={() => { setPicker(picker === "chapter" ? null : "chapter"); setPickerBook(null); }}
            aria-label={`选择经卷和章节，当前为${displayedBook}第${chapter}章`}
          >
            {displayedBook} {chapter}
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
            title="设置"
            aria-label="阅读设置"
            onClick={() => setPicker(picker === "font" ? null : "font")}
          >
            <Icon name="settings" size={22} />
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
          <div style={{ position: "absolute", top: 50, right: 16, width: 240, background: "var(--white)", border: "1px solid var(--line)", borderRadius: 12, boxShadow: "0 12px 32px rgba(48,49,51,.16)", padding: 10, zIndex: 30 }}>
            <form onSubmit={(e) => { e.preventDefault(); submitSearch(); }}>
              <input
                autoFocus
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="输入章:节，如 3:16"
                style={{ width: "100%", height: 44, padding: "0 10px", border: "1px solid var(--line)", borderRadius: 8, fontSize: 14 }}
              />
            </form>
            <div style={{ fontSize: 11, color: "var(--body)", paddingTop: 8 }}>回车跳转到对应经文</div>
          </div>
        )}

        {picker === "font" && (
          <div style={{ position: "absolute", top: 50, right: 16, width: 220, background: "var(--white)", border: "1px solid var(--line)", borderRadius: 12, boxShadow: "0 12px 32px rgba(48,49,51,.16)", padding: 14, zIndex: 30, display: "flex", flexDirection: "column", gap: 14 }}>
            {/* 字体大小 */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: "var(--ink)" }}>字体大小</span>
              <div className="bible-font-size-control" style={{ display: "flex", alignItems: "center", border: "1px solid var(--line)", borderRadius: 8, overflow: "hidden", height: 32 }}>
                <button
                  type="button"
                  aria-label="缩小字体"
                  disabled={fontSize === 17}
                  onClick={() => setFontSize((size) => Math.max(17, size - 2))}
                  style={{ width: 32, height: 32, display: "grid", placeItems: "center", background: "transparent", color: "var(--ink)", fontSize: 16, fontWeight: 700, opacity: fontSize === 17 ? 0.35 : 1 }}
                >
                  −
                </button>
                <div style={{ width: 44, textAlign: "center", fontSize: 12, fontWeight: 800, color: "var(--ink)" }}>{fontSize}px</div>
                <button
                  type="button"
                  aria-label="放大字体"
                  disabled={fontSize === 23}
                  onClick={() => setFontSize((size) => Math.min(23, size + 2))}
                  style={{ width: 32, height: 32, display: "grid", placeItems: "center", background: "transparent", color: "var(--ink)", fontSize: 16, fontWeight: 700, opacity: fontSize === 23 ? 0.35 : 1 }}
                >
                  +
                </button>
              </div>
            </div>

            {/* 简/繁切换 */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: "var(--ink)" }}>语言简繁</span>
              <div style={{ display: "flex", border: "1px solid var(--line)", borderRadius: 8, overflow: "hidden", height: 32, width: 108 }}>
                <button
                  type="button"
                  style={{ flex: 1, fontSize: 12, background: isTraditional ? "transparent" : "var(--yellow)", color: "var(--ink)", fontWeight: 700 }}
                  onClick={() => setIsTraditional(false)}
                >
                  简
                </button>
                <button
                  type="button"
                  style={{ flex: 1, fontSize: 12, background: isTraditional ? "var(--yellow)" : "transparent", color: "var(--ink)", borderLeft: "1px solid var(--line)", fontWeight: 700 }}
                  onClick={() => setIsTraditional(true)}
                >
                  繁
                </button>
              </div>
            </div>

            {/* 深色模式 */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: "var(--ink)" }}>阅读模式</span>
              <div style={{ display: "flex", border: "1px solid var(--line)", borderRadius: 8, overflow: "hidden", height: 32, width: 108 }}>
                <button
                  type="button"
                  style={{ flex: 1, fontSize: 12, background: isDarkMode ? "transparent" : "var(--yellow)", color: "var(--ink)", fontWeight: 700 }}
                  onClick={() => setIsDarkMode(false)}
                >
                  浅色
                </button>
                <button
                  type="button"
                  style={{ flex: 1, fontSize: 12, background: isDarkMode ? "var(--yellow)" : "transparent", color: "var(--ink)", borderLeft: "1px solid var(--line)", fontWeight: 700 }}
                  onClick={() => setIsDarkMode(true)}
                >
                  深色
                </button>
              </div>
            </div>

            {/* 显示经文标题 */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: "var(--ink)" }}>显示标题</span>
              <div style={{ display: "flex", border: "1px solid var(--line)", borderRadius: 8, overflow: "hidden", height: 32, width: 108 }}>
                <button
                  type="button"
                  style={{ flex: 1, fontSize: 12, background: showHeadings ? "var(--yellow)" : "transparent", color: "var(--ink)", fontWeight: 700 }}
                  onClick={() => setShowHeadings(true)}
                >
                  显示
                </button>
                <button
                  type="button"
                  style={{ flex: 1, fontSize: 12, background: showHeadings ? "transparent" : "var(--yellow)", color: "var(--ink)", borderLeft: "1px solid var(--line)", fontWeight: 700 }}
                  onClick={() => setShowHeadings(false)}
                >
                  隐藏
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* verses */}
      <div
        className={`screen-scroll${version.code === "pinyin" ? " is-pinyin-reader" : ""}${version.lang === "ko" ? " is-korean-reader" : ""}`}
        style={{ padding: version.code === "pinyin" ? "12px 22px 24px" : version.lang === "ko" ? "14px 22px 24px" : "8px 24px 24px" }}
        onClick={() => picker && setPicker(null)}
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
            textWrap: "pretty",
          }}
        >
          {verses.map((v) => {
            const color = highlightMap.get(v.verse);
            const isSelected = selected.has(v.verse);
            const verseNotes = notes.filter((note) => note.verse === v.verse);
            const noteExpanded = expandedNoteVerse === v.verse;
            return (
              <span key={v.label} className="bible-verse">
                {showHeadings && v.heading && (
                  <span style={{ display: "block", fontSize: 14, fontWeight: 800, margin: "14px 0 6px", color: "var(--ink)" }}>{t(v.heading)}</span>
                )}
                <span
                  id={`bible-verse-${v.verse}`}
                  role="button"
                  tabIndex={0}
                  aria-label={`选择${displayedBook}第${chapter}章${v.label}节`}
                  onClick={() => toggleVerseSelection(v.verse)}
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
                    dangerouslySetInnerHTML={{ __html: t(v.text) }}
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
              <button type="button" aria-label="后退30秒" disabled={!audioUrl} onClick={() => seekAudio(-30)}><span className="audio-seek-icon">↶<b>30</b></span></button>
              <button type="button" className="audio-play-button" disabled={!audioUrl || audioLoading} aria-label={audioPlaying ? "暂停" : "播放"} onClick={toggleAudio}>
                <Icon name={audioPlaying ? "pause" : "play"} size={28} />
              </button>
              <button type="button" aria-label="前进30秒" disabled={!audioUrl} onClick={() => seekAudio(30)}><span className="audio-seek-icon">↷<b>30</b></span></button>
              <button type="button" aria-label="下一章" disabled={chapter >= maxChapter || audioLoading} onClick={() => gotoAudioChapter(chapter + 1)}><Icon name="skip-forward" size={27} /></button>
            </div>

            <button type="button" className="audio-current-passage" onClick={locateAudioVerse}>
              <span className="audio-current-icon"><span className="audio-wave" aria-hidden="true"><i /><i /><i /><i /></span></span>
              <span className="audio-current-copy">
                <b>正在朗读 · {displayedBook} {chapter}:{audioCurrentVerse?.label ?? 1}</b>
                <small>{audioCurrentVerse ? stripHtml(audioCurrentVerse.text) : "经文加载中…"}</small>
              </span>
              <Icon name="chevron-right" size={20} />
            </button>

            <div className="audio-voice-section">
              <div className="audio-voice-heading">
                <span>选择音色</span>
                <small>
                  {resolvedAudioVoice && resolvedAudioVoice !== audioVoice
                    ? `当前章节已自动使用${resolvedAudioVoice === "female" ? "女声" : "男声"}`
                    : "可在播放时切换"}
                </small>
              </div>
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
                    {displayedAudioVoice === "female" ? "知性女声 · 温柔自然" : "开朗学长 · 清晰沉稳"}
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
          <div className="sheet">
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 14 }}>
              <div style={{ fontSize: 15, fontWeight: 800 }}>{displayedBook} {chapter}:{selectedRangeLabel}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--body)" }}>已选中 {selectedVerses.length} 节</div>
              <div style={{ flex: 1 }} />
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--body)", letterSpacing: "0.06em" }}>{version.label}</div>
              <button type="button" aria-label="关闭经文选择" onClick={closeSheet} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 44, height: 44, margin: "-12px -12px -12px 2px", color: "var(--body)" }}><Icon name="x" size={17} /></button>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10, marginBottom: 10 }}>
              <div style={{ flex: "none", whiteSpace: "nowrap", fontSize: 11, fontWeight: 800 }}>高亮</div>
              {HIGHLIGHT_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => {
                    selectedVerses.forEach((verse) => setHighlight(book.code, chapter, verse.verse, color, version.code));
                    setStoreVersion((v) => v + 1);
                  }}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center", width: 34, height: 34,
                    background: color, borderRadius: "50%",
                    border: selectedVerses.every((verse) => highlightMap.get(verse.verse) === color) ? "2px solid var(--ink)" : "1px solid var(--line)",
                  }}
                >
                  {selectedVerses.every((verse) => highlightMap.get(verse.verse) === color) && <Icon name="check" size={14} />}
                </button>
              ))}
              <div style={{ flex: 1 }} />
              <button
                title="取消高亮"
                onClick={() => {
                  selectedVerses.forEach((verse) => clearHighlight(book.code, chapter, verse.verse));
                  setStoreVersion((v) => v + 1);
                }}
                aria-label="取消高亮"
                style={{ width: 34, height: 34, borderRadius: "50%", border: "1px solid var(--line)", background: "linear-gradient(135deg,#FFFFFF 44%,#18191F 44%,#18191F 56%,#FFFFFF 56%)" }}
              />
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
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10 }}>
                {[
                  {
                    label: selectedNotes.length ? "编辑笔记" : "笔记",
                    icon: "edit",
                    onClick: () => openNoteEditor(selectedVerse.verse, selectedNotes[0]),
                    disabled: selectedVerses.length !== 1,
                  },
                  { label: "复制", icon: "align-justify", onClick: copyVerse },
                  { label: "分享", icon: "share", onClick: () => setShareOpen(true) },
                  { label: "慧读", icon: "star", onClick: askHuidu, primary: true, disabled: selectedVerses.length === 0 },
                  {
                    label: "注释",
                    icon: "message-square",
                    onClick: () => navigate(`/annotations?t=${version.code}&bk=${book.code}&c=${chapter}&v=${selectedVerse.verse}`),
                    disabled: selectedVerses.length !== 1,
                  },
                ].map((a) => (
                  <button key={a.label} disabled={a.disabled} onClick={a.onClick} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, opacity: a.disabled ? 0.35 : 1 }}>
                    <div style={{
                      display: "flex", alignItems: "center", justifyContent: "center", width: 52, height: 52,
                      background: a.primary ? "var(--purple)" : "var(--white)",
                      border: "1px solid var(--line)", borderRadius: 12, boxShadow: "var(--shadow-card)",
                      color: a.primary ? "#fff" : "var(--ink)",
                    }}>
                      <Icon name={a.icon} size={20} />
                    </div>
                    <div style={{ fontSize: 12, fontWeight: a.primary ? 800 : 700 }}>{a.label}</div>
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
            verseText: selectedVerses.map((verse) => stripHtml(verse.text)).join(" "),
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
