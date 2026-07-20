import Link from "next/link";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/current-user";
import { setHighlight, clearHighlight } from "@/lib/actions/site/reading";
import { HIGHLIGHT_COLORS } from "@/lib/reading-constants";
import { DEFAULT_BOOK_ORDER, getBook, getVersion } from "@/lib/bible-books";
import { startConversation } from "@/lib/actions/site/huidu";
import { NoteComposer } from "@/components/site/NoteComposer";

export default async function BiblePage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string; b?: string; c?: string; v?: string }>;
}) {
  const { t, b, c, v } = await searchParams;
  // Scripture itself is public; highlights/notes/慧读 need a login.
  const user = await getSessionUser();

  const version = getVersion(t);
  const book = getBook(Number(b) || DEFAULT_BOOK_ORDER);
  // Canonical key for user data (highlights/notes/commentary) — always the
  // zh book name, so annotations survive switching translations.
  const bookKey = book.zh;
  const bookLabel = book[version.lang];

  const chapterCount = await db.verse.aggregate({
    where: { translation: version.code, bookOrder: book.order },
    _max: { chapter: true },
  });
  const maxChapter = chapterCount._max.chapter ?? book.chapters;
  const defaultChapter = book.order === DEFAULT_BOOK_ORDER ? 3 : 1;
  const chapter = Math.min(Math.max(Number(c) || defaultChapter, 1), maxChapter);
  const selectedVerseList = v ? v.split(",").map(Number).filter(n => !isNaN(n) && n > 0) : [];
  const selectedSet = new Set(selectedVerseList);
  const selectedVerseNumbers = Array.from(selectedSet).sort((a, b) => a - b);

  const [verses, commentary] = await Promise.all([
    db.verse.findMany({
      where: { translation: version.code, bookOrder: book.order, chapter },
      orderBy: { verse: "asc" },
    }),
    db.commentary.findMany({ where: { book: bookKey, chapter }, orderBy: { rangeStart: "asc" } }),
  ]);

  const [highlights, notes, recentConversations] = user
    ? await Promise.all([
        db.highlight.findMany({ where: { userId: user.id, book: bookKey, chapter } }),
        db.note.findMany({ where: { userId: user.id, book: bookKey, chapter }, orderBy: { createdAt: "desc" } }),
        db.conversation.findMany({
          where: { userId: user.id, book: bookKey, chapter },
          orderBy: { createdAt: "desc" },
          take: 3,
        }),
      ])
    : [[], [], []];

  const highlightMap = new Map(highlights.map((h) => [h.verse, h.color]));
  const selectedVersesData = selectedVerseNumbers
    .map(vn => verses.find((x) => x.verse === vn))
    .filter((x): x is NonNullable<typeof x> => Boolean(x));
  const selectedVerseData = selectedVersesData[0] ?? null;
  const selectedNotes = notes.filter((n) => selectedSet.has(n.verse));

  const selectedRangeLabel = (() => {
    if (selectedVerseNumbers.length === 0) return "";
    const ranges: string[] = [];
    let index = 0;
    while (index < selectedVerseNumbers.length) {
      const start = selectedVerseNumbers[index];
      let end = start;
      while (index + 1 < selectedVerseNumbers.length && selectedVerseNumbers[index + 1] === end + 1) {
        end = selectedVerseNumbers[index + 1];
        index += 1;
      }
      ranges.push(start === end ? String(start) : `${start}-${end}`);
      index += 1;
    }
    return ranges.join("、");
  })();

  const hrefFor = (opts: { t?: string; b?: number; c?: number; v?: number }) => {
    const params = new URLSearchParams();
    params.set("t", opts.t ?? version.code);
    params.set("b", String(opts.b ?? book.order));
    if (opts.c) params.set("c", String(opts.c));
    if (opts.v) params.set("v", String(opts.v));
    return `/bible?${params.toString()}`;
  };

  const getToggleHref = (verseNumber: number) => {
    const nextSet = new Set(selectedSet);
    if (nextSet.has(verseNumber)) {
      nextSet.delete(verseNumber);
    } else {
      nextSet.add(verseNumber);
    }
    const nextV = Array.from(nextSet).sort((a, b) => a - b).join(",");
    
    const params = new URLSearchParams();
    params.set("t", version.code);
    params.set("b", String(book.order));
    params.set("c", String(chapter));
    if (nextV) {
      params.set("v", nextV);
    }
    return `/bible?${params.toString()}`;
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        {/* verses */}
        <div style={{ flex: 1, padding: "32px 40px", overflow: "auto", borderRight: "1px solid var(--line)" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 20 }}>
            <div style={{ fontSize: 26, fontWeight: 800 }}>{bookLabel} 第 {chapter} 章</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--body)", letterSpacing: "0.08em" }}>{version.label}</div>
          </div>

          <p style={{ margin: 0, fontSize: 18, fontWeight: 400, lineHeight: 2, textWrap: "pretty" }}>
            {verses.map((verse) => {
              const color = highlightMap.get(verse.verse);
              const isSelected = selectedSet.has(verse.verse);
              return (
                <Link
                  key={verse.id}
                  href={getToggleHref(verse.verse)}
                  scroll={false}
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  <sup style={{ fontSize: 12, fontWeight: 400, color: "var(--body)", margin: "0 4px" }}>{verse.verse}</sup>
                  <span
                    style={{
                      background: color ?? "transparent",
                      padding: color ? "1px 2px" : undefined,
                      textDecoration: isSelected ? "underline" : undefined,
                      textDecorationColor: isSelected ? "rgba(217, 154, 37, 0.52)" : undefined,
                      textDecorationThickness: isSelected ? "1px" : undefined,
                      textUnderlineOffset: isSelected ? "5px" : undefined,
                      cursor: "pointer",
                    }}
                    {...(version.code === "pinyin"
                      ? { dangerouslySetInnerHTML: { __html: verse.text } }
                      : { children: verse.text })}
                  />
                </Link>
              );
            })}
          </p>
          {verses.length === 0 && (
            <div style={{ fontSize: 13, color: "var(--body)" }}>本章暂无经文数据。</div>
          )}

          {/* chapter nav */}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 28 }}>
            {chapter > 1 ? (
              <Link href={hrefFor({ c: chapter - 1 })} style={{ display: "flex", alignItems: "center", height: 36, padding: "0 16px", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 100, fontSize: 13, fontWeight: 700, color: "var(--ink)", textDecoration: "none" }}>‹ 上一章</Link>
            ) : <div />}
            {chapter < maxChapter ? (
              <Link href={hrefFor({ c: chapter + 1 })} style={{ display: "flex", alignItems: "center", height: 36, padding: "0 16px", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 100, fontSize: 13, fontWeight: 700, color: "var(--ink)", textDecoration: "none" }}>下一章 ›</Link>
            ) : <div />}
          </div>

          {/* selection toolbar */}
          {selectedVerseData && !user && (
            <div className="card" style={{ marginTop: 24, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "var(--body)" }}>
                登录后可对 {bookKey} {chapter}:{selectedRangeLabel} 高亮、写笔记，并向慧读提问。
              </div>
              <Link href="/me" style={{ display: "flex", alignItems: "center", height: 32, padding: "0 16px", background: "var(--purple)", borderRadius: 100, color: "#fff", fontSize: 12, fontWeight: 800 }}>去登录</Link>
            </div>
          )}
          {selectedVerseData && user && (
            <div className="card" style={{ marginTop: 24, padding: "14px 16px" }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12 }}>
                <div style={{ fontSize: 15, fontWeight: 800 }}>{bookKey} {chapter}:{selectedRangeLabel}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--body)" }}>已选中 {selectedVerseNumbers.length} 节</div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 14px", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 800 }}>高亮</div>
                {HIGHLIGHT_COLORS.map((color) => (
                  <form key={color} action={setHighlight}>
                    <input type="hidden" name="book" value={bookKey} />
                    <input type="hidden" name="chapter" value={chapter} />
                    <input type="hidden" name="verse" value={selectedVerseNumbers.join(",")} />
                    <input type="hidden" name="color" value={color} />
                    <button type="submit" title="设为高亮" style={{
                      display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28,
                      background: color, border: selectedVerseNumbers.every((vn) => highlightMap.get(vn) === color) ? "2px solid var(--ink)" : "1px solid var(--line)",
                      borderRadius: "50%", cursor: "pointer",
                    }} />
                  </form>
                ))}
                <div style={{ flex: 1 }} />
                <form action={clearHighlight}>
                  <input type="hidden" name="book" value={bookKey} />
                  <input type="hidden" name="chapter" value={chapter} />
                  <input type="hidden" name="verse" value={selectedVerseNumbers.join(",")} />
                  <button type="submit" title="取消高亮" style={{
                    width: 28, height: 28, borderRadius: "50%", cursor: "pointer",
                    background: "linear-gradient(135deg,#FFFFFF 44%,#18191F 44%,#18191F 56%,#FFFFFF 56%)", border: "1px solid var(--line)",
                  }} />
                </form>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <NoteComposer book={bookKey} chapter={chapter} verse={selectedVerseNumbers[0]} />
                <form action={startConversation}>
                  <input type="hidden" name="book" value={bookKey} />
                  <input type="hidden" name="chapter" value={chapter} />
                  <input type="hidden" name="verseStart" value={selectedVerseNumbers[0]} />
                  <input type="hidden" name="verseEnd" value={selectedVerseNumbers[selectedVerseNumbers.length - 1]} />
                  <input type="hidden" name="translation" value={version.label} />
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
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--body)" }}>{bookKey} {chapter} 章</div>
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
                  <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 6 }}>{bookKey} {chapter}:{selectedRangeLabel} · {version.label}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {selectedVersesData.map((v) => (
                      <div key={v.id} style={{ fontSize: 12, fontWeight: 500, lineHeight: 1.7, color: "var(--body)" }}>
                        <sup style={{ marginRight: 4, color: "var(--body)", fontSize: 10 }}>{v.verse}</sup>
                        <span
                          {...(version.code === "pinyin"
                            ? { dangerouslySetInnerHTML: { __html: v.text } }
                            : { children: v.text })}
                        />
                      </div>
                    ))}
                  </div>
                </div>
                {user ? (
                  <form action={startConversation}>
                    <input type="hidden" name="book" value={bookKey} />
                    <input type="hidden" name="chapter" value={chapter} />
                    <input type="hidden" name="verseStart" value={selectedVerseNumbers[0]} />
                    <input type="hidden" name="verseEnd" value={selectedVerseNumbers[selectedVerseNumbers.length - 1]} />
                    <input type="hidden" name="translation" value={version.label} />
                    <button type="submit" style={{ width: "100%", height: 40, background: "var(--purple)", border: "none", borderRadius: 12, color: "#fff", fontSize: 13, fontWeight: 800, cursor: "pointer", boxShadow: "var(--shadow-card)" }}>请为我解释这节经文</button>
                  </form>
                ) : (
                  <Link href="/me" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: 40, background: "var(--purple)", borderRadius: 12, color: "#fff", fontSize: 13, fontWeight: 800, boxShadow: "var(--shadow-card)" }}>登录后开始慧读</Link>
                )}
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
