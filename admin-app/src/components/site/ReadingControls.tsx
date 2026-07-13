"use client";

import { useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

// John has 21 chapters (this site only carries 约翰福音 for now).
const CHAPTERS = Array.from({ length: 21 }, (_, i) => i + 1);
const BOOK = "约翰福音";

function Chevron() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export function ReadingControls() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [open, setOpen] = useState<null | "translation" | "chapter" | "search" | "audio">(null);
  const [query, setQuery] = useState("");

  // Reading-only controls — hidden on other tabs.
  if (pathname !== "/bible") return null;

  const chapter = Math.min(Math.max(Number(searchParams.get("c")) || 3, 1), 21);

  const close = () => setOpen(null);

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    const cv = q.match(/^(\d+)\s*[:：]\s*(\d+)$/);
    const vOnly = q.match(/^(\d+)$/);
    if (cv) {
      router.push(`/bible?c=${Math.min(Math.max(Number(cv[1]), 1), 21)}&v=${Number(cv[2])}`);
    } else if (vOnly) {
      router.push(`/bible?c=${chapter}&v=${Number(vOnly[1])}`);
    }
    setQuery("");
    close();
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, position: "relative" }}>
      {open && (
        <div onClick={close} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
      )}

      {/* translation */}
      <div style={{ position: "relative", zIndex: 41 }}>
        <button
          type="button"
          onClick={() => setOpen(open === "translation" ? null : "translation")}
          style={{ display: "flex", alignItems: "center", gap: 6, height: 36, padding: "0 12px", background: "var(--yellow)", border: "1px solid var(--line)", borderRadius: 12, boxShadow: "var(--shadow-card)", fontSize: 13, fontWeight: 700, color: "var(--ink)", cursor: "pointer" }}
        >
          和合本 <Chevron />
        </button>
        {open === "translation" && (
          <div style={{ position: "absolute", top: 42, left: 0, background: "var(--white)", border: "1px solid var(--line)", borderRadius: 12, boxShadow: "var(--shadow-float)", padding: 6, minWidth: 140 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "var(--surface)", borderRadius: 8, fontSize: 13, fontWeight: 700 }}>
              和合本
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--purple)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: "auto" }}><polyline points="20 6 9 17 4 12" /></svg>
            </div>
            <div style={{ fontSize: 11, color: "var(--body)", padding: "6px 10px 2px" }}>更多译本即将上线</div>
          </div>
        )}
      </div>

      {/* book / chapter */}
      <div style={{ position: "relative", zIndex: 41 }}>
        <button
          type="button"
          onClick={() => setOpen(open === "chapter" ? null : "chapter")}
          style={{ display: "flex", alignItems: "center", gap: 6, height: 36, padding: "0 12px", background: "var(--white)", border: "1px solid var(--line)", borderRadius: 12, boxShadow: "var(--shadow-card)", fontSize: 13, fontWeight: 700, color: "var(--ink)", cursor: "pointer" }}
        >
          {BOOK} {chapter} <Chevron />
        </button>
        {open === "chapter" && (
          <div style={{ position: "absolute", top: 42, left: 0, background: "var(--white)", border: "1px solid var(--line)", borderRadius: 12, boxShadow: "var(--shadow-float)", padding: 8, width: 240 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: "var(--body)", padding: "2px 4px 8px" }}>{BOOK} · 选择章</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
              {CHAPTERS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => { router.push(`/bible?c=${n}`); close(); }}
                  style={{
                    height: 28, borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer",
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
      </div>

      {/* audio bible */}
      <button
        type="button"
        title="有声圣经"
        onClick={() => setOpen("audio")}
        style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, background: "rgba(191,120,246,.16)", border: "1px solid var(--line)", borderRadius: 12, color: "var(--purple)", cursor: "pointer", zIndex: 41 }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3" /></svg>
      </button>

      {/* search */}
      <div style={{ position: "relative", zIndex: 41 }}>
        <button
          type="button"
          title="搜索经文"
          onClick={() => setOpen(open === "search" ? null : "search")}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, background: "var(--white)", border: "1px solid var(--line)", borderRadius: 12, color: "var(--ink)", cursor: "pointer" }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
        </button>
        {open === "search" && (
          <form onSubmit={submitSearch} style={{ position: "absolute", top: 42, right: 0, background: "var(--white)", border: "1px solid var(--line)", borderRadius: 12, boxShadow: "var(--shadow-float)", padding: 10, width: 240 }}>
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="输入章:节，如 3:16"
              style={{ width: "100%", height: 34, padding: "0 10px", border: "1px solid var(--line)", borderRadius: 8, fontSize: 13 }}
            />
            <div style={{ fontSize: 11, color: "var(--body)", padding: "8px 2px 2px" }}>回车跳转到对应经文</div>
          </form>
        )}
      </div>

      {/* audio modal */}
      {open === "audio" && (
        <div onClick={close} style={{ position: "fixed", inset: 0, background: "rgba(24,25,31,.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 460, background: "var(--white)", border: "1px solid var(--line)", borderRadius: 20, boxShadow: "0 24px 64px rgba(24,25,31,.28)", padding: "22px 24px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--body)", marginBottom: 8 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3" /></svg>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.14em" }}>AUDIO BIBLE</div>
              <div style={{ flex: 1 }} />
              <button type="button" onClick={close} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 100, color: "var(--body)", cursor: "pointer" }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 18 }}>收听 {BOOK} {chapter}</div>
            <div style={{ height: 4, background: "var(--surface-2)", borderRadius: 100, marginBottom: 6 }}>
              <div style={{ width: "0%", height: "100%", background: "var(--purple)", borderRadius: 100 }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 600, color: "var(--body)", marginBottom: 16 }}><div>0:00</div><div>--:--</div></div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 24, marginBottom: 14, opacity: 0.4 }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#18191F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 19 2 12 11 5 11 19" /><polygon points="22 19 13 12 22 5 22 19" /></svg>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 60, height: 60, background: "var(--ink)", borderRadius: "50%", color: "#fff" }}><svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg></div>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#18191F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 19 22 12 13 5 13 19" /><polygon points="2 19 11 12 2 5 2 19" /></svg>
            </div>
            <div style={{ textAlign: "center", fontSize: 11, fontWeight: 600, color: "var(--body)", borderTop: "1px solid var(--surface-2)", paddingTop: 14 }}>音频朗读功能开发中，敬请期待</div>
          </div>
        </div>
      )}
    </div>
  );
}
