import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Icon } from "../components/Icon";
import { CompactToolbar } from "../components/CompactToolbar";
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
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<Conversation[]>(() => getConversations());
  const [grouping, setGrouping] = useState<"time" | "type">("time");
  const [searchOpen, setSearchOpen] = useState(false);
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

  const item = (conversation: Conversation, highlight: boolean) => (
    <div key={conversation.id} className={`huidu-history-row-shell${highlight ? " is-current" : ""}`}>
      <Link to={`/huidu/${conversation.id}`} className="huidu-history-row">
        <span className="huidu-history-copy">
          <span className="huidu-history-title">
            {conversation.title}
          </span>
          <span className="huidu-history-detail">
            <span className={`huidu-history-kind${hasScriptureContext(conversation) ? " is-scripture" : ""}`}>
              {hasScriptureContext(conversation) ? conversation.refLabel : "AI 对话"}
            </span>
            <span className="huidu-history-meta">
              {Math.ceil(conversation.messages.length / 2)} 轮 · {fmtTime(conversation.createdAt)}
            </span>
          </span>
        </span>
      </Link>
      <button
        type="button"
        className="huidu-history-delete"
        aria-label={`删除${conversation.title}对话记录`}
        title="删除记录"
        onClick={() => setDeleteTarget(conversation)}
      >
        <Icon name="trash" size={15} />
      </button>
    </div>
  );

  return (
    <div className="screen huidu-home-screen">
      <CompactToolbar
        ariaLabel="慧读"
        primary="慧读"
        secondary={`本地 ${conversations.length} 条`}
        actions={(
          <>
            <button
              className={`bible-toolbar-action${searchOpen ? " is-active" : ""}`}
              type="button"
              aria-label={searchOpen ? "关闭搜索" : "搜索慧读记录"}
              title={searchOpen ? "关闭搜索" : "搜索"}
              onClick={() => {
                setSearchOpen((open) => !open);
                if (searchOpen) setSearchText("");
              }}
            >
              <Icon name={searchOpen ? "x" : "search"} size={19} />
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
            placeholder="搜索经文、经卷或历史对话"
            aria-label="搜索慧读历史"
            onChange={(event) => setSearchText(event.target.value)}
          />
          {searchText && (
            <button type="button" aria-label="清空搜索" onClick={() => setSearchText("")}>
              <Icon name="x" size={14} />
            </button>
          )}
        </div>
      )}

      <div className="screen-scroll huidu-home-scroll">
        <button className="huidu-start" type="button" onClick={openNewDialog}>
          <span className="huidu-start-icon" aria-hidden="true">
            <Icon name="sparkle" size={21} />
          </span>
          <span className="huidu-start-copy">
            <b>开始新的 AI 对话</b>
            <small>自由提问，或选择经文深入阅读</small>
          </span>
          <Icon name="chevron-right" size={17} />
        </button>

        <section className="huidu-history-section" aria-label="AI 对话记录">
          <div className="huidu-history-heading">
            <div>
              <b>对话记录</b>
              <span>{normalizedSearch ? `${filteredConversations.length}/${conversations.length}` : `${conversations.length} 条`}</span>
            </div>
            <div className="huidu-history-sort" role="group" aria-label="AI 对话记录排序">
              <button type="button" className={grouping === "time" ? "active" : ""} aria-pressed={grouping === "time"} onClick={() => setGrouping("time")}>时间</button>
              <button type="button" className={grouping === "type" ? "active" : ""} aria-pressed={grouping === "type"} onClick={() => setGrouping("type")}>类型</button>
            </div>
          </div>

          {grouping === "time" && today.length > 0 && (
            <div className="huidu-history-group">
              <div className="huidu-history-label">今天</div>
              <div className="huidu-history-list">{today.map((conversation, index) => item(conversation, index === 0))}</div>
            </div>
          )}
          {grouping === "time" && earlier.length > 0 && (
            <div className="huidu-history-group">
              <div className="huidu-history-label">更早</div>
              <div className="huidu-history-list">{earlier.map((conversation) => item(conversation, false))}</div>
            </div>
          )}
          {grouping === "type" && generalConversations.length > 0 && (
            <div className="huidu-history-group">
              <div className="huidu-history-label">自由对话</div>
              <div className="huidu-history-list">{generalConversations.map((conversation) => item(conversation, false))}</div>
            </div>
          )}
          {grouping === "type" && scriptureConversations.length > 0 && (
            <div className="huidu-history-group">
              <div className="huidu-history-label">经文慧读</div>
              <div className="huidu-history-list">{scriptureConversations.map((conversation) => item(conversation, false))}</div>
            </div>
          )}
          {filteredConversations.length === 0 && (
            <div className="huidu-history-empty">
              {normalizedSearch
                ? `没有找到与“${searchText.trim()}”相关的对话。`
                : "还没有 AI 对话。自由提问或选择一节经文即可开始。"}
            </div>
          )}
        </section>

        <div className="disclaimer">
          对话记录仅保存在本机。当前回答仅供阅读参考，不替代教会教导与权威释经。
        </div>
      </div>

      {deleteTarget && (
        <div className="huidu-new-layer">
          <button className="huidu-new-scrim" type="button" aria-label="取消删除" onClick={() => setDeleteTarget(null)} />
          <section className="huidu-delete-dialog" role="dialog" aria-modal="true" aria-labelledby="huidu-delete-title">
            <h2 id="huidu-delete-title">删除这条慧读记录？</h2>
            <p>{deleteTarget.title} · 删除后无法恢复</p>
            <div>
              <button type="button" onClick={() => setDeleteTarget(null)}>取消</button>
              <button
                type="button"
                className="is-danger"
                onClick={() => {
                  setConversations(deleteConversation(deleteTarget.id));
                  setDeleteTarget(null);
                }}
              >
                删除
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
