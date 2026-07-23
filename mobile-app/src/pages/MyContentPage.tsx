import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Icon } from "../components/Icon";
import { getHighlights, getNotes, HIGHLIGHTS_CHANGED_EVENT } from "../data/annotations";
import {
  getVersion,
  getBookByCode,
  getReading,
  bookName,
  loadBook,
  stripHtml,
  type BookData,
} from "../data/scripture";

const TABS = [
  { id: "highlights", label: "高亮" },
  { id: "notes", label: "笔记" },
  { id: "posts", label: "帖子" },
] as const;

function fmtDate(iso: string) {
  return iso.slice(5, 10).replace("-", "/");
}

function verseRangeLabel(verses: number[]) {
  const sorted = [...new Set(verses)].sort((a, b) => a - b);
  const ranges: string[] = [];
  for (let index = 0; index < sorted.length; index += 1) {
    const start = sorted[index];
    let end = start;
    while (index + 1 < sorted.length && sorted[index + 1] === end + 1) {
      end = sorted[index + 1];
      index += 1;
    }
    ranges.push(start === end ? String(start) : `${start}-${end}`);
  }
  return ranges.join("、");
}

// 我的内容（design 5b）— lists the real local highlights & notes.
export function MyContentPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.id === params.get("t")) ? (params.get("t") as string) : "highlights";
  const [, refreshHighlights] = useState(0);

  useEffect(() => {
    const refresh = () => refreshHighlights((value) => value + 1);
    window.addEventListener(HIGHLIGHTS_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(HIGHLIGHTS_CHANGED_EVENT, refresh);
  }, []);

  const fallbackVersion = getVersion(getReading().version);
  const highlights = [...getHighlights()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const notes = getNotes();
  const bookReferenceKey = [...highlights, ...notes]
    .map((item) => `${item.version ?? fallbackVersion.code}:${item.book}`)
    .sort()
    .join(",");

  // Load the books referenced by highlights so we can preview verse text.
  const [books, setBooks] = useState<Map<string, BookData>>(new Map());
  useEffect(() => {
    const refs = [...highlights, ...notes].map((item) => `${item.version ?? fallbackVersion.code}:${item.book}`);
    const codes = [...new Set(refs)];
    let cancelled = false;
    for (const ref of codes) {
      if (books.has(ref)) continue;
      const [versionCode, code] = ref.split(":");
      loadBook(versionCode, code)
        .then((data) => {
          if (!cancelled) setBooks((prev) => new Map(prev).set(ref, data));
        })
        .catch(() => { /* preview stays empty */ });
    }
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookReferenceKey, fallbackVersion.code]);

  const verseText = (bookCode: string, chapter: number, verse: number, versionCode?: string) => {
    const data = books.get(`${versionCode ?? fallbackVersion.code}:${bookCode}`);
    const v = data?.chapters.get(chapter)?.find((x) => x.verse === verse);
    return v ? stripHtml(v.text) : "";
  };

  const refLabel = (bookCode: string, chapter: number, verse: number, versionCode?: string) => {
    const itemVersion = getVersion(versionCode ?? fallbackVersion.code);
    return `${bookName(getBookByCode(bookCode), itemVersion)} ${chapter}:${verse} · ${itemVersion.label}`;
  };

  return (
    <div className="screen" style={{ background: "var(--surface)" }}>
      <div className="page-header">
        <button className="icon-btn" onClick={() => navigate("/me")}><Icon name="chevron-left" size={18} /></button>
        <div className="title">我的内容</div>
      </div>

      <div style={{ flex: "none", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", background: "var(--white)", borderBottom: "1px solid var(--line)", padding: "0 16px" }}>
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setParams({ t: t.id })} style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", height: 44, fontSize: 14, fontWeight: tab === t.id ? 800 : 600, color: tab === t.id ? "var(--ink)" : "var(--body)" }}>
            {t.label}
            {tab === t.id && (
              <div style={{ position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)", width: 28, height: 3, background: "var(--purple)", borderRadius: 100 }} />
            )}
          </button>
        ))}
      </div>

      <div className="screen-scroll" style={{ padding: "14px 16px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
        {tab === "highlights" && (
          <>
            {highlights.map((h) => (
              <button
                key={`${h.book}:${h.chapter}:${h.verse}`}
                className="card"
                onClick={() => navigate(`/bible?t=${h.version ?? fallbackVersion.code}&bk=${h.book}&c=${h.chapter}&v=${h.verse}`)}
                style={{ display: "flex", gap: 12, padding: "13px 14px", textAlign: "left" }}
              >
                <div style={{ flex: "none", width: 4, borderRadius: 100, background: h.color }} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, background: h.color, borderRadius: 6, padding: "2px 8px" }}>
                      {refLabel(h.book, h.chapter, h.verse, h.version)}
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--body)" }}>{fmtDate(h.createdAt)}</div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.7, color: "var(--body)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                    {verseText(h.book, h.chapter, h.verse, h.version)}
                  </div>
                </div>
                <div style={{ alignSelf: "center", color: "var(--body)" }}><Icon name="chevron-right" size={15} /></div>
              </button>
            ))}
            {highlights.length === 0 && (
              <div style={{ fontSize: 13, color: "var(--body)", padding: "8px 2px" }}>还没有高亮。在阅读页点选经文，选择颜色即可。</div>
            )}
          </>
        )}

        {tab === "notes" && (
          <>
            {notes.map((n) => (
              <button
                key={n.id}
                className="card"
                onClick={() => navigate(`/bible?t=${n.version ?? fallbackVersion.code}&bk=${n.book}&c=${n.chapter}&v=${n.verse}`)}
                style={{ display: "flex", flexDirection: "column", gap: 6, padding: "13px 14px", textAlign: "left", alignItems: "stretch" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, background: "var(--surface-2)", borderRadius: 6, padding: "2px 8px" }}>
                    {`${bookName(getBookByCode(n.book), getVersion(n.version ?? fallbackVersion.code))} ${n.chapter}:${verseRangeLabel(n.verses ?? [n.verse])} · ${getVersion(n.version ?? fallbackVersion.code).label}`}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--body)" }}>{fmtDate(n.createdAt)}</div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.7 }}>{n.content}</div>
              </button>
            ))}
            {notes.length === 0 && (
              <div style={{ fontSize: 13, color: "var(--body)", padding: "8px 2px" }}>还没有笔记。在阅读页点选经文，选择「笔记」即可。</div>
            )}
          </>
        )}

        {tab === "posts" && (
          <div style={{ fontSize: 13, color: "var(--body)", padding: "8px 2px", lineHeight: 1.7 }}>
            社群发帖功能接入账号服务后开放，届时你的帖子会汇总在这里。
          </div>
        )}
      </div>
    </div>
  );
}
