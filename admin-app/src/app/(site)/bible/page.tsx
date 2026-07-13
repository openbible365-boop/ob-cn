import Link from "next/link";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { setHighlight, clearHighlight } from "@/lib/actions/site/reading";
import { HIGHLIGHT_COLORS } from "@/lib/reading-constants";
import { startConversation } from "@/lib/actions/site/huidu";
import { NoteComposer } from "@/components/site/NoteComposer";

const BOOK = "约翰福音";
const TRANSLATION = "和合本";

export default async function BiblePage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string; v?: string }>;
}) {
  const { c, v } = await searchParams;
  const user = await getCurrentUser();

  const chapterCount = await db.verse.aggregate({ where: { translation: TRANSLATION, book: BOOK }, _max: { chapter: true } });
  const maxChapter = chapterCount._max.chapter ?? 1;
  const chapter = Math.min(Math.max(Number(c) || 3, 1), maxChapter);
  const selectedVerse = v ? Number(v) : null;

  const [verses, commentary, highlights, notes] = await Promise.all([
    db.verse.findMany({ where: { translation: TRANSLATION, book: BOOK, chapter }, orderBy: { verse: "asc" } }),
    db.commentary.findMany({ where: { book: BOOK, chapter }, orderBy: { rangeStart: "asc" } }),
    db.highlight.findMany({ where: { userId: user.id, book: BOOK, chapter } }),
    db.note.findMany({ where: { userId: user.id, book: BOOK, chapter }, orderBy: { createdAt: "desc" } }),
  ]);

  const highlightMap = new Map(highlights.map((h) => [h.verse, h.color]));
  const selectedVerseData = selectedVerse ? verses.find((x) => x.verse === selectedVerse) : null;
  const selectedNotes = selectedVerse ? notes.filter((n) => n.verse === selectedVerse) : [];

  const recentConversations = await db.conversation.findMany({
    where: { userId: user.id, book: BOOK, chapter },
    orderBy: { createdAt: "desc" },
    take: 3,
  });

  const hrefFor = (ch: number, verse?: number) =>
    `/bible?c=${ch}${verse ? `&v=${verse}` : ""}`;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      {/* chapter / translation nav */}
      <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 8, padding: "10px 28px", borderBottom: "1px solid var(--line)", background: "var(--white)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, height: 36, padding: "0 12px", background: "var(--yellow)", border: "1px solid var(--line)", borderRadius: 12, fontSize: 13, fontWeight: 700 }}>和合本</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, height: 36, padding: "0 12px", background: "var(--white)", border: "1px solid var(--line)", borderRadius: 12, fontSize: 13, fontWeight: 700 }}>{BOOK} {chapter}</div>
        <div style={{ display: "flex", gap: 6, marginLeft: 6 }}>
          {chapter > 1 && <Link href={hrefFor(chapter - 1)} className="icon-btn" style={{ width: 36, height: 36, textDecoration: "none" }}>‹</Link>}
          {chapter < maxChapter && <Link href={hrefFor(chapter + 1)} className="icon-btn" style={{ width: 36, height: 36, textDecoration: "none" }}>›</Link>}
        </div>
        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--body)", marginLeft: 4 }}>共 {maxChapter} 章</div>
      </div>

      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        {/* verses */}
        <div style={{ flex: 1, padding: "32px 40px", overflow: "auto", borderRight: "1px solid var(--line)" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 20 }}>
            <div style={{ fontSize: 26, fontWeight: 800 }}>{BOOK} 第 {chapter} 章</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--body)", letterSpacing: "0.08em" }}>和合本</div>
          </div>

          <p style={{ margin: 0, fontSize: 18, fontWeight: 400, lineHeight: 2, textWrap: "pretty" }}>
            {verses.map((verse) => {
              const color = highlightMap.get(verse.verse);
              const isSelected = verse.verse === selectedVerse;
              return (
                <Link
                  key={verse.id}
                  href={isSelected ? hrefFor(chapter) : hrefFor(chapter, verse.verse)}
                  scroll={false}
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  <sup style={{ fontSize: 12, fontWeight: 400, color: "var(--body)", margin: "0 4px" }}>{verse.verse}</sup>
                  <span
                    style={{
                      background: color ?? "transparent",
                      padding: color ? "1px 2px" : undefined,
                      outline: isSelected ? "2px dashed var(--ink)" : undefined,
                      outlineOffset: 2,
                      borderRadius: isSelected ? 2 : undefined,
                      cursor: "pointer",
                    }}
                  >
                    {verse.text}
                  </span>
                </Link>
              );
            })}
          </p>

          {/* selection toolbar */}
          {selectedVerseData && (
            <div className="card" style={{ marginTop: 24, padding: "14px 16px" }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12 }}>
                <div style={{ fontSize: 15, fontWeight: 800 }}>{BOOK} {chapter}:{selectedVerseData.verse}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--body)" }}>已选中 1 节</div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 14px", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 800 }}>高亮</div>
                {HIGHLIGHT_COLORS.map((color) => (
                  <form key={color} action={setHighlight}>
                    <input type="hidden" name="book" value={BOOK} />
                    <input type="hidden" name="chapter" value={chapter} />
                    <input type="hidden" name="verse" value={selectedVerseData.verse} />
                    <input type="hidden" name="color" value={color} />
                    <button type="submit" title="设为高亮" style={{
                      display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28,
                      background: color, border: highlightMap.get(selectedVerseData.verse) === color ? "2px solid var(--ink)" : "1px solid var(--line)",
                      borderRadius: "50%", cursor: "pointer",
                    }} />
                  </form>
                ))}
                <div style={{ flex: 1 }} />
                <form action={clearHighlight}>
                  <input type="hidden" name="book" value={BOOK} />
                  <input type="hidden" name="chapter" value={chapter} />
                  <input type="hidden" name="verse" value={selectedVerseData.verse} />
                  <button type="submit" title="取消高亮" style={{
                    width: 28, height: 28, borderRadius: "50%", cursor: "pointer",
                    background: "linear-gradient(135deg,#FFFFFF 44%,#18191F 44%,#18191F 56%,#FFFFFF 56%)", border: "1px solid var(--line)",
                  }} />
                </form>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <NoteComposer book={BOOK} chapter={chapter} verse={selectedVerseData.verse} />
                <form action={startConversation}>
                  <input type="hidden" name="book" value={BOOK} />
                  <input type="hidden" name="chapter" value={chapter} />
                  <input type="hidden" name="verseStart" value={selectedVerseData.verse} />
                  <input type="hidden" name="translation" value={TRANSLATION} />
                  <button type="submit" style={{ display: "flex", alignItems: "center", gap: 5, height: 30, padding: "0 14px", background: "var(--purple)", border: "none", borderRadius: 100, color: "#fff", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>问慧读</button>
                </form>
              </div>

              {selectedNotes.length > 0 && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--surface-2)" }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "var(--body)", marginBottom: 8 }}>我的笔记</div>
                  {selectedNotes.map((n) => (
                    <div key={n.id} style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.7, marginBottom: 6 }}>· {n.content}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* commentary sidebar */}
        <div style={{ flex: "none", width: 340, display: "flex", flexDirection: "column", background: "var(--surface)", borderRight: "1px solid var(--line)" }}>
          <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 10, padding: "16px 20px 12px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 26, height: 26, background: "var(--yellow)", borderRadius: 8, fontSize: 12, fontWeight: 800 }}>精</div>
            <div style={{ fontSize: 14, fontWeight: 800 }}>精读本注释</div>
          </div>
          <div style={{ flex: 1, overflow: "auto", padding: "0 16px 16px" }}>
            {commentary.map((cmt) => (
              <div key={cmt.id} className="card" style={{ borderRadius: 16, padding: "16px 18px", marginBottom: 10 }}>
                <div style={{ display: "inline-block", fontSize: 11, fontWeight: 800, marginBottom: 8, ...(cmt.highlight ? { background: "var(--yellow)", borderRadius: 6, padding: "2px 8px" } : { color: "var(--purple)" }) }}>{cmt.title}</div>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 400, lineHeight: 1.85, color: "var(--ink)", textWrap: "pretty" }}>{cmt.body}</p>
              </div>
            ))}
            {commentary.length === 0 && (
              <div style={{ fontSize: 12, color: "var(--body)", padding: "8px 2px" }}>本章暂无精读本注释。</div>
            )}
          </div>
        </div>

        {/* huidu sidebar */}
        <div style={{ flex: "none", width: 360, display: "flex", flexDirection: "column", background: "var(--white)" }}>
          <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 10, padding: "16px 20px 12px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 26, height: 26, background: "var(--purple)", borderRadius: 100, color: "#fff" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l2.2 6.3L20.5 12l-6.3 2.7L12 21l-2.2-6.3L3.5 12l6.3-2.7z" /><path d="M19 2v4" /><path d="M17 4h4" /></svg>
            </div>
            <div style={{ fontSize: 14, fontWeight: 800 }}>慧读</div>
          </div>
          <div style={{ flex: 1, overflow: "auto", padding: "0 16px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
            {selectedVerseData ? (
              <>
                <div style={{ background: "var(--yellow)", borderRadius: 12, padding: "10px 12px" }}>
                  <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", background: "var(--ink)", color: "#fff", padding: "3px 6px", borderRadius: 6, display: "inline-block", marginBottom: 6 }}>经文引用</div>
                  <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 4 }}>{BOOK} {chapter}:{selectedVerseData.verse} · 和合本</div>
                  <div style={{ fontSize: 12, fontWeight: 500, lineHeight: 1.7, color: "var(--body)" }}>{selectedVerseData.text}</div>
                </div>
                <form action={startConversation}>
                  <input type="hidden" name="book" value={BOOK} />
                  <input type="hidden" name="chapter" value={chapter} />
                  <input type="hidden" name="verseStart" value={selectedVerseData.verse} />
                  <input type="hidden" name="translation" value={TRANSLATION} />
                  <button type="submit" style={{ width: "100%", height: 40, background: "var(--purple)", border: "none", borderRadius: 12, color: "#fff", fontSize: 13, fontWeight: 800, cursor: "pointer", boxShadow: "var(--shadow-card)" }}>请为我解释这节经文</button>
                </form>
              </>
            ) : (
              <div style={{ fontSize: 12, fontWeight: 500, color: "var(--body)", lineHeight: 1.7, padding: "4px 2px" }}>在左侧点选一节经文，即可开始慧读，或高亮 / 加笔记。</div>
            )}

            {recentConversations.length > 0 && (
              <div style={{ marginTop: 6 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "var(--body)", marginBottom: 8 }}>本章慧读记录</div>
                {recentConversations.map((conv) => (
                  <Link key={conv.id} href={`/huidu/${conv.id}`} style={{ display: "block", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, padding: "10px 12px", marginBottom: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: "var(--purple)", marginBottom: 3 }}>{conv.verseRefLabel}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", lineHeight: 1.5 }}>{conv.title}</div>
                  </Link>
                ))}
              </div>
            )}
          </div>
          <div style={{ flex: "none", padding: "10px 16px 14px", fontSize: 10, fontWeight: 600, color: "var(--body)", textAlign: "center" }}>AI 解释仅供参考，不替代教会教导与权威释经</div>
        </div>
      </div>
    </div>
  );
}
