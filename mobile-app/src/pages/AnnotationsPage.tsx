import { useSearchParams } from "react-router-dom";
import { Icon } from "../components/Icon";
import { BOOK, MAX_CHAPTER, getCommentary } from "../data/scripture";

// 注释页（design 2b）
export function AnnotationsPage() {
  const [params, setParams] = useSearchParams();
  const chapter = Math.min(Math.max(Number(params.get("c")) || 3, 1), MAX_CHAPTER);
  const commentary = getCommentary(chapter);

  return (
    <div className="screen">
      <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 8, padding: "10px 16px 14px", borderBottom: "1px solid var(--line)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, height: 40, padding: "0 12px", background: "var(--yellow)", border: "1px solid var(--line)", borderRadius: 12, boxShadow: "var(--shadow-card)", fontSize: 14, fontWeight: 700 }}>
          和合本 <Icon name="chevron-down" size={16} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, height: 40, padding: "0 12px", background: "var(--white)", border: "1px solid var(--line)", borderRadius: 12, boxShadow: "var(--shadow-card)", fontSize: 14, fontWeight: 700 }}>
          {BOOK} {chapter}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {chapter > 1 && (
            <button className="icon-btn" onClick={() => setParams({ c: String(chapter - 1) })}><Icon name="chevron-left" size={16} /></button>
          )}
          {chapter < MAX_CHAPTER && (
            <button className="icon-btn" onClick={() => setParams({ c: String(chapter + 1) })}><Icon name="chevron-right" size={16} /></button>
          )}
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", alignItems: "center", height: 40, padding: "0 12px", background: "rgba(191,120,246,.16)", border: "1px solid var(--line)", borderRadius: 12, boxShadow: "var(--shadow-card)", fontSize: 13, fontWeight: 700 }}>
          精读本注释
        </div>
      </div>

      <div className="screen-scroll" style={{ padding: "22px 24px 24px" }}>
        <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>{BOOK} 第 {chapter} 章</div>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--body)", letterSpacing: "0.08em", marginBottom: 16 }}>
          精读本注释 · 逐段释义
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {commentary.map((c) => (
            <div key={c.title} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{
                alignSelf: "flex-start", fontSize: 12, fontWeight: 800,
                ...(c.highlight
                  ? { background: "var(--yellow)", borderRadius: 6, padding: "2px 8px" }
                  : { color: "var(--purple)" }),
              }}>
                {c.title}
              </div>
              <p style={{ fontSize: 15, fontWeight: 400, lineHeight: 1.85, color: "var(--ink)", textWrap: "pretty" }}>{c.body}</p>
            </div>
          ))}
          {commentary.length === 0 && (
            <div style={{ fontSize: 13, color: "var(--body)" }}>本章暂无精读本注释。</div>
          )}
        </div>
      </div>
    </div>
  );
}
