import { useEffect, useState } from "react";
import { useAppBack } from "../hooks/useAppBack";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Icon } from "../components/Icon";
import { EmptyState } from "../components/EmptyState";
import { UnifiedHeader } from "../components/UnifiedHeader";
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
] as const;

// 按本机时区显示：直接切 ISO 字符串是 UTC，晚上记的内容会错标成"第二天"。
// 今天的记录看钟点有意义，更早的只看日期。
function fmtDate(iso: string) {
  const date = new Date(iso);
  if (date.toDateString() === new Date().toDateString()) {
    return new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
  }
  return new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric" }).format(date);
}

// 我的内容（design 5b）— lists the real local highlights & notes.
export function MyContentPage() {
  const navigate = useNavigate();
  const goBack = useAppBack("/me");
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
    <div className="screen">
      <UnifiedHeader title="我的内容" subtitle="内容记录" ariaLabel="我的内容" onBack={goBack} backLabel="返回我的" />

      <div className="record-tabs" role="tablist" aria-label="内容类型">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={tab === t.id ? "active" : ""} onClick={() => setParams({ t: t.id })}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="screen-scroll record-scroll">
        {tab === "highlights" && (
          <>
            {highlights.map((h) => (
              <button
                key={`${h.book}:${h.chapter}:${h.verse}`}
                className="card record-card"
                onClick={() => navigate(`/bible?t=${h.version ?? fallbackVersion.code}&bk=${h.book}&c=${h.chapter}&v=${h.verse}`)}
              >
                <i className="record-rail" style={{ background: h.color }} aria-hidden="true" />
                <div className="record-body">
                  <div className="record-meta">
                    <span className="record-chip" style={{ background: h.color }}>{refLabel(h.book, h.chapter, h.verse, h.version)}</span>
                    <span className="record-date">{fmtDate(h.createdAt)}</span>
                  </div>
                  <div className="record-preview">{verseText(h.book, h.chapter, h.verse, h.version)}</div>
                </div>
                <Icon name="chevron-right" size={16} className="record-caret" />
              </button>
            ))}
            {highlights.length === 0 && (
              <EmptyState art="content" title="还没有高亮" desc="在阅读页点选经文，选择颜色即可收进这里。" />
            )}
          </>
        )}

        {tab === "notes" && (
          <>
            {notes.map((n) => (
              <button
                key={n.id}
                className="card record-card is-note"
                onClick={() => navigate(`/bible?t=${n.version ?? fallbackVersion.code}&bk=${n.book}&c=${n.chapter}&v=${n.verse}`)}
              >
                <div className="record-meta">
                  <span className="record-chip is-plain">{refLabel(n.book, n.chapter, n.verse, n.version)}</span>
                  <span className="record-date">{fmtDate(n.createdAt)}</span>
                </div>
                <div className="record-note-text">{n.content}</div>
              </button>
            ))}
            {notes.length === 0 && (
              <EmptyState art="content" title="还没有笔记" desc="在阅读页点选经文，选择「笔记」即可记下想法。" />
            )}
          </>
        )}
      </div>
    </div>
  );
}
