import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Icon } from "../components/Icon";
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
  getNotes,
  addNote,
} from "../data/annotations";
import { startConversation } from "../data/huidu";

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
  const displayBook = bookName(book, version);

  const [data, setData] = useState<BookData | null>(null);
  const [loadError, setLoadError] = useState(false);

  const maxChapter = data?.maxChapter ?? book.chapters;
  // Without ?c=, resume where the reader left off (only meaningful when we
  // are still in that same book).
  const chapterFallback =
    book.code === reading.book ? reading.chapter : defaultChapterFor(book.code);
  const chapter = Math.min(Math.max(Number(params.get("c")) || chapterFallback, 1), maxChapter);

  const [selected, setSelected] = useState<number | null>(null);
  const [picker, setPicker] = useState<null | "version" | "chapter" | "search" | "audio">(null);
  const [pickerBook, setPickerBook] = useState<string | null>(null); // book focused inside the picker
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [searchText, setSearchText] = useState("");
  const [storeVersion, setStoreVersion] = useState(0); // bump to re-read stores

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

  const selectedVerse = selected != null ? verses.find((v) => v.verse === selected) ?? null : null;
  const selectedNotes = selected != null ? notes.filter((n) => n.verse === selected) : [];

  const gotoChapter = (c: number, bk?: string) => {
    setParams({ t: version.code, bk: bk ?? book.code, c: String(c) });
    setSelected(null);
    setPicker(null);
    setPickerBook(null);
  };

  const gotoVersion = (t: string) => {
    setParams({ t, bk: book.code, c: String(chapter) });
    setPicker(null);
  };

  const closeSheet = () => {
    setSelected(null);
    setNoteOpen(false);
    setNoteText("");
  };

  const submitSearch = () => {
    const m = searchText.trim().match(/^(\d+)\s*[:：]\s*(\d+)$/);
    if (m) {
      const c = Math.min(Math.max(Number(m[1]), 1), maxChapter);
      setParams({ t: version.code, bk: book.code, c: String(c) });
      setSelected(Number(m[2]));
    }
    setSearchText("");
    setPicker(null);
  };

  const askHuidu = () => {
    if (!selectedVerse) return;
    const conv = startConversation(displayBook, chapter, selectedVerse.verse, stripHtml(selectedVerse.text));
    navigate(`/huidu/${conv.id}`, { state: { justCreated: true } });
  };

  const copyVerse = async () => {
    if (!selectedVerse) return;
    try {
      await navigator.clipboard.writeText(`${displayBook} ${chapter}:${selectedVerse.label} ${stripHtml(selectedVerse.text)}`);
    } catch {
      /* clipboard unavailable */
    }
    closeSheet();
  };

  const shareVerse = async () => {
    if (!selectedVerse) return;
    const text = `${displayBook} ${chapter}:${selectedVerse.label} ${stripHtml(selectedVerse.text)}`;
    try {
      if (navigator.share) await navigator.share({ text });
      else await navigator.clipboard.writeText(text);
    } catch {
      /* user cancelled */
    }
    closeSheet();
  };

  const pickerBookData = pickerBook ? getBookByCode(pickerBook) : null;

  return (
    <div className="screen">
      {/* top bar (design 1a) */}
      <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 8, padding: "10px 16px 14px", borderBottom: "1px solid var(--line)", position: "relative" }}>
        <button
          onClick={() => setPicker(picker === "version" ? null : "version")}
          style={{ display: "flex", alignItems: "center", gap: 6, height: 40, padding: "0 12px", background: "var(--yellow)", border: "1px solid var(--line)", borderRadius: 12, boxShadow: "var(--shadow-card)", fontSize: 14, fontWeight: 700, color: "var(--ink)" }}
        >
          {version.label} <Icon name="chevron-down" size={16} />
        </button>
        <button
          onClick={() => { setPicker(picker === "chapter" ? null : "chapter"); setPickerBook(null); }}
          style={{ display: "flex", alignItems: "center", gap: 6, height: 40, padding: "0 12px", background: "var(--white)", border: "1px solid var(--line)", borderRadius: 12, boxShadow: "var(--shadow-card)", fontSize: 14, fontWeight: 700, color: "var(--ink)" }}
        >
          {displayBook} {chapter} <Icon name="chevron-down" size={16} />
        </button>
        <div style={{ flex: 1 }} />
        <button className="icon-btn" style={{ background: "rgba(191,120,246,.16)", color: "var(--purple)" }} title="有声圣经" onClick={() => setPicker("audio")}>
          <Icon name="play" size={18} />
        </button>
        <button className="icon-btn" onClick={() => setPicker(picker === "search" ? null : "search")}>
          <Icon name="search" size={18} />
        </button>

        {picker === "version" && (
          <div style={{ position: "absolute", top: 58, left: 16, width: 220, background: "var(--white)", border: "1px solid var(--line)", borderRadius: 16, boxShadow: "0 12px 32px rgba(48,49,51,.16)", padding: 8, zIndex: 30 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: "var(--body)", padding: "4px 6px 8px" }}>选择译本</div>
            {VERSIONS.map((ver) => (
              <button
                key={ver.code}
                onClick={() => gotoVersion(ver.code)}
                style={{
                  display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "9px 10px",
                  borderRadius: 10, fontSize: 14, textAlign: "left",
                  fontWeight: ver.code === version.code ? 800 : 600,
                  background: ver.code === version.code ? "var(--surface)" : "transparent",
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
          <div style={{ position: "absolute", top: 58, left: 16, right: 16, maxHeight: 420, overflow: "auto", background: "var(--white)", border: "1px solid var(--line)", borderRadius: 16, boxShadow: "0 12px 32px rgba(48,49,51,.16)", padding: 12, zIndex: 30 }}>
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
                  <div key={group.label} style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: "var(--body)", marginBottom: 6 }}>{group.label}</div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
                      {group.books.map((bk) => (
                        <button
                          key={bk.code}
                          onClick={() => setPickerBook(bk.code)}
                          style={{
                            padding: "8px 4px", borderRadius: 8, fontSize: 12, fontWeight: bk.code === book.code ? 800 : 600,
                            border: "1px solid var(--line)",
                            background: bk.code === book.code ? "var(--ink)" : "var(--white)",
                            color: bk.code === book.code ? "var(--yellow)" : "var(--ink)",
                          }}
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
          <div style={{ position: "absolute", top: 58, right: 16, width: 240, background: "var(--white)", border: "1px solid var(--line)", borderRadius: 12, boxShadow: "0 12px 32px rgba(48,49,51,.16)", padding: 10, zIndex: 30 }}>
            <form onSubmit={(e) => { e.preventDefault(); submitSearch(); }}>
              <input
                autoFocus
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="输入章:节，如 3:16"
                style={{ width: "100%", height: 36, padding: "0 10px", border: "1px solid var(--line)", borderRadius: 8, fontSize: 14 }}
              />
            </form>
            <div style={{ fontSize: 11, color: "var(--body)", paddingTop: 8 }}>回车跳转到对应经文</div>
          </div>
        )}
      </div>

      {/* verses */}
      <div className="screen-scroll" style={{ padding: "22px 24px 24px" }} onClick={() => picker && setPicker(null)}>
        <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>{displayBook}</div>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--body)", letterSpacing: "0.08em", marginBottom: 16 }}>
          第 {chapter} 章 · {version.label}
        </div>
        {!data && !loadError && (
          <div style={{ fontSize: 13, color: "var(--body)" }}>加载经文中…</div>
        )}
        {loadError && (
          <div style={{ fontSize: 13, color: "var(--body)" }}>经文加载失败，请检查网络后重试。</div>
        )}
        <div style={{ fontSize: 19, fontWeight: 400, lineHeight: 1.95, color: "var(--ink)", textWrap: "pretty" }}>
          {verses.map((v) => {
            const color = highlightMap.get(v.verse);
            const isSelected = v.verse === selected;
            return (
              <span key={v.label}>
                {v.heading && (
                  <span style={{ display: "block", fontSize: 14, fontWeight: 800, margin: "14px 0 6px", color: "var(--ink)" }}>{v.heading}</span>
                )}
                <span onClick={() => setSelected(isSelected ? null : v.verse)}>
                  <sup style={{ fontSize: 12, color: "var(--body)", margin: "0 4px" }}>{v.label}</sup>
                  <span
                    className="verse-text"
                    style={{
                      background: color ?? "transparent",
                      padding: color ? "1px 2px" : undefined,
                      outline: isSelected ? "2px dashed var(--ink)" : undefined,
                      outlineOffset: 2,
                      borderRadius: isSelected ? 2 : undefined,
                    }}
                    dangerouslySetInnerHTML={{ __html: v.text }}
                  />
                </span>
              </span>
            );
          })}
        </div>

        {/* chapter nav */}
        {data && (
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 26 }}>
            {chapter > 1 ? (
              <button onClick={() => gotoChapter(chapter - 1)} style={{ display: "flex", alignItems: "center", gap: 4, height: 38, padding: "0 16px", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 100, fontSize: 13, fontWeight: 700 }}>
                <Icon name="chevron-left" size={14} /> 上一章
              </button>
            ) : <div />}
            {chapter < maxChapter ? (
              <button onClick={() => gotoChapter(chapter + 1)} style={{ display: "flex", alignItems: "center", gap: 4, height: 38, padding: "0 16px", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 100, fontSize: 13, fontWeight: 700 }}>
                下一章 <Icon name="chevron-right" size={14} />
              </button>
            ) : <div />}
          </div>
        )}
      </div>

      {/* audio modal */}
      {picker === "audio" && (
        <>
          <div className="sheet-scrim" onClick={() => setPicker(null)} />
          <div style={{ position: "fixed", top: "50%", left: 20, right: 20, transform: "translateY(-50%)", background: "var(--white)", border: "1px solid var(--line)", borderRadius: 20, boxShadow: "0 24px 64px rgba(24,25,31,.28)", padding: "22px 24px", zIndex: 41 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--body)", marginBottom: 8 }}>
              <Icon name="play" size={14} />
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.14em" }}>AUDIO BIBLE</div>
              <div style={{ flex: 1 }} />
              <button className="icon-btn" style={{ width: 30, height: 30, borderRadius: 100 }} onClick={() => setPicker(null)}>
                <Icon name="x" size={13} />
              </button>
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 14 }}>收听 {displayBook} {chapter}</div>
            <div style={{ textAlign: "center", fontSize: 12, fontWeight: 600, color: "var(--body)", borderTop: "1px solid var(--surface-2)", paddingTop: 14 }}>
              音频朗读功能开发中，敬请期待
            </div>
          </div>
        </>
      )}

      {/* selection sheet (design 1b) */}
      {selectedVerse && (
        <>
          <div className="sheet-scrim" style={{ background: "rgba(24,25,31,.06)" }} onClick={closeSheet} />
          <div className="sheet">
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 14 }}>
              <div style={{ fontSize: 15, fontWeight: 800 }}>{displayBook} {chapter}:{selectedVerse.label}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--body)" }}>已选中 1 节</div>
              <div style={{ flex: 1 }} />
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--body)", letterSpacing: "0.06em" }}>{version.label}</div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 14px", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 800 }}>高亮</div>
              {HIGHLIGHT_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => { setHighlight(book.code, chapter, selectedVerse.verse, color); setStoreVersion((v) => v + 1); }}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center", width: 30, height: 30,
                    background: color, borderRadius: "50%",
                    border: highlightMap.get(selectedVerse.verse) === color ? "2px solid var(--ink)" : "1px solid var(--line)",
                  }}
                >
                  {highlightMap.get(selectedVerse.verse) === color && <Icon name="check" size={14} />}
                </button>
              ))}
              <div style={{ flex: 1 }} />
              <button
                title="取消高亮"
                onClick={() => { clearHighlight(book.code, chapter, selectedVerse.verse); setStoreVersion((v) => v + 1); }}
                style={{ width: 30, height: 30, borderRadius: "50%", border: "1px solid var(--line)", background: "linear-gradient(135deg,#FFFFFF 44%,#18191F 44%,#18191F 56%,#FFFFFF 56%)" }}
              />
            </div>

            {noteOpen ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (noteText.trim()) {
                    addNote(book.code, chapter, selectedVerse.verse, noteText.trim());
                    setStoreVersion((v) => v + 1);
                    setNoteText("");
                    setNoteOpen(false);
                  }
                }}
                style={{ display: "flex", gap: 8, marginBottom: 8 }}
              >
                <input
                  autoFocus
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="写下你的笔记…"
                  style={{ flex: 1, height: 40, padding: "0 12px", border: "1px solid var(--line)", borderRadius: 12, fontSize: 14 }}
                />
                <button type="submit" style={{ height: 40, padding: "0 16px", background: "var(--purple)", borderRadius: 100, color: "#fff", fontSize: 13, fontWeight: 800 }}>保存</button>
              </form>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10 }}>
                {[
                  { label: "笔记", icon: "edit", onClick: () => setNoteOpen(true) },
                  { label: "复制", icon: "align-justify", onClick: copyVerse },
                  { label: "分享", icon: "share", onClick: shareVerse },
                  { label: "慧读", icon: "star", onClick: askHuidu, primary: true },
                  { label: "注释", icon: "message-square", onClick: () => navigate(`/annotations?bk=${book.code}&c=${chapter}`) },
                ].map((a) => (
                  <button key={a.label} onClick={a.onClick} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
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

            {selectedNotes.length > 0 && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--surface-2)" }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "var(--body)", marginBottom: 6 }}>我的笔记</div>
                {selectedNotes.map((n) => (
                  <div key={n.id} style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.7, marginBottom: 4 }}>· {n.content}</div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
