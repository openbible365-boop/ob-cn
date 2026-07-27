import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Icon } from "../components/Icon";
import { CompactToolbar } from "../components/CompactToolbar";
import { UnifiedHeader } from "../components/UnifiedHeader";
import { UserAvatar } from "../components/UserAvatar";
import { VoiceInputButton } from "../components/VoiceInputButton";
import {
  appendFollowup,
  getConversation,
  hasScriptureContext,
  requestHuiduFollowup,
  startGeneralConversation,
  updateConversationTitle,
  type Conversation,
  type HuiduBlock,
} from "../data/huidu";
import { useSpeechInput } from "../hooks/useSpeechInput";
import { useSessionUser } from "../hooks/useSessionUser";
import { BOOKS, VERSIONS, bookName, getReading } from "../data/scripture";

function TypingDots() {
  return (
    <div className="huidu-typing" role="status">
      <span aria-hidden="true"><i /><i /><i /></span>
      <small>正在生成…</small>
    </div>
  );
}

function BlockView({ block }: { block: HuiduBlock }) {
  return (
    <section className="huidu-answer-block">
      <span className="huidu-answer-tag" style={{ "--answer-color": block.color } as React.CSSProperties}>
        {block.tag}
      </span>
      <p>{block.text}</p>
    </section>
  );
}

function createDraftConversation(): Conversation {
  return {
    id: "new",
    kind: "general",
    chapter: 0,
    verse: 0,
    refLabel: "",
    verseText: "",
    title: "新的 AI 对话",
    createdAt: new Date().toISOString(),
    messages: [],
  };
}

