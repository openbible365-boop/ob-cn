import { useEffect, useMemo, useState } from "react";
import { EmptyState } from "../components/EmptyState";
import { Link, useNavigate } from "react-router-dom";
import { Icon } from "../components/Icon";
import { CompactToolbar } from "../components/CompactToolbar";
import { useSettings } from "../context/SettingsContext";
import { ANDROID_BACK_EVENT } from "../native/android-back";
import { bookName, getBookByCode, getReading, getVersion } from "../data/scripture";
import {
  deleteConversation,
  getConversations,
  hasScriptureContext,
  type Conversation,
} from "../data/huidu";

function fmtTime(iso: string) {
  return iso.slice(11, 16);
}

function isToday(iso: string) {
  return iso.slice(0, 10) === new Date().toISOString().slice(0, 10);
}

export function HuiduHomePage() {
  const { translate } = useSettings();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<Conversation[]>(() => getConversations());
  const [grouping, setGrouping] = useState<"time" | "type">("time");
  const [searchOpen, setSearchOpen] = useState(false);

  // 安卓返回键：搜索面板打开时先关它
  useEffect(() => {
    if (!searchOpen) return;
    const close = (event: Event) => { event.preventDefault(); setSearchOpen(false); };
    window.addEventListener(ANDROID_BACK_EVENT, close);
    return () => window.removeEventListener(ANDROID_BACK_EVENT, close);
  }, [searchOpen]);
  const [searchText, setSearchText] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Conversation | null>(null);

  const normalizedSearch = searchText.trim().toLocaleLowerCase("zh-CN");
  const filteredConversations = useMemo(() => {
    if (!normalizedSearch) return conversations;
    return conversations.filter((conversation) => {
      const messageText = conversation.messages
        .map((message) => message.role === "user"
          ? message.content
          : message.content ?? (message.blocks ?? []).map((block) => block.text).join(" "))
        .join(" ");
      return `${conversation.refLabel ?? ""} ${conversation.title} ${messageText}`
        .toLocaleLowerCase("zh-CN")
        .includes(normalizedSearch);
    });
  }, [conversations, normalizedSearch]);

  const today = filteredConversations.filter((conversation) => isToday(conversation.createdAt));
  const earlier = filteredConversations.filter((conversation) => !isToday(conversation.createdAt));
  const scriptureConversations = filteredConversations.filter(hasScriptureContext);
  const generalConversations = filteredConversations.filter((conversation) => !hasScriptureContext(conversation));

  const openNewDialog = () => {
    navigate("/huidu/new");
  };

  // 问候随时段变化；灵感追问跟着当前读经位置生成
  const hour = new Date().getHours();
  const greeting = hour < 5 ? "夜深了" : hour < 11 ? "清晨好" : hour < 14 ? "午安" : hour < 18 ? "午后好" : "晚上好";
  const reading = getReading();
  const readingBook = bookName(getBookByCode(reading.book), getVersion(reading.version));
  const sparkQuestions = [
    `${readingBook} ${reading.chapter} 章在讲什么？`,
    `如何把${readingBook} ${reading.chapter} 章应用到今天？`,
    `${readingBook}的核心主题是什么？`,
  ];
  const askSpark = (question: string) => {
    navigate("/huidu/new", { state: { justCreated: true, initialQuestion: question } });
  };
  const latest = normalizedSearch ? null : conversations[0] ?? null;

  const item = (conversation: Conversation, highlight: boolean) => {
    // 经文慧读的标题都是「XX 的历史背景与生活应用」这类模板句，整列看下来全是重复。
    // 真正能区分记录的是经文引用，所以经文对话用引用做主标题。
    const scripture = hasScriptureContext(conversation);
    const heading = scripture ? conversation.refLabel : conversation.title;
    // 整行只有一行高度：经文对话用「引用 + 经文原文」区分，自由对话的标题本身
    // 就是由首个提问生成的，再放一遍提问只会重复，所以不给摘要。
    const summary = scripture
      ? conversation.verseText.replace(/^\d+\s*节：/, "").replace(/\s+/g, " ").trim()
      : "";

    return (
    <div key={conversation.id} className={`huidu-history-row-shell${highlight ? " is-current" : ""}`}>
      <Link to={`/huidu/${conversation.id}`} className="huidu-history-row">
        <span className={`huidu-history-mark${scripture ? " is-scripture" : ""}`} aria-hidden="true">
          <Icon name={scripture ? "book" : "sparkle"} size={16} />
        </span>
        <span className={`huidu-history-copy${summary ? "" : " is-single"}`}>
          <span className="huidu-history-title">{translate(heading)}</span>
          {summary && <span className="huidu-history-summary">{translate(summary)}</span>}
          <span className="huidu-history-meta">
            {Math.ceil(conversation.messages.length / 2)} {translate("轮")} · {fmtTime(conversation.createdAt)}
          </span>
        </span>
      </Link>
      <button data-icon-button="danger"
        type="button"
        className="huidu-history-delete"
        aria-label={translate("删除") + translate(conversation.title) + translate("对话记录")}
        title={translate("删除记录")}
        onClick={() => setDeleteTarget(conversation)}
      >
        <Icon name="trash" size={16} />
      </button>
    </div>
    );
  };

  return (
    <div className="screen huidu-home-screen">
      <CompactToolbar
        ariaLabel={translate("慧读与今日额度")}
        primary={translate("慧读")}
        secondary={`${conversations.length} ${translate("条对话")}`}
        actions={(
          <>
            <button data-icon-button="default"
              className={`bible-toolbar-action${searchOpen ? " is-active" : ""}`}
              type="button"
              aria-label={searchOpen ? translate("关闭搜索") : translate("搜索慧读记录")}
              title={searchOpen ? translate("关闭搜索") : translate("搜索")}
              onClick={() => {
                setSearchOpen((open) => !open);
                if (searchOpen) setSearchText("");
              }}
            >
              <Icon name={searchOpen ? "x" : "search"} size={20} />
            </button>
          </>
        )}
      />

      {searchOpen && (
        <div className="huidu-search">
          <Icon name="search" size={16} />
          <input
            autoFocus
            type="search"
            value={searchText}
            placeholder={translate("搜索经文、经卷或历史对话")}
            aria-label={translate("搜索慧读历史")}
            onChange={(event) => setSearchText(event.target.value)}
          />
          {searchText && (
            <button data-icon-button="default" type="button" aria-label={translate("清空搜索")} onClick={() => setSearchText("")}>
              <Icon name="x" size={14} />
            </button>
          )}
        </div>
      )}

      <div className="screen-scroll huidu-home-scroll">
        {/* 问经台：输入先行，灵感追问随读经进度而变 */}
        <section className="huidu-hero" aria-label={translate("发起提问")}>
          <div className="huidu-hero-greet">{translate(greeting)}</div>
          <h1>{translate("想明白什么？")}</h1>
          <button type="button" className="huidu-ask" onClick={openNewDialog}>
            <Icon name="sparkle" size={18} />
            <span>{translate("直接提问，或选一节经文深读…")}</span>
          </button>
          <div className="huidu-spark-chips" aria-label={translate("灵感追问")}>
            {sparkQuestions.map((question) => (
              <button key={question} type="button" onClick={() => askSpark(translate(question))}>
                {translate(question)}
              </button>
            ))}
          </div>
        </section>

        {latest && (
          <Link to={`/huidu/${latest.id}`} className="huidu-resume-card">
            <span className="huidu-resume-kicker">
              <Icon name={hasScriptureContext(latest) ? "book" : "sparkle"} size={13} />
              {translate("继续上次")}
            </span>
            <b>{translate(hasScriptureContext(latest) ? latest.refLabel || latest.title : latest.title)}</b>
            <Icon name="chevron-right" size={16} className="huidu-resume-caret" />
          </Link>
        )}

        <section className="huidu-history-section" aria-label={translate("AI 对话记录")}>
          <div className="huidu-history-heading">
            <div>
              <b>{translate("对话记录")}</b>
              <span>{normalizedSearch ? `${filteredConversations.length}/${conversations.length}` : `${conversations.length} ${translate("条")}`}</span>
            </div>
            <div className="huidu-history-sort" role="group" aria-label={translate("AI 对话记录排序")}>
              <button type="button" className={grouping === "time" ? "active" : ""} aria-pressed={grouping === "time"} onClick={() => setGrouping("time")}>{translate("时间")}</button>
              <button type="button" className={grouping === "type" ? "active" : ""} aria-pressed={grouping === "type"} onClick={() => setGrouping("type")}>{translate("类型")}</button>
            </div>
          </div>

          {grouping === "time" && today.length > 0 && (
            <div className="huidu-history-group">
              <div className="huidu-history-label">{translate("今天")}</div>
              <div className="huidu-history-list">{today.map((conversation, index) => item(conversation, index === 0))}</div>
            </div>
          )}
          {grouping === "time" && earlier.length > 0 && (
            <div className="huidu-history-group">
              <div className="huidu-history-label">{translate("更早")}</div>
              <div className="huidu-history-list">{earlier.map((conversation) => item(conversation, false))}</div>
            </div>
          )}
          {grouping === "type" && generalConversations.length > 0 && (
            <div className="huidu-history-group">
              <div className="huidu-history-label">{translate("自由对话")}</div>
              <div className="huidu-history-list">{generalConversations.map((conversation) => item(conversation, false))}</div>
            </div>
          )}
          {grouping === "type" && scriptureConversations.length > 0 && (
            <div className="huidu-history-group">
              <div className="huidu-history-label">{translate("经文慧读")}</div>
              <div className="huidu-history-list">{scriptureConversations.map((conversation) => item(conversation, false))}</div>
            </div>
          )}
          {filteredConversations.length === 0 && (
            normalizedSearch ? (
              <EmptyState
                compact
                art="search"
                title={translate("没有找到相关对话")}
                desc={translate(`没有与“${searchText.trim()}”相关的记录，换个关键词试试。`)}
              />
            ) : (
              <EmptyState
                compact
                art="huidu"
                title={translate("还没有 AI 对话")}
                desc={translate("自由提问，或选择一节经文即可开始。")}
              />
            )
          )}
        </section>

        <div className="disclaimer">
          {translate("对话记录仅保存在本机。当前回答仅供阅读参考，不替代教会教导与权威释经。")}
        </div>
      </div>

      {deleteTarget && (
        <div className="huidu-new-layer">
          <button className="huidu-new-scrim" type="button" aria-label={translate("取消删除")} onClick={() => setDeleteTarget(null)} />
          <section className="huidu-delete-dialog" role="dialog" aria-modal="true" aria-labelledby="huidu-delete-title">
            <h2 id="huidu-delete-title">{translate("删除这条慧读记录？")}</h2>
            <p>{translate(deleteTarget.title)} · {translate("删除后无法恢复")}</p>
            <div>
              <button type="button" onClick={() => setDeleteTarget(null)}>{translate("取消")}</button>
              <button
                type="button"
                className="is-danger"
                onClick={() => {
                  setConversations(deleteConversation(deleteTarget.id));
                  setDeleteTarget(null);
                }}
              >
                {translate("删除")}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
