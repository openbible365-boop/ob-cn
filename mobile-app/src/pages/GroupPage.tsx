import { type FormEvent, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Icon } from "../components/Icon";
import {
  askCommunityAssistant,
  confirmCommunityAssistantAction,
  type AssistantAction,
  type AssistantRole,
  type AssistantVisibility,
} from "../data/assistant";
import {
  fetchCommunityGroups,
  getGroup,
  getPosts,
  getMyLikes,
  toggleLike,
  getEvents,
  getMySignups,
  toggleSignup,
  createPost,
  upsertAssistantCommunity,
} from "../data/community";
import { fetchMe, type SessionUser } from "../data/profile";

const MEMBER_TABS = [
  { id: "chat", label: "平台" },
  { id: "info", label: "分享" },
  { id: "events", label: "活动" },
] as const;

const OWNER_TABS = [
  { id: "members", label: "成员" },
  { id: "groups", label: "小组" },
  { id: "resources", label: "资料" },
] as const;

const ALL_TABS = [...MEMBER_TABS, ...OWNER_TABS] as const;

type TabId = (typeof ALL_TABS)[number]["id"];

type ChatMessage = {
  id: string;
  role: AssistantRole;
  content: string;
  visibility?: AssistantVisibility;
  action?: AssistantAction;
};

// 分社群（design 4b 信息 / 4c 交流 / 4d 活动）
export function GroupPage() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const group = getGroup(groupId ?? "");
  const isOfficial = groupId === "official" || group?.badgeStyle === "official";
  const tabs = group?.membershipRole === "OWNER" ? ALL_TABS : MEMBER_TABS;
  const [tab, setTab] = useState<TabId>(() =>
    groupId === "official" ? "chat" : "info",
  );
  const [version, setVersion] = useState(0);
  const [user, setUser] = useState<SessionUser | null | undefined>(undefined);
  const [postText, setPostText] = useState("");
  const [eventFilter, setEventFilter] = useState<"active" | "upcoming" | "ended">("active");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetchMe().then((result) => { if (!cancelled) setUser(result); });
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 2600);
    return () => window.clearTimeout(timer);
  }, [notice]);