export function HuiduChatPage() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const routeState = location.state as { justCreated?: boolean; initialQuestion?: string } | null;
  const justCreated = Boolean(routeState?.justCreated);
  const initialQuestion = routeState?.initialQuestion?.trim() ?? "";

  const [conv, setConv] = useState<Conversation | null>(() => (
    conversationId === "new"
      ? createDraftConversation()
      : getConversation(conversationId ?? "")
  ));
  const [revealed, setRevealed] = useState(justCreated ? 0 : Infinity);
  const [pendingAnswer, setPendingAnswer] = useState(false);
  const [question, setQuestion] = useState("");
  const [requestError, setRequestError] = useState("");
  const [renameOpen, setRenameOpen] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const sessionUser = useSessionUser();
  const scrollRef = useRef<HTMLDivElement>(null);
  const answerTimerRef = useRef<number | null>(null);
  const initialQuestionStartedRef = useRef(false);
  const speechInput = useSpeechInput({
    value: question,
    onChange: setQuestion,
    disabled: pendingAnswer,
  });

  useEffect(() => () => {
    if (answerTimerRef.current !== null) window.clearTimeout(answerTimerRef.current);
  }, []);

  useEffect(() => {
    if (!justCreated) return;
    const timers = [1, 2, 3].map((number) => setTimeout(() => setRevealed(number), 400 + number * 550));
    return () => timers.forEach(clearTimeout);
  }, [justCreated]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [conv, revealed, pendingAnswer]);

  useEffect(() => {
    if (!conv || !initialQuestion || conv.messages.length > 0 || initialQuestionStartedRef.current) return;
    initialQuestionStartedRef.current = true;
    const originalConversation = conv;
    setPendingAnswer(true);
    setConv({ ...conv, messages: [{ role: "user", content: initialQuestion }] });
    void requestHuiduFollowup(originalConversation, initialQuestion).then((result) => {
      if (result.ok) {
        const updated = appendFollowup(originalConversation.id, initialQuestion, result.answer);
        setConv(updated ?? originalConversation);
      } else {
        setConv(originalConversation);
        setQuestion(initialQuestion);
        setRequestError(result.message);
      }
      setPendingAnswer(false);
    });
  }, [conv, initialQuestion]);

  if (!conv) {
    return (
      <div className="screen">
        <UnifiedHeader title="慧读" subtitle="对话不存在" ariaLabel="慧读对话状态" onBack={() => navigate("/huidu")} backLabel="返回慧读" />
        <div className="huidu-missing">这条慧读记录可能已被删除。</div>
      </div>
    );
  }

  const scriptureContext = hasScriptureContext(conv);
  const legacyBookLabel = conv.refLabel.replace(/\s+\d+:[\d-]+$/, "");
  const legacyContext = VERSIONS
    .flatMap((candidateVersion) => BOOKS.map((candidateBook) => ({
      bookCode: candidateBook.code,
      versionCode: candidateVersion.code,
      label: bookName(candidateBook, candidateVersion),
    })))
    .find((candidate) => candidate.label === legacyBookLabel);
  const currentReading = getReading();
  const referencedBookCode = conv.bookCode ?? legacyContext?.bookCode ?? currentReading.book;
  const referencedVersionCode = conv.versionCode ?? legacyContext?.versionCode ?? currentReading.version;
  const openReferencedVerse = () => {
    const query = new URLSearchParams({
      t: referencedVersionCode,
      bk: referencedBookCode,
      c: String(conv.chapter),
      v: String(conv.verse),
    });
    navigate(`/bible?${query.toString()}`);
  };

  const submit = async (value: string) => {
    const text = value.trim();
    if (!text || pendingAnswer) return;
    speechInput.stopListening();

    let originalConversation = conv;
    if (originalConversation.id === "new") {
      const customTitle = originalConversation.title === "新的 AI 对话"
        ? ""
        : originalConversation.title;
      originalConversation = startGeneralConversation(customTitle, text);
      navigate(`/huidu/${originalConversation.id}`, {
        replace: true,
        state: { justCreated: true },
      });
    }
    const optimisticConversation: Conversation = {
      ...originalConversation,
      messages: [...originalConversation.messages, { role: "user", content: text }],
    };

    setQuestion("");
    setRequestError("");
    setPendingAnswer(true);
    setConv(optimisticConversation);

    const result = await requestHuiduFollowup(originalConversation, text);
    if (result.ok) {
      const updated = appendFollowup(originalConversation.id, text, result.answer);
      setConv(updated ?? originalConversation);
    } else {
      setConv(originalConversation);
      setQuestion(text);
      setRequestError(result.message);
    }
    setPendingAnswer(false);
  };

  return (
    <div className="screen huidu-chat-screen">
      <CompactToolbar
        ariaLabel="慧读对话"
        primary="慧读"
        secondary={(
          <span className="huidu-chat-title-label">
            <span>{conv.title}</span>
            <Icon name="edit" size={11} />
          </span>
        )}
        secondaryAriaLabel={`修改对话标题，当前为${conv.title}`}
        onSecondaryClick={() => {
          setTitleDraft(conv.title);
          setRenameOpen(true);
        }}
        actions={(
          <>
            <button className="bible-toolbar-action huidu-chat-toolbar-action" type="button" aria-label="返回慧读列表" title="返回慧读" onClick={() => navigate("/huidu")}>
              <Icon name="chevron-left" size={18} />
            </button>
            {scriptureContext && (
              <button className="bible-toolbar-action huidu-chat-toolbar-action is-reference" type="button" aria-label={`在圣经中查看${conv.refLabel}`} title="定位经文" onClick={openReferencedVerse}>
                <Icon name="map-pin" size={18} />
              </button>
            )}
          </>
        )}
      />

      <main ref={scrollRef} className="screen-scroll huidu-thread">
        {scriptureContext && (
          <section className="huidu-quote" aria-label={`${conv.refLabel}经文`}>
            <div className="huidu-quote-meta">
              <span>经文</span>
              <b>{conv.refLabel}</b>
            </div>
            <p>{conv.verseText}</p>
          </section>
        )}

        {conv.messages.length === 0 && (
          <section className="huidu-chat-empty" aria-label="开始新的 AI 对话">
            <span aria-hidden="true">
              <Icon name="sparkle" size={22} />
            </span>
            <h1>开始新的 AI 对话</h1>
            <p>直接在下方输入问题。需要深入阅读经文时，可从圣经页面选择一节经文进入慧读。</p>
          </section>
        )}

        <div className="huidu-message-list">
          {conv.messages.map((message, index) => {
            if (message.role === "user") {
              return (
                <div key={index} className="huidu-user-message-row">
                  <div className="huidu-user-message">
                    {message.content}
                  </div>
                  <UserAvatar
                    name={sessionUser?.name ?? "我"}
                    avatarColor={sessionUser?.avatarColor ?? "var(--yellow)"}
                    avatarUrl={sessionUser?.avatarUrl ?? null}
                    size={30}
                  />
                </div>
              );
            }

            if (message.blocks) {
              const isFirstAnswer = index === 1;
              const visibleCount = isFirstAnswer
                ? Math.min(message.blocks.length, revealed === Infinity ? message.blocks.length : revealed)
                : message.blocks.length;
              const streaming = isFirstAnswer && visibleCount < message.blocks.length;
              return (
                <div key={index} className="huidu-assistant-message">
                  {message.blocks.slice(0, Math.max(visibleCount, streaming ? visibleCount : message.blocks.length))
                    .map((block, blockIndex) => <BlockView key={blockIndex} block={block} />)}
                  {streaming && <TypingDots />}
                </div>
              );
            }

            return (
              <div key={index} className="huidu-assistant-message">
                {(message.content ?? "").split("\n\n").map((paragraph, paragraphIndex) => (
                  <p className="huidu-answer-paragraph" key={paragraphIndex}>{paragraph}</p>
                ))}
              </div>
            );
          })}

          {pendingAnswer && (
            <div className="huidu-assistant-message is-pending">
              <TypingDots />
            </div>
          )}
        </div>

        <div className="huidu-thread-note">
          {scriptureContext
            ? "慧读用于辅助理解经文，不替代教会教导与权威释经。"
            : "AI 回答仅供参考，重要信息请进一步核实。"}
        </div>
      </main>

      <div className="huidu-chat-composer">
        {requestError && <div role="alert" className="huidu-composer-status is-error">{requestError}</div>}
        {speechInput.error && <div role="alert" className="huidu-composer-status is-error">{speechInput.error}</div>}
        {speechInput.isListening && (
          <div role="status" className="huidu-composer-status voice-listening-status">
            正在聆听…说完后再点一次麦克风
          </div>
        )}
        <form className="huidu-chat-row" onSubmit={(event) => { event.preventDefault(); void submit(question); }}>
          <span className="huidu-chat-field">
            <input
              value={question}
              onChange={(event) => {
                setQuestion(event.target.value);
                if (requestError) setRequestError("");
                if (speechInput.error) speechInput.clearError();
              }}
              disabled={pendingAnswer}
              maxLength={1200}
              aria-label={conv.messages.length === 0 ? "输入问题" : "继续追问"}
              placeholder={speechInput.isListening
                ? "正在聆听…"
                : conv.messages.length === 0
                  ? "输入问题，开始对话…"
                  : "继续追问…"}
            />
            <VoiceInputButton
              isSupported={speechInput.isSupported}
              isListening={speechInput.isListening}
              disabled={pendingAnswer}
              onClick={speechInput.toggleListening}
            />
          </span>
          <button
            type="submit"
            aria-label="发送追问"
            disabled={pendingAnswer || !question.trim()}
            className="icon-btn icon-btn-primary composer-icon-btn huidu-send-btn"
          >
            <Icon name="send" size={18} />
          </button>
        </form>
      </div>

      {renameOpen && (
        <div className="huidu-new-layer">
          <button className="huidu-new-scrim" type="button" aria-label="取消修改标题" onClick={() => setRenameOpen(false)} />
          <section className="huidu-rename-dialog" role="dialog" aria-modal="true" aria-labelledby="huidu-rename-title">
            <h2 id="huidu-rename-title">修改对话标题</h2>
            <input
              autoFocus
              value={titleDraft}
              maxLength={40}
              aria-label="对话标题"
              onChange={(event) => setTitleDraft(event.target.value)}
            />
            <div>
              <button type="button" onClick={() => setRenameOpen(false)}>取消</button>
              <button
                type="button"
                className="is-primary"
                disabled={!titleDraft.trim()}
                onClick={() => {
                  if (conv.id === "new") {
                    setConv({ ...conv, title: titleDraft.trim().slice(0, 40) });
                  } else {
                    const updated = updateConversationTitle(conv.id, titleDraft);
                    if (updated) setConv({ ...updated });
                  }
                  setRenameOpen(false);
                }}
              >
                保存
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
