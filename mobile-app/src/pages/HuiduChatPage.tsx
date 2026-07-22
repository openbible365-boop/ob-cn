import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Icon } from "../components/Icon";
import { CompactToolbar } from "../components/CompactToolbar";
import {
  appendFollowup,
  getConversation,
  requestHuiduFollowup,
  type Conversation,
  type HuiduBlock,
} from "../data/huidu";

function TypingDots() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, borderTop: "1px solid var(--line)", paddingTop: 10 }}>
      <div style={{ display: "flex", gap: 3 }}>
        {[0, 0.2, 0.4].map((d) => (
          <div key={d} style={{ width: 5, height: 5, background: "var(--ink)", borderRadius: "50%", animation: `ob-dot 1.4s ease-in-out ${d}s infinite` }} />
        ))}
      </div>
      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--body)" }}>正在生成…</div>
    </div>
  );
}

function BlockView({ block }: { block: HuiduBlock }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ alignSelf: "flex-start", fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", background: block.color, color: block.dark ? "#fff" : "var(--ink)", border: "1px solid var(--line)", borderRadius: 12, padding: "3px 8px" }}>
        {block.tag}
      </div>
      <div style={{ fontSize: 13, lineHeight: 1.8, color: "var(--body)", fontWeight: 500, textWrap: "pretty" }}>{block.text}</div>
    </div>
  );
}