=======
  const [memberCountLoading, setMemberCountLoading] = useState(
    group?.memberCount == null,
  );
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        groupId === "official"
          ? "平安！我是慧读平台小助手。我可以帮你创建社群、搜索社群和申请加入社群；所有后台操作都会先请你确认。"
          : `平安！我是${group?.name ?? "当前社群"}的平台助手。我可以解答信仰问题、陪你面对生活中的困难，也能协助办理${group?.name ?? "当前社群"}事务，例如邀请成员、搜索成员和新建小组。重要操作都会先请你确认。`,
    },
  ]);
  const [question, setQuestion] = useState("");
  const visibility: AssistantVisibility = "private";
  const [isSending, setIsSending] = useState(false);
  const [confirmingMessageId, setConfirmingMessageId] = useState("");
  const [chatError, setChatError] = useState("");
  const chatScrollRef = useRef<HTMLDivElement>(null);
  void version;

  useEffect(() => {
    let active = true;
    setMemberCountLoading(getGroup(groupId ?? "")?.memberCount == null);
    fetchCommunityGroups().then((result) => {
      if (!active) return;
      if (result.ok) setVersion((current) => current + 1);
      setMemberCountLoading(false);
    });
    return () => {
      active = false;
    };
  }, [groupId]);

  useEffect(() => {
    if (isOfficial || !group?.name) return;
    setChatMessages((current) =>
      current.map((message) =>
        message.id === "welcome"
          ? {
              ...message,
              content: `平安！我是${group.name}的平台助手。我可以解答信仰问题、陪你面对生活中的困难，也能协助办理${group.name}事务，例如邀请成员、搜索成员和新建小组。重要操作都会先请你确认。`,
            }
          : message,
      ),
    );
  }, [group?.name, isOfficial]);

  useEffect(() => {
    if (tab !== "chat") return;
    const frame = requestAnimationFrame(() => {
      const element = chatScrollRef.current;
      element?.scrollTo({ top: element.scrollHeight, behavior: "smooth" });
    });
    return () => cancelAnimationFrame(frame);
  }, [tab, chatMessages, isSending]);

  async function handleAssistantSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const prompt = question.trim();
    if (!group || !prompt || isSending) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: prompt,
      visibility,
    };
    const history = chatMessages.map(({ role, content }) => ({ role, content }));

    setChatMessages((current) => [...current, userMessage]);
    setQuestion("");
    setChatError("");
    setIsSending(true);

    const result = await askCommunityAssistant({
      groupId: group.id,
      message: prompt,
      history,
      visibility,
    });

    if (result.ok) {
      setChatMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: result.answer,
          action: result.action,
        },
      ]);
      if (result.effect?.type === "COMMUNITY_CREATED" && result.effect.community) {
        upsertAssistantCommunity(result.effect.community);
      }
    } else {
      setChatMessages((current) =>
        current.filter((message) => message.id !== userMessage.id),
      );
      setQuestion(prompt);
      setChatError(result.message);
    }
    setIsSending(false);
  }

  async function handleActionConfirm(messageId: string, action: AssistantAction) {
    if (!group || confirmingMessageId) return;
    setConfirmingMessageId(messageId);
    setChatError("");
    const result = await confirmCommunityAssistantAction({
      groupId: group.id,
      confirmationToken: action.token,
    });
    if (result.ok) {
      setChatMessages((current) => [
        ...current.map((message) =>
          message.id === messageId ? { ...message, action: undefined } : message,
        ),
        {
          id: `assistant-result-${Date.now()}`,
          role: "assistant" as const,
          content: result.answer,
        },
      ]);
      if (result.effect?.type === "COMMUNITY_CREATED" && result.effect.community) {
        upsertAssistantCommunity(result.effect.community);
      }
    } else {
      setChatError(result.message);
    }
    setConfirmingMessageId("");
  }

  function handleActionCancel(messageId: string) {
    setChatMessages((current) => [
      ...current.map((message) =>
        message.id === messageId ? { ...message, action: undefined } : message,
      ),
      {
        id: `assistant-cancel-${Date.now()}`,
        role: "assistant" as const,
        content: "这次操作已经取消，没有修改任何资料。",
      },
    ]);
  }
