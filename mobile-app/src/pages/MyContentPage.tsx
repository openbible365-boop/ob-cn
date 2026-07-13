import { useNavigate, useSearchParams } from "react-router-dom";
import { Icon } from "../components/Icon";
import { getHighlights, getNotes } from "../data/annotations";
import { BOOK, getVerse } from "../data/scripture";

const TABS = [
  { id: "highlights", label: "高亮" },
  { id: "notes", label: "笔记" },
  { id: "posts", label: "帖子" },
] as const;

function fmtDate(iso: string) {
  return iso.slice(5, 10).replace("-", "/");
}

// 我的内容（design 5b）— lists the real local highlights & notes.
export function MyContentPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.id === params.get("t")) ? (params.get("t") as string) : "highlights";

  const highlights = [...getHighlights()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const notes = getNotes();

  return (
    <div className="screen" style={{ background: "var(--surface)" }}>
      <div className="page-header">
        <button className="icon-btn" onClick={() => navigate("/me")}><Icon name="chevron-left" size={18} /></button>
        <div className="title">我的内容</div>
      </div>

      <div style={{ flex: "none", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", background: "var(--white)", borderBottom: "1px solid var(--line)", padding: "0 16px" }}>
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setParams({ t: t.id })} style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", height: 42, fontSize: 14, fontWeight: tab === t.id ? 800 : 600, color: tab === t.id ? "var(--ink)" : "var(--body)" }}>
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
            {highlights.map((h) => {
              const v = getVerse(h.chapter, h.verse);
              return (
                <button
                  key={`${h.chapter}:${h.verse}`}
                  className="card"
                  onClick={() => navigate(`/bible?c=${h.chapter}`)}
                  style={{ display: "flex", gap: 12, padding: "13px 14px", textAlign: "left" }}
                >
                  <div style={{ flex: "none", width: 4, borderRadius: 100, background: h.color }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                      <div style={{ fontSize: 11, fontWeight: 800, background: h.color, borderRadius: 6, padding: "2px 8px" }}>
                        {BOOK} {h.chapter}:{h.verse}
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--body)" }}>{fmtDate(h.createdAt)}</div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.7, color: "var(--body)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      {v?.text ?? ""}
                    </div>
                  </div>
                  <div style={{ alignSelf: "center", color: "var(--body)" }}><Icon name="chevron-right" size={15} /></div>
                </button>
              );
            })}
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
                onClick={() => navigate(`/bible?c=${n.chapter}`)}
                style={{ display: "flex", flexDirection: "column", gap: 6, padding: "13px 14px", textAlign: "left", alignItems: "stretch" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, background: "var(--surface-2)", borderRadius: 6, padding: "2px 8px" }}>
                    {BOOK} {n.chapter}:{n.verse}
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