// 慧读对话（design 1c streaming + 3b continuous thread）
export function HuiduChatPage() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const justCreated = Boolean((location.state as { justCreated?: boolean } | null)?.justCreated);

  const [conv, setConv] = useState<Conversation | null>(() => getConversation(conversationId ?? ""));
  // Staged reveal of the three answer blocks when arriving from 问慧读.
  const [revealed, setRevealed] = useState(justCreated ? 0 : Infinity);
  const [pendingAnswer, setPendingAnswer] = useState(false);
  const [question, setQuestion] = useState("");
  const [requestError, setRequestError] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const answerTimerRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (answerTimerRef.current !== null) window.clearTimeout(answerTimerRef.current);
  }, []);

  useEffect(() => {
    if (!justCreated) return;
    const timers = [1, 2, 3].map((n) => setTimeout(() => setRevealed(n), 400 + n * 550));
    return () => timers.forEach(clearTimeout);
  }, [justCreated]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [conv, revealed, pendingAnswer]);

  if (!conv) {
    return (
      <div className="screen">
        <div className="page-header">
          <button className="icon-btn" onClick={() => navigate(-1)}><Icon name="chevron-left" size={18} /></button>
          <div className="title">慧读</div>
        </div>
        <div style={{ padding: 24, fontSize: 13, color: "var(--body)" }}>对话不存在。</div>
      </div>
    );
  }

  const rounds = Math.ceil(conv.messages.length / 2);

  const submit = async (q: string) => {
    const text = q.trim();
    if (!text || pendingAnswer) return;

    const originalConversation = conv;
    const optimisticConversation: Conversation = {
      ...conv,
      messages: [...conv.messages, { role: "user", content: text }],
    };

    setQuestion("");
    setRequestError("");
    setPendingAnswer(true);
    setConv(optimisticConversation);

    const result = await requestHuiduFollowup(originalConversation, text);
    if (result.ok) {
      const updated = appendFollowup(
        originalConversation.id,
        text,
        result.answer,
      );
      setConv(updated ?? originalConversation);
    } else {
      setConv(originalConversation);
      setQuestion(text);
      setRequestError(result.message);
    }
    setPendingAnswer(false);
  };

  return (
    <div className="screen" style={{ background: "var(--surface)" }}>
      <CompactToolbar
        ariaLabel="慧读对话状态"
        primary="慧读"
        secondary={`第 ${rounds} 轮`}
        actions={(
          <>
            <button className="bible-toolbar-action" aria-label="返回慧读列表" onClick={() => navigate(-1)}>
              <Icon name="chevron-left" size={22} />
            </button>
            <button className="bible-toolbar-action" aria-label="返回圣经阅读" onClick={() => navigate("/bible")}>
              <Icon name="book" size={23} />
            </button>
          </>
        )}
      />

      {/* pinned quote */}
      <div style={{ flex: "none", padding: "14px 16px 0" }}>
        <div style={{ background: "var(--yellow)", border: "1px solid var(--line)", borderRadius: 12, boxShadow: "var(--shadow-card)", padding: "12px 14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", background: "var(--ink)", color: "#fff", padding: "3px 6px", borderRadius: 12 }}>经文引用</div>
            <div style={{ fontSize: 12, fontWeight: 800 }}>{conv.refLabel} · 和合本</div>
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.75 }}>{conv.verseText}</div>
        </div>
      </div>

      <div ref={scrollRef} className="screen-scroll" style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
        {conv.messages.map((m, i) => {
          if (m.role === "user") {
            return (
              <div key={i} style={{ alignSelf: "flex-end", maxWidth: "78%", background: "var(--ink)", color: "#fff", borderRadius: 12, padding: "9px 12px", fontSize: 14, fontWeight: 600, lineHeight: 1.6, boxShadow: "var(--shadow-card)" }}>
                {m.content}
              </div>
            );
          }
          if (m.blocks) {
            const isFirstAnswer = i === 1;
            const visibleCount = isFirstAnswer ? Math.min(m.blocks.length, revealed === Infinity ? m.blocks.length : revealed) : m.blocks.length;
            const streaming = isFirstAnswer && visibleCount < m.blocks.length;
            return (
              <div key={i} className="card" style={{ borderRadius: 12, padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
                {m.blocks.slice(0, Math.max(visibleCount, streaming ? visibleCount : m.blocks.length)).map((b, j) => (
                  <BlockView key={j} block={b} />
                ))}
                {streaming && <TypingDots />}
              </div>
            );
          }
          return (
            <div key={i} className="card" style={{ borderRadius: 12, padding: 14 }}>
              {(m.content ?? "").split("\n\n").map((para, j) => (
                <p key={j} style={{ margin: j > 0 ? "10px 0 0" : 0, fontSize: 13, lineHeight: 1.8, color: "var(--body)", fontWeight: 500, textWrap: "pretty" }}>{para}</p>
              ))}
            </div>
          );
        })}

        {pendingAnswer && (
          <div className="card" style={{ borderRadius: 12, padding: 14 }}>
            <TypingDots />
          </div>
        )}

        <div className="disclaimer">当前回答由本机阅读模板生成，仅供参考，不替代教会教导与权威释经</div>
      </div>

      {/* composer */}
      <div style={{ flex: "none", background: "var(--white)", borderTop: "1px solid var(--line)", padding: "10px 16px calc(10px + env(safe-area-inset-bottom))" }}>
        {requestError && (
          <div role="alert" style={{ margin: "-2px 0 8px", fontSize: 11, fontWeight: 700, color: "#c64040" }}>
            {requestError}
          </div>
        )}
        <form onSubmit={(e) => { e.preventDefault(); void submit(question); }} style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input
            value={question}
            onChange={(e) => {
              setQuestion(e.target.value);
              if (requestError) setRequestError("");
            }}
            disabled={pendingAnswer}
            maxLength={1200}
            aria-label="继续追问"
            placeholder="继续追问…"
            style={{ flex: 1, minWidth: 0, height: 46, padding: "0 14px", border: "1px solid var(--line)", borderRadius: 12, background: "var(--white)", font: "inherit", fontSize: 14, fontWeight: 500, color: "var(--ink)", outline: "none" }}
          />
          <button
            type="submit"
            aria-label="发送追问"
            disabled={pendingAnswer || !question.trim()}
            style={{ flex: "none", display: "flex", alignItems: "center", justifyContent: "center", width: 46, height: 46, background: "var(--purple)", border: "1px solid var(--line)", borderRadius: 12, boxShadow: "var(--shadow-card)", color: "#fff", opacity: pendingAnswer || !question.trim() ? 0.45 : 1 }}
          >
            <Icon name="send" size={20} />
          </button>
        </form>
      </div>
    </div>
  );
}
