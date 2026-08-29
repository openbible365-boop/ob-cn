import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Icon } from "../components/Icon";
import { ANDROID_BACK_EVENT } from "../native/android-back";
import { CompactToolbar } from "../components/CompactToolbar";
import { UnifiedHeader } from "../components/UnifiedHeader";
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
import { BOOKS, VERSIONS, bookName, getReading } from "../data/scripture";

function TypingDots() {
  return (
    <div className="huidu-typing" role="status">
      <span aria-hidden="true"><i /><i /><i /></span>
      <small>正在生成…</small>
    </div>
  );
}

// 空态建议提示词：主流 AI 应用的起步方式——给出可点的具体问法，
// 点击后填入输入框（可改可发），而不是替用户直接发送。
// 每条配一个灰色线性小图标，列表扫读更快（与设计画布一致）。
const STARTER_PROMPTS: Array<{ icon: string; text: string }> = [
  { icon: "book", text: "解释一段经文的背景与生活应用" },
  { icon: "heart", text: "今天用一节经文鼓励我" },
  { icon: "info", text: "祷告可以从哪里开始？" },
  { icon: "search", text: "圣经里的「恩典」是什么意思？" },
];

function BlockView({ block }: { block: HuiduBlock }) {
  return (
    <section className="huidu-answer-block">
      <span className="huidu-answer-tag">{block.tag}</span>
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

  // 安卓返回键：重命名弹窗打开时先关它
  useEffect(() => {
    if (!renameOpen) return;
    const close = (event: Event) => { event.preventDefault(); setRenameOpen(false); };
    window.addEventListener(ANDROID_BACK_EVENT, close);
    return () => window.removeEventListener(ANDROID_BACK_EVENT, close);
  }, [renameOpen]);
  const [titleDraft, setTitleDraft] = useState("");
  const [copiedIndex, setCopiedIndex] = useState(-1);
  const [attachment, setAttachment] = useState<File | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  const handleFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
      setRequestError("附件不能超过 50 MB");
      return;
    }
    setRequestError("");
    setAttachment(file);
    inputRef.current?.focus();
  };

  const submit = async (value: string) => {
    const file = attachment;
    const text = value.trim();
    if ((!text && !file) || pendingAnswer) return;
    speechInput.stopListening();

    // 只发附件不写字时给一句默认提问，与社群助手一致
    const questionForApi = text || "请阅读并总结这个附件。";
    const displayText = file ? `📎 ${file.name}\n${questionForApi}` : text;

    let originalConversation = conv;
    if (originalConversation.id === "new") {
      const customTitle = originalConversation.title === "新的 AI 对话"
        ? ""
        : originalConversation.title;
      originalConversation = startGeneralConversation(customTitle, questionForApi);
      navigate(`/huidu/${originalConversation.id}`, {
        replace: true,
        state: { justCreated: true },
      });
    }
    const optimisticConversation: Conversation = {
      ...originalConversation,
      messages: [...originalConversation.messages, { role: "user", content: displayText }],
    };

    setQuestion("");
    setAttachment(null);
    setRequestError("");
    setPendingAnswer(true);
    setConv(optimisticConversation);

    const result = await requestHuiduFollowup(originalConversation, questionForApi, file);
    if (result.ok) {
      const updated = appendFollowup(originalConversation.id, displayText, result.answer);
      setConv(updated ?? originalConversation);
    } else {
      setConv(originalConversation);
      setQuestion(text);
      setAttachment(file);
      setRequestError(result.message);
    }
    setPendingAnswer(false);
  };

  return (
    <div className="screen huidu-chat-screen">
      <CompactToolbar
        ariaLabel="慧读对话"
        primary="慧读"
        // 经文对话用经节引用做标题：短、稳定、一眼知道在读哪一节。
        // 原来显示的模板标题太长，在顶栏里会被截成「诗篇 2:...」，等于什么都没说。
        // 改名仍然是点这里，说明放在 aria-label 里，省掉一个含义不明的铅笔图标。
        secondary={(
          <span className="huidu-chat-title-label">
            {scriptureContext ? conv.refLabel : conv.title}
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
              <Icon name="chevron-left" size={20} />
            </button>
            {scriptureContext && (
              <button className="bible-toolbar-action huidu-chat-toolbar-action is-reference" type="button" aria-label={`在圣经中查看${conv.refLabel}`} title="定位经文" onClick={openReferencedVerse}>
                <Icon name="map-pin" size={20} />
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
            <h1>平安，今天想聊什么？</h1>
            <p>可以直接提问，也可以从下面的问法开始。</p>
            <div className="huidu-suggests" role="group" aria-label="推荐提示词">
              {STARTER_PROMPTS.map((prompt) => (
                <button
                  key={prompt.text}
                  type="button"
                  onClick={() => {
                    setQuestion(prompt.text);
                    inputRef.current?.focus();
                  }}
                >
                  <Icon name={prompt.icon} size={15} />
                  {prompt.text}
                </button>
              ))}
            </div>
            {/* 第二入口：经文慧读的路径此前不可被发现（信息架构补洞） */}
            <button type="button" className="huidu-scripture-hint" onClick={() => navigate("/bible")}>
              <Icon name="book" size={13} />
              或在圣经页选中经文，进入经文慧读
              <Icon name="chevron-right" size={12} />
            </button>
          </section>
        )}

        <div className="huidu-message-list">
          {conv.messages.map((message, index) => {
            if (message.role === "user") {
              // 主流 AI 应用的消息样式：用户消息右侧气泡不带头像，
              // 助手消息通栏平铺——对话里只有两个声音，头像不提供信息。
              return (
                <div key={index} className="huidu-user-message-row">
                  <div className="huidu-user-message">
                    {message.content}
                  </div>
                </div>
              );
            }

            // 回答全文（复制用）：分段块拼上标签，纯文本回答原样
            const answerText = message.blocks
              ? message.blocks.map((block) => `${block.tag}\n${block.text}`).join("\n\n")
              : message.content ?? "";
            const copyAnswer = async () => {
              let copied = false;
              try {
                await navigator.clipboard.writeText(answerText);
                copied = true;
              } catch {
                // 旧 WebView / 无剪贴板权限时退回 execCommand
                const holder = document.createElement("textarea");
                holder.value = answerText;
                holder.style.position = "fixed";
                holder.style.opacity = "0";
                document.body.appendChild(holder);
                holder.select();
                try { copied = document.execCommand("copy"); } catch { copied = false; }
                holder.remove();
              }
              if (!copied) return;
              setCopiedIndex(index);
              window.setTimeout(() => setCopiedIndex((current) => (current === index ? -1 : current)), 1600);
            };
            const actions = (
              <div className="huidu-msg-actions">
                <button type="button" onClick={() => void copyAnswer()} aria-label="复制这条回答">
                  <Icon name={copiedIndex === index ? "check" : "copy"} size={14} />
                  {copiedIndex === index ? "已复制" : "复制"}
                </button>
              </div>
            );

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
                  {streaming ? <TypingDots /> : actions}
                </div>
              );
            }

            return (
              <div key={index} className="huidu-assistant-message">
                {(message.content ?? "").split("\n\n").map((paragraph, paragraphIndex) => (
                  <p className="huidu-answer-paragraph" key={paragraphIndex}>{paragraph}</p>
                ))}
                {actions}
              </div>
            );
          })}

          {pendingAnswer && (
            <div className="huidu-assistant-message is-pending">
              <TypingDots />
            </div>
          )}
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
        {attachment && (
          <div className="huidu-attach-chip">
            <Icon name="paperclip" size={14} />
            <span>{attachment.name}</span>
            <small>{attachment.size < 1024 * 1024
              ? `${Math.max(1, Math.round(attachment.size / 1024))} KB`
              : `${(attachment.size / (1024 * 1024)).toFixed(1)} MB`} · 仅用于本次提问</small>
            <button type="button" aria-label="移除附件" onClick={() => setAttachment(null)}>
              <Icon name="x" size={14} />
            </button>
          </div>
        )}
        {/* 主流 AI 输入栏：大圆角药丸，附件、语音与发送都在框内，发送键是圆形上箭头 */}
        <form className="huidu-chat-row" onSubmit={(event) => { event.preventDefault(); void submit(question); }}>
          <span className="huidu-chat-field">
            <input
              ref={fileInputRef}
              type="file"
              className="huidu-attach-input"
              accept=".txt,.md,.markdown,.csv,.tsv,.json,.xml,.html,.htm,.yaml,.yml,.srt,.vtt,.log"
              aria-hidden="true"
              tabIndex={-1}
              onChange={handleFileSelected}
            />
            <button
              type="button"
              className="huidu-attach-btn"
              aria-label="添加附件"
              title="添加附件（支持文本类文件）"
              disabled={pendingAnswer}
              onClick={() => fileInputRef.current?.click()}
            >
              <Icon name="paperclip" size={17} />
            </button>
            <input
              ref={inputRef}
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
                : attachment
                  ? "可补充问题，发送后分析附件…"
                  : conv.messages.length === 0
                    ? "有问题，尽管问…"
                    : "继续追问…"}
            />
            <VoiceInputButton
              isSupported={speechInput.isSupported}
              isListening={speechInput.isListening}
              disabled={pendingAnswer}
              onClick={speechInput.toggleListening}
            />
            <button
              type="submit"
              aria-label="发送追问"
              disabled={pendingAnswer || (!question.trim() && !attachment)}
              className="huidu-send-btn"
            >
              <Icon name="arrow-up" size={17} />
            </button>
          </span>
        </form>
        <p className="huidu-composer-note">
          {scriptureContext
            ? "慧读用于辅助理解经文，不替代教会教导与权威释经"
            : "AI 回答仅供参考，重要信息请进一步核实"}
        </p>
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
