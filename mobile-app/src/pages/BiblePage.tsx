import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Icon } from "../components/Icon";
import { BOOK, MAX_CHAPTER, getChapter } from "../data/scripture";
import {
  HIGHLIGHT_COLORS,
  getHighlights,
  setHighlight,
  clearHighlight,
  getNotes,
  addNote,
} from "../data/annotations";
import { startConversation } from "../data/huidu";

const CHAPTERS = Array.from({ length: MAX_CHAPTER }, (_, i) => i + 1);

export function BiblePage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const chapter = Math.min(Math.max(Number(params.get("c")) || 3, 1), MAX_CHAPTER);

  const [selected, setSelected] = useState<number | null>(null);
  const [picker, setPicker] = useState<null | "chapter" | "search" | "audio">(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [searchText, setSearchText] = useState("");
  const [version, setVersion] = useState(0); // bump to re-read stores

  const verses = useMemo(() => getChapter(chapter), [chapter]);
  const highlights = useMemo(() => {
    void version;
    return getHighlights().filter((h) => h.chapter === chapter);
  }, [chapter, version]);
  const highlightMap = new Map(highlights.map((h) => [h.verse, h.color]));
  const notes = useMemo(() => {
    void version;
    return getNotes().filter((n) => n.chapter === chapter);
  }, [chapter, version]);

  const selectedVerse = selected != null ? verses.find((v) => v.verse === selected) ?? null : null;
  const selectedNotes = selected != null ? notes.filter((n) => n.verse === selected) : [];

  const gotoChapter = (c: number) => {
    setParams({ c: String(c) });
    setSelected(null);
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
      const c = Math.min(Math.max(Number(m[1]), 1), MAX_CHAPTER);
      setParams({ c: String(c) });
      setSelected(Number(m[2]));
    }
    setSearchText("");
    setPicker(null);
  };

  const askHuidu = () => {
    if (!selectedVerse) return;
    const conv = startConversation(chapter, selectedVerse.verse, selectedVerse.text);
    navigate(`/huidu/${conv.id}`, { state: { justCreated: true } });
  };

  const copyVerse = async () => {
    if (!selectedVerse) return;
    try {
      await navigator.clipboard.writeText(`${BOOK} ${chapter}:${selectedVerse.verse} ${selectedVerse.text}`);
    } catch {
      /* clipboard unavailable */
    }
    closeSheet();
  };

  const shareVerse = async () => {
    if (!selectedVerse) return;
    const text = `${BOOK} ${chapter}:${selectedVerse.verse} ${selectedVerse.text}`;
    try {
      if (navigator.share) await navigator.share({ text });
      else await navigator.clipboard.writeText(text);
    } catch {
      /* user cancelled */
    }
    closeSheet();
  };

  return (
    <div className="screen">
      {/* top bar (design 1a) */}
      <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 8, padding: "10px 16px 14px", borderBottom: "1px solid var(--line)", position: "relative" }}>
        <button style={{ display: "flex", alignItems: "center", gap: 6, height: 40, padding: "0 12px", background: "var(--yellow)", border: "1px solid var(--line)", borderRadius: 12, boxShadow: "var(--shadow-card)", fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>
          和合本 <Icon name="chevron-down" size={16} />
        </button>
        <button
          onClick={() => setPicker(picker === "chapter" ? null : "chapter")}
          style={{ display: "flex", alignItems: "center", gap: 6, height: 40, padding: "0 12px", background: "var(--white)", border: "1px solid var(--line)", borderRadius: 12, boxShadow: "var(--shadow-card)", fontSize: 14, fontWeight: 700, color: "var(--ink)" }}
        >
          {BOOK} {chapter} <Icon name="chevron-down" size={16} />
        </button>
        <div style={{ flex: 1 }} />
        <button className="icon-btn" style={{ background: "rgba(191,120,246,.16)", color: "var(--purple)" }} title="有声圣经" onClick={() => setPicker("audio")}>
          <Icon name="play" size={18} />
        </button>
        <button className="icon-btn" onClick={() => setPicker(picker === "search" ? null : "search")}>
          <Icon name="search" size={18} />
        </button>

        {picker === "chapter" && (
          <div style={{ position: "absolute", top: 58, left: 16, right: 16, background: "var(--white)", border: "1px solid var(--line)", borderRadius: 16, boxShadow: "0 12px 32px rgba(48,49,51,.16)", padding: 12, zIndex: 30 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: "var(--body)", marginBottom: 8 }}>{BOOK} · 选择章</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
              {CHAPTERS.map((n) => (
                <button
                  key={n}
                  onClick={() => gotoChapter(n)}
                  style={{
                    height: 34, borderRadius: 8, fontSize: 13, fontWeight: 700,
                    border: "1px solid var(--line)",
                    background: n === chapter ? "var(--ink)" : "var(--white)",
                    color: n === chapter ? "var(--yellow)" : "var(--ink)",
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
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
        <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>{BOOK}</div>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--body)", letterSpacing: "0.08em", marginBottom: 16 }}>
          第 {chapter} 章 · 和合本
        </div>
        <p style={{ fontSize: 19, fontWeight: 400, lineHeight: 1.95, color: "var(--ink)", textWrap: "pretty" }}>
          {verses.map((v) => {
            const color = highlightMap.get(v.verse);
            const isSelected = v.verse === selected;
            return (
              <span key={v.verse} onClick={() => setSelected(isSelected ? null : v.verse)}>
                <sup style={{ fontSize: 12, color: "var(--body)", margin: "0 4px" }}>{v.verse}</sup>
                <span
                  style={{
                    background: color ?? "transparent",
                    padding: color ? "1px 2px" : undefined,
                    outline: isSelected ? "2px dashed var(--ink)" : undefined,
                    outlineOffset: 2,
                    borderRadius: isSelected ? 2 : undefined,
                  }}
                >
                  {v.text}
                </span>
              </span>
            );
          })}
        </p>
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
            <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 14 }}>收听 {BOOK} {chapter}</div>
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
              <div style={{ fontSize: 15, fontWeight: 800 }}>{BOOK} {chapter}:{selectedVerse.verse}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--body)" }}>已选中 1 节</div>
              <div style={{ flex: 1 }} />
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--body)", letterSpacing: "0.06em" }}>和合本</div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 14px", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 800 }}>高亮</div>
              {HIGHLIGHT_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => { setHighlight(chapter, selectedVerse.verse, color); setVersion((v) => v + 1); }}
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
                onClick={() => { clearHighlight(chapter, selectedVerse.verse); setVersion((v) => v + 1); }}
                style={{ width: 30, height: 30, borderRadius: "50%", border: "1px solid var(--line)", background: "linear-gradient(135deg,#FFFFFF 44%,#18191F 44%,#18191F 56%,#FFFFFF 56%)" }}
              />
            </div>

            {noteOpen ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (noteText.trim()) {
                    addNote(chapter, selectedVerse.verse, noteText.trim());
                    setVersion((v) => v + 1);
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
                  { label: "注释", icon: "message-square", onClick: () => navigate(`/annotations?c=${chapter}`) },
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
