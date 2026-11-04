import { useEffect, useMemo, useRef, useState } from "react";
import { useAppBack } from "../hooks/useAppBack";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Icon } from "../components/Icon";
import { ANDROID_BACK_EVENT } from "../native/android-back";
import { CompactToolbar } from "../components/CompactToolbar";
import { AiThinking } from "../components/AiThinking";
import { UnifiedHeader } from "../components/UnifiedHeader";
import { VoiceInputButton } from "../components/VoiceInputButton";
import {
  OPENING_QUESTION,
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
  const goBack = useAppBack("/huidu");
  const location = useLocation();
  const routeState = location.state as { justCreated?: boolean; initialQuestion?: string } | null;
  const justCreated = Boolean(routeState?.justCreated);
  const initialQuestion = routeState?.initialQuestion?.trim() ?? "";

  // 对话字号：三档缩放，作用于提问/回答/经文引用文本
  const [fontScale, setFontScale] = useState(() => {
    const saved = Number(localStorage.getItem("ob.huidu.fontScale"));
    return [1, 1.15, 1.3].includes(saved) ? saved : 1;
  });
  const [fontPanelOpen, setFontPanelOpen] = useState(false);
  useEffect(() => {
    localStorage.setItem("ob.huidu.fontScale", String(fontScale));
  }, [fontScale]);

  const [conv, setConv] = useState<Conversation | null>(() => (
    conversationId === "new"
      ? createDraftConversation()
      : getConversation(conversationId ?? "")
  ));

  // 路由参数变化时重载对话：同一路由元素不会卸载（如从通知深链跳到另一条对话），
  // 不重载的话页面会停留在旧对话上、新消息也发进旧对话
  const loadedConversationIdRef = useRef(conversationId);
  useEffect(() => {
    if (conversationId === loadedConversationIdRef.current) return;
    loadedConversationIdRef.current = conversationId;
    setConv(conversationId === "new" ? createDraftConversation() : getConversation(conversationId ?? ""));
    setPendingAnswer(false);
    setRevealed(Infinity);
  }, [conversationId]);
  const [revealed, setRevealed] = useState(justCreated ? 0 : Infinity);
  const [pendingAnswer, setPendingAnswer] = useState(false);
  // 流式回答的已到达部分；回答完成写入对话后清空
  const [streamingAnswer, setStreamingAnswer] = useState("");
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
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // 多行输入自动增高：随内容撑到约 4 行封顶，之后内部滚动
  const autosizeInput = () => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };
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
  }, [conv, revealed, pendingAnswer, streamingAnswer]);

  useEffect(() => {
    if (!conv || !initialQuestion || conv.messages.length > 0 || initialQuestionStartedRef.current) return;
    initialQuestionStartedRef.current = true;
    const originalConversation = conv;
    setPendingAnswer(true);
    setStreamingAnswer("");
    setConv({ ...conv, messages: [{ role: "user", content: initialQuestion }] });
    void requestHuiduFollowup(originalConversation, initialQuestion, {
      // 经文对话的首问走 opening 模式：服务端按三段结构生成并可命中缓存
      mode: hasScriptureContext(originalConversation) ? "opening" : "followup",
      onDelta: setStreamingAnswer,
    }).then((result) => {
      if (result.ok) {
        const updated = appendFollowup(originalConversation.id, initialQuestion, result.answer, result.sources, result.blocks);
        setConv(updated ?? originalConversation);
      } else {
        setConv(originalConversation);
        setQuestion(initialQuestion);
        setRequestError(result.message);
      }
      setPendingAnswer(false);
      setStreamingAnswer("");
    });
  }, [conv, initialQuestion]);

  if (!conv) {
    return (
      <div className="screen">
        <UnifiedHeader title="慧读" subtitle="对话不存在" ariaLabel="慧读对话状态" onBack={goBack} backLabel="返回慧读" />
        <div className="huidu-missing">这条慧读记录可能已被删除。</div>
      </div>
    );
  }

  const scriptureContext = hasScriptureContext(conv);
  const legacyBookLabel = conv.refLabel.replace(/\s+\d+:[\d-]+$/, "");
  // 仅旧数据（无 bookCode）才需要反查，且 VERSIONS×BOOKS 枚举不便宜——缓存住，
  // 避免输入框每敲一字就重算一遍
  const legacyContext = useMemo(() => {
    if (conv.bookCode) return undefined;
    return VERSIONS
      .flatMap((candidateVersion) => BOOKS.map((candidateBook) => ({
        bookCode: candidateBook.code,
        versionCode: candidateVersion.code,
        label: bookName(candidateBook, candidateVersion),
      })))
      .find((candidate) => candidate.label === legacyBookLabel);
  }, [conv.bookCode, legacyBookLabel]);
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
    // 清空后把自动增高的输入框收回单行
    requestAnimationFrame(() => {
      if (inputRef.current) inputRef.current.style.height = "auto";
    });
    setAttachment(null);
    setRequestError("");
    setPendingAnswer(true);
    setStreamingAnswer("");
    setConv(optimisticConversation);

    const result = await requestHuiduFollowup(originalConversation, questionForApi, {
      file,
      // 首次解读失败后重试时，对话仍为空，需要继续按 opening 模式请求
      mode: hasScriptureContext(originalConversation) && originalConversation.messages.length === 0 ? "opening" : "followup",
      onDelta: setStreamingAnswer,
    });
    if (result.ok) {
      const updated = appendFollowup(originalConversation.id, displayText, result.answer, result.sources, result.blocks);
      setConv(updated ?? originalConversation);
    } else {
      setConv(originalConversation);
      setQuestion(text);
      setAttachment(file);
      setRequestError(result.message);
    }
    setPendingAnswer(false);
    setStreamingAnswer("");
  };

  return (
    <div className="screen huidu-chat-screen">
      <CompactToolbar
        ariaLabel="慧读对话"
        // 返回放在左侧标题芯片里，和社群详情页（UnifiedHeader）同一个位置。
        // 走真实的历史后退：从圣经页选经文进来的，点返回就回到那节经文；
        // 从慧读列表进来的回列表；深链直达没有历史时兜底到 /huidu。
        primary={(
          <span className="unified-header-title">
            <Icon name="chevron-left" size={14} />
            <span>慧读</span>
          </span>
        )}
        onPrimaryClick={goBack}
        primaryAriaLabel="返回"
        // 经文对话用经节引用做标题：短、稳定、一眼知道在读哪一节。
        // 原来显示的模板标题太长，在顶栏里会被截成「诗篇 2:...」，等于什么都没说。
        // 改名仍然是点这里，说明放在 aria-label 里，省掉一个含义不明的铅笔图标。
        secondary={(
          <span className="huidu-chat-title-label">
            {scriptureContext ? conv.refLabel : conv.title}
          </span>
        )}
        // 经文对话顶栏显示的是经节引用，改 conv.title 在界面上毫无体现——
        // 改名入口只给自由对话（标题真正展示在顶栏与历史列表里）
        secondaryAriaLabel={scriptureContext ? `当前经文 ${conv.refLabel}` : `修改对话标题，当前为${conv.title}`}
        onSecondaryClick={scriptureContext ? undefined : () => {
          setTitleDraft(conv.title);
          setRenameOpen(true);
        }}
        actions={(
          // 字体大小调节（原定位经文按钮：定位入口移到经文引用块上，点引用块即跳经文）
          <button data-icon-button="default"
            className="bible-toolbar-action huidu-chat-toolbar-action"
            type="button"
            title="字体设置"
            aria-label="字体设置"
            aria-expanded={fontPanelOpen}
            onClick={() => setFontPanelOpen((open) => !open)}
          >
            <span className="bible-font-mark" aria-hidden="true">
              <span className="small-a">A</span>
              <span className="large-a">A</span>
            </span>
          </button>
        )}
        overlay={fontPanelOpen ? (
          <div className="bible-reading-settings" role="dialog" aria-label="慧读阅读设置">
            <div className="bible-reading-setting-row">
              <span>字体大小</span>
              <div className="bible-setting-segment is-theme" role="radiogroup" aria-label="字体大小">
                {([[1, "标准"], [1.15, "大"], [1.3, "特大"]] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={fontScale === value}
                    className={fontScale === value ? "active" : ""}
                    onClick={() => setFontScale(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : undefined}
      />

      <main
        ref={scrollRef}
        className="screen-scroll huidu-thread"
        style={{ "--huidu-font-scale": fontScale } as React.CSSProperties}
        onClickCapture={() => { if (fontPanelOpen) setFontPanelOpen(false); }}
      >
        {scriptureContext && (
          // 整块可点：跳回圣经页对应经节（原顶栏定位按钮的职责移到这里）
          <section
            className="huidu-quote is-link"
            role="button"
            tabIndex={0}
            aria-label={`在圣经中查看${conv.refLabel}`}
            onClick={openReferencedVerse}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                openReferencedVerse();
              }
            }}
          >
            <div className="huidu-quote-meta">
              <span>经文</span>
              <b>{conv.refLabel}</b>
              <Icon name="chevron-right" size={13} className="huidu-quote-caret" />
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
              // 自动发出的首问只是触发解读，用户没有亲手输入，不展示成气泡
              if (scriptureContext && index === 0 && message.content.trim() === OPENING_QUESTION) return null;
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
              {streamingAnswer
                ? streamingAnswer.split(/\n\n+/).map((paragraph, index) => <p className="huidu-answer-paragraph" key={index}>{paragraph}</p>)
                : <AiThinking />}
            </div>
          )}
        </div>
      </main>

      <div className="huidu-chat-composer">
        {requestError && (
          <div role="alert" className="huidu-composer-status is-error">
            <span>{requestError}</span>
            {/* 失败时问题已回填进输入框，重试即原样再发一次 */}
            <button type="button" className="huidu-retry-button" onClick={() => void submit(question)}>
              重试
            </button>
          </div>
        )}
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
            <button data-icon-button="default" type="button" aria-label="移除附件" onClick={() => setAttachment(null)}>
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
            <button data-icon-button="default"
              type="button"
              className="huidu-attach-btn"
              aria-label="添加附件"
              title="添加附件（支持文本类文件）"
              onClick={() => fileInputRef.current?.click()}
            >
              <Icon name="paperclip" size={17} />
            </button>
            {/* 多行 textarea：长问题可换行查看编辑；生成回答期间不禁用，
                可以先把下一个问题打好，等发送键恢复后再发 */}
            <textarea
              ref={inputRef}
              value={question}
              rows={1}
              onChange={(event) => {
                setQuestion(event.target.value);
                autosizeInput();
                if (requestError) setRequestError("");
                if (speechInput.error) speechInput.clearError();
              }}
              onKeyDown={(event) => {
                // 外接键盘回车即发送，Shift+回车换行（移动端软键盘走发送键）
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void submit(question);
                }
              }}
              enterKeyHint="send"
              maxLength={1200}
              aria-label={conv.messages.length === 0 ? "输入问题" : "继续追问"}
              placeholder={speechInput.isListening
                ? "正在聆听…"
                : pendingAnswer
                  ? "回答生成中，可先写下一个问题…"
                  : attachment
                    ? "可补充问题，发送后分析附件…"
                    : conv.messages.length === 0
                      ? "有问题，尽管问…"
                      : "继续追问…"}
            />
            <VoiceInputButton
              isSupported={speechInput.isSupported}
              isListening={speechInput.isListening}
              onClick={speechInput.toggleListening}
            />
            <button data-icon-button="primary"
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