>>>>>>> origin/agent/sync-latest-mobile-community

  if (!group) {
    return (
      <div className="screen">
        <div className="page-header">
          <button className="icon-btn" onClick={() => navigate("/community")}><Icon name="chevron-left" size={18} /></button>
          <div className="title">社群</div>
        </div>
        <div style={{ padding: 24, fontSize: 13, color: "var(--body)" }}>群组不存在。</div>
      </div>
    );
  }

  const posts = getPosts(group.id);
  const myLikes = getMyLikes();
  const events = getEvents(group.id);
  const mySignups = getMySignups();
  const isOwner = Boolean(user && group.badgeStyle === "owner");
  const invite = async () => {
    const url = `${window.location.origin}${window.location.pathname}#/community/${group.id}`;
    try {
      if (navigator.share) await navigator.share({ title: `加入${group.name}`, text: `邀请你加入${group.name}`, url });
      else {
        await navigator.clipboard.writeText(url);
        setNotice("邀请链接已复制");
      }
    } catch { /* user cancelled */ }
  };

  const submitPost = () => {
    if (!user) { navigate("/me/login", { state: { from: `/community/${group.id}` } }); return; }
    if (!postText.trim()) return;
    createPost(group.id, postText.trim());
    setPostText("");
    setVersion((value) => value + 1);
    setNotice("已发布到群组");
  };

  const submitChat = () => {
    if (!user) { navigate("/me/login", { state: { from: `/community/${group.id}` } }); return; }
    if (!chatText.trim()) return;
    setChatMessages((messages) => [...messages, chatText.trim()]);
    setChatText("");
  };

  return (
    <div className="screen" style={{ background: "var(--surface)" }}>
      {/* header */}
      <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 10, padding: "10px 16px 12px", background: "var(--white)", borderBottom: "1px solid var(--line)" }}>
        <button
          aria-label="返回社群列表"
          onClick={() => navigate("/community")}
          style={{ flex: "none", display: "flex", alignItems: "center", justifyContent: "center", width: 40, height: 44, padding: 0, border: 0, background: "transparent", color: "var(--ink)" }}
        >
          <Icon name="chevron-left" size={36} />
        </button>
        <div style={{ flex: "none", display: "flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, background: group.color, borderRadius: 10, fontSize: 15, fontWeight: 800 }}>
          {group.letter}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 800 }}>{group.name}</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--body)" }}>
            {memberCountLoading
              ? "正在读取成员数…"
              : `${group.memberCount ?? "—"} 成员`}
          </div>
        </div>
        <button className="pill-btn" type="button" aria-label={`邀请朋友加入${group.name}`} onClick={invite}><Icon name="share" size={13} /> 邀请</button>
        {(group.membershipRole === "OWNER" || group.membershipRole === "ADMIN") && (
          <button className="pill-btn" aria-label={`管理${group.name}`} onClick={() => navigate(`/community/${group.id}/settings`)}>
            <Icon name="settings" size={13} /> 设置
          </button>
        )}
      </div>

      {/* sub tabs */}
      <div style={{ flex: "none", display: "grid", gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))`, background: "var(--white)", borderBottom: "1px solid var(--line)", padding: tabs.length > 3 ? "0 6px" : "0 16px" }}>
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", minWidth: 0, height: 42, padding: 0, whiteSpace: "nowrap", fontSize: tabs.length > 3 ? 13 : 14, fontWeight: tab === t.id ? 800 : 600, color: tab === t.id ? "var(--ink)" : "var(--body)" }}>
            {t.label}
            {tab === t.id && (
              <div style={{ position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)", width: 28, height: 3, background: "var(--purple)", borderRadius: 100 }} />
            )}
          </button>
        ))}
      </div>

      {/* 信息 */}
      {tab === "info" && (
        <>
          <div className="screen-scroll" style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ background: "var(--yellow)", borderRadius: 16, boxShadow: "var(--shadow-card)", padding: "12px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", background: "var(--ink)", color: "#fff", padding: "3px 6px", borderRadius: 6 }}>公告</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--body)" }}>{group.id === "official" ? "官方团队" : "群主 · 王弟兄"} · 置顶</div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.7 }}>本周五 20:00 线上共读约翰福音 3 章，到「活动」页一键报名。</div>
            </div>

            {posts.map((p) => {
              const liked = myLikes.includes(p.id);
              return (
                <div key={p.id} className="card" style={{ padding: "14px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <div style={{ flex: "none", display: "flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, background: p.avatarColor, borderRadius: 100, fontSize: 13, fontWeight: 800 }}>
                      {p.avatar}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 800 }}>{p.author}</div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--body)" }}>{p.time}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.75, marginBottom: 10 }}>{p.text}</div>
                  {p.verseRef && (
                    <div
                      role="link"
                      tabIndex={0}
                      onClick={() => navigate(`/bible?t=${p.verseVersion ?? "cuv"}&bk=${p.verseBook ?? "jhn"}&c=${p.verseChapter ?? 3}&v=${p.verseNumber ?? 16}`)}
                      onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.click(); }}
                      style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(135,80,182,.10)", border: "1px solid var(--line)", borderRadius: 12, padding: "10px 12px", marginBottom: 10, cursor: "pointer" }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: "var(--purple)", marginBottom: 3 }}>{p.verseRef}</div>
                        <div style={{ fontSize: 12, fontWeight: 500, color: "var(--body)", lineHeight: 1.6 }}>{p.verseText}</div>
                      </div>
                      <div style={{ color: "var(--purple)" }}><Icon name="chevron-right" size={16} /></div>
                    </div>
                  )}
                  <div style={{ display: "flex", alignItems: "center", gap: 16, color: "var(--body)" }}>
                    <button
                      onClick={() => { toggleLike(p.id); setVersion((v) => v + 1); }}
                      aria-label={`${liked ? "取消点赞" : "点赞"}，当前${p.likes + (liked ? 1 : 0)}个赞`}
                      style={{ display: "flex", minWidth: 44, minHeight: 44, alignItems: "center", gap: 5, fontSize: 12, fontWeight: 700, color: liked ? "var(--pink)" : "var(--body)" }}
                    >
                      <Icon name="heart" size={14} /> {p.likes + (liked ? 1 : 0)}
                    </button>
                    <button disabled title="评论功能将在账号服务接入后开放" aria-label={`${p.comments}条评论，功能即将开放`} style={{ display: "flex", minWidth: 44, minHeight: 44, alignItems: "center", gap: 5, fontSize: 12, fontWeight: 700, color: "var(--body)", opacity: .58 }}>
                      <Icon name="message-square" size={14} /> {p.comments}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <form onSubmit={(event) => { event.preventDefault(); submitPost(); }} style={{ flex: "none", background: "var(--white)", borderTop: "1px solid var(--line)", padding: "10px 16px calc(10px + env(safe-area-inset-bottom))", display: "flex", gap: 10, alignItems: "center" }}>
            <button type="button" disabled className="icon-btn" style={{ opacity: .45 }} title="图片发布即将开放" aria-label="图片发布即将开放"><Icon name="image" size={18} /></button>
            <input value={postText} onChange={(event) => setPostText(event.target.value.slice(0, 280))} aria-label="发布群组信息" placeholder={user ? "分享此刻的领受…" : "登录后参与分享"} style={{ flex: 1, minWidth: 0, height: 44, padding: "0 14px", border: "1px solid var(--line)", borderRadius: 12, fontSize: 14, fontWeight: 500 }} />
            <button type="submit" className="icon-btn primary-icon-btn" aria-label={user ? "发布信息" : "登录后发布"}><Icon name="send" size={18} /></button>
          </form>
        </>
      )}

      {/* 交流 */}
      {tab === "chat" && (
        <>
          <div ref={chatScrollRef} className="screen-scroll" style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, background: "rgba(191,120,246,.14)", borderRadius: 16, padding: "12px 14px" }}>
              <div style={{ flex: "none", display: "flex", alignItems: "center", justifyContent: "center", width: 40, height: 40, background: "var(--purple)", borderRadius: 100, color: "#fff" }}>
                <Icon name="sparkle" size={18} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 2 }}>
                  {isOfficial ? "慧读平台小助手" : `${group.letter}平台助手`}
                </div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--body)" }}>
                  {isOfficial
                    ? "官方服务助手 · 操作前会请你确认"
                    : "信仰陪伴 · 生活关怀 · 社群事务"}
                </div>
              </div>
            </div>

            {chatMessages.map((message) =>
              message.role === "user" ? (
                <div key={message.id} style={{ alignSelf: "flex-end", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, maxWidth: "82%" }}>
                  <div style={{ background: "var(--ink)", color: "#fff", borderRadius: 12, padding: "9px 12px", fontSize: 14, fontWeight: 600, lineHeight: 1.6, boxShadow: "var(--shadow-card)", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                    {message.content}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 700, color: "var(--body)" }}>
                    <Icon name="eye" size={11} />
                    {message.visibility === "private" ? "仅自己可见" : "群内公开"}
                  </div>
                </div>
              ) : (
                <div key={message.id} className="card" style={{ alignSelf: "flex-start", maxWidth: "90%", borderRadius: 12, padding: "10px 14px", fontSize: 13, lineHeight: 1.8, color: "var(--body)", fontWeight: 500, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                  <div>{message.content}</div>
                  {message.action && (
                    <div style={{ marginTop: 10, padding: 12, background: "rgba(232,154,44,.10)", border: "1px solid rgba(232,154,44,.35)", borderRadius: 12, color: "var(--ink)", whiteSpace: "normal" }}>
                      <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 5 }}>
                        {message.action.title}
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 600, lineHeight: 1.65, color: "var(--body)", whiteSpace: "pre-wrap" }}>
                        {message.action.summary}
                      </div>
                      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                        <button
                          type="button"
                          disabled={Boolean(confirmingMessageId)}
                          onClick={() => handleActionCancel(message.id)}
                          style={{ flex: 1, height: 36, border: "1px solid var(--line)", borderRadius: 10, background: "var(--white)", fontSize: 12, fontWeight: 700 }}
                        >
                          取消
                        </button>
                        <button
                          type="button"
                          disabled={Boolean(confirmingMessageId)}
                          onClick={() => handleActionConfirm(message.id, message.action!)}
                          style={{ flex: 1.4, height: 36, borderRadius: 10, background: "#E89A2C", color: "#fff", fontSize: 12, fontWeight: 800, opacity: confirmingMessageId === message.id ? 0.6 : 1 }}
                        >
                          {confirmingMessageId === message.id
                            ? "正在执行…"
                            : message.action.confirmLabel}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ),
            )}

            {isSending && (
              <div aria-live="polite" className="card" style={{ alignSelf: "flex-start", borderRadius: 12, padding: "10px 14px", fontSize: 13, color: "var(--body)", fontWeight: 600 }}>
                正在思考…
              </div>
            )}
            <div className="disclaimer">
              {isOfficial
                ? "平台操作均需本人确认，并由后台再次校验权限"
                : "重要社群操作需本人确认，并由后台再次校验权限"}
            </div>
          </div>
          <form onSubmit={handleAssistantSubmit} style={{ flex: "none", background: "var(--white)", borderTop: "1px solid var(--line)", padding: "10px 16px calc(10px + env(safe-area-inset-bottom))" }}>
            {chatError && (
              <div role="alert" style={{ margin: "-2px 0 8px", fontSize: 11, fontWeight: 700, color: "#c64040" }}>
                {chatError}
              </div>
            )}
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <input
                value={question}
                onChange={(event) => {
                  setQuestion(event.target.value);
                  if (chatError) setChatError("");
                }}
                disabled={isSending}
                maxLength={1200}
                aria-label={isOfficial ? "向慧读平台小助手提问" : "向平台小助手提问"}
                placeholder={isOfficial ? "告诉我你想办理的社群事项…" : `提问或办理${group.name}事务…`}
                style={{ flex: 1, minWidth: 0, height: 46, padding: "0 14px", border: "1px solid var(--line)", borderRadius: 12, background: "var(--white)", font: "inherit", fontSize: 14, fontWeight: 500, color: "var(--ink)", outline: "none" }}
              />
              <button
                type="submit"
                aria-label="发送问题"
                disabled={isSending || !question.trim()}
                className="icon-btn"
                style={{ width: 46, height: 46, background: "var(--purple)", color: "#fff", opacity: isSending || !question.trim() ? 0.45 : 1 }}
              >
                <Icon name="send" size={20} />
              </button>
            </div>
          </form>
        </>
      )}

      {/* 活动 */}
      {tab === "events" && (
        <div className="screen-scroll" style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="seg" role="group" aria-label="活动状态筛选" style={{ alignSelf: "flex-start" }}>
            {([['active', '进行中'], ['upcoming', '未开始'], ['ended', '已结束']] as const).map(([id, label]) => (
              <button type="button" key={id} className={`seg-item${eventFilter === id ? " active" : ""}`} aria-pressed={eventFilter === id} onClick={() => setEventFilter(id)}>{label}</button>
            ))}
          </div>

          {eventFilter === "active" && events.map((e) => {
            const signedUp = mySignups.includes(e.id);
            const total = e.signups + (signedUp ? 1 : 0);
            return (
              <div key={e.id} className="card" style={{ padding: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, borderRadius: 6, padding: "3px 8px", background: e.tagStyle === "purple" ? "rgba(191,120,246,.16)" : "rgba(233,130,100,.2)", color: e.tagStyle === "purple" ? "var(--purple)" : "var(--orange-deep)" }}>
                    {e.tag}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--body)" }}>{e.status}</div>
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 8 }}>{e.title}</div>
                {e.when && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "var(--body)", marginBottom: 4 }}>
                    <Icon name="calendar" size={13} /> {e.when}
                  </div>
                )}
                {e.where && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "var(--body)", marginBottom: 12 }}>
                    <Icon name="map-pin" size={13} /> {e.where}
                  </div>
                )}
                {e.note && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "var(--body)", marginBottom: 12 }}>
                    <Icon name="check" size={13} /> {e.note}
                  </div>
                )}
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  {e.capacity != null ? (
                    <div style={{ flex: 1 }}>
                      <div style={{ height: 6, background: "var(--surface-2)", borderRadius: 100, marginBottom: 5 }}>
                        <div style={{ width: `${Math.min(100, (total / e.capacity) * 100)}%`, height: "100%", background: "var(--purple)", borderRadius: 100 }} />
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--body)" }}>已报名 {total}/{e.capacity}</div>
                    </div>
                  ) : (
                    <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 600, color: "var(--body)" }}>
                      <Icon name="bell" size={13} /> {e.reminder}
                    </div>
                  )}
                  <button
                    onClick={() => { toggleSignup(e.id); setVersion((v) => v + 1); }}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "center", height: 44, padding: "0 18px",
                      borderRadius: 100, fontSize: 13, fontWeight: 700, boxShadow: "var(--shadow-card)",
                      ...(e.capacity != null
                        ? signedUp
                          ? { background: "var(--white)", border: "1px solid var(--line)", color: "var(--ink)" }
                          : { background: "var(--purple)", color: "#fff" }
                        : { background: "var(--white)", border: "1px solid var(--line)", color: "var(--ink)" }),
                    }}
                  >
                    {e.capacity != null ? (signedUp ? "已报名 · 取消" : "一键报名") : "去打卡"}
                  </button>
                </div>
              </div>
            );
          })}

          {eventFilter !== "active" && <div className="empty-state-inline">当前没有{eventFilter === "upcoming" ? "未开始" : "已结束"}的活动。</div>}

          {mySignups.some((id) => events.some((e) => e.id === id && e.capacity != null)) && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(191,120,246,.14)", borderRadius: 12, padding: "10px 14px" }}>
              <div style={{ color: "var(--purple)" }}><Icon name="check" size={15} /></div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--body)" }}>
                你已报名「约翰福音 3 章共读」，开始前 2 小时将收到提醒。
              </div>
            </div>
          )}
        </div>
      )}
      {tab === "members" && group.membershipRole === "OWNER" && (
        <div className="screen-scroll" style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="card" style={{ padding: "16px" }}>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 6 }}>成员管理</div>
            <div style={{ fontSize: 12, lineHeight: 1.65, color: "var(--body)" }}>查看社群成员、处理加入申请并管理成员权限。</div>
          </div>
        </div>
      )}

      {tab === "groups" && group.membershipRole === "OWNER" && (
        <div className="screen-scroll" style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="card" style={{ padding: "16px" }}>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 6 }}>社群小组</div>
            <div style={{ fontSize: 12, lineHeight: 1.65, color: "var(--body)" }}>在社群内建立和管理查经、团契等小组。</div>
          </div>
        </div>
      )}

      {tab === "resources" && group.membershipRole === "OWNER" && (
        <div className="screen-scroll" style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="card" style={{ padding: "16px" }}>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 6 }}>社群资料</div>
            <div style={{ fontSize: 12, lineHeight: 1.65, color: "var(--body)" }}>集中管理社群共读所需的文档、链接与学习资料。</div>
          </div>
        </div>
      )}

      {notice && <div className="toast" role="status">{notice}</div>}
    </div>
  );
}
