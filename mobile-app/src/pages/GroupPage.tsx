import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Icon } from "../components/Icon";
import { UnifiedHeader } from "../components/UnifiedHeader";
import {
  CommunityEventsPanel,
  CommunityGroupsPanel,
  CommunityMorePanel,
  CommunityMembersPanel,
  CommunityResourcesPanel,
  CommunitySharePanel,
  type CommunityMoreSection,
} from "../components/community/WorkspacePanels";
import {
  askCommunityAssistant,
  confirmCommunityAssistantAction,
  type AssistantAction,
  type AssistantRole,
  type AssistantVisibility,
} from "../data/assistant";
import { cacheCommunityWorkspace, fetchCommunityGroups, getGroup, upsertAssistantCommunity } from "../data/community";
import {
  fetchCommunityWorkspace,
  performWorkspaceAction,
  type CommunityWorkspace,
  type WorkspaceActionInput,
} from "../data/community-workspace";

const TABS = [
  { id: "feed", label: "群动态" },
  { id: "assistant", label: "助手" },
  { id: "events", label: "活动" },
  { id: "more", label: "更多" },
] as const;

type TabId = (typeof TABS)[number]["id"];
type ChatMessage = {
  id: string;
  role: AssistantRole;
  content: string;
  visibility?: AssistantVisibility;
  action?: AssistantAction;
};

export function GroupPage() {
  const { groupId = "" } = useParams();
  const navigate = useNavigate();
  const cachedGroup = getGroup(groupId);
  const [tab, setTab] = useState<TabId>("feed");
  const [moreSection, setMoreSection] = useState<CommunityMoreSection | null>(null);
  const [workspace, setWorkspace] = useState<CommunityWorkspace | null>(null);
  const [workspaceLoading, setWorkspaceLoading] = useState(true);
  const [workspaceError, setWorkspaceError] = useState("");
  const [workspaceMessage, setWorkspaceMessage] = useState("");
  const [workspaceBusy, setWorkspaceBusy] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: groupId === "official"
        ? "平安！我是慧读社群助手。我可以帮你处理社群事务；所有后台操作都会先请你确认。"
        : `平安！我是${cachedGroup?.name ?? "当前社群"}的社群助手。我可以解答信仰问题、陪伴生活需要，也能协助办理社群事务。重要操作都会先请你确认。`,
    },
  ]);
  const [question, setQuestion] = useState("");
  const visibility: AssistantVisibility = "private";
  const [isSending, setIsSending] = useState(false);
  const [confirmingMessageId, setConfirmingMessageId] = useState("");
  const [chatError, setChatError] = useState("");
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const loadWorkspace = useCallback(async (showLoading = true) => {
    if (!groupId) return;
    if (showLoading) setWorkspaceLoading(true);
    setWorkspaceError("");
    const result = await fetchCommunityWorkspace(groupId);
    if (result.ok) {
      setWorkspace(result.workspace);
      if (groupId !== "official") {
        cacheCommunityWorkspace({
          community: result.workspace.community,
          role: result.workspace.access.role,
          memberCount: result.workspace.usage.members,
          groups: result.workspace.groups,
        });
      }
    }
    else setWorkspaceError(result.message);
    setWorkspaceLoading(false);
  }, [groupId]);

  useEffect(() => {
    let active = true;
    void fetchCommunityGroups();
    if (active) void loadWorkspace();
    return () => { active = false; };
  }, [loadWorkspace]);

  const displayName = workspace?.community.name ?? cachedGroup?.name ?? "社群";
  const displayId = workspace?.community.id ?? cachedGroup?.id ?? groupId;
  const isOfficial = groupId === "official" || workspace?.community.tier === "OFFICIAL_FREE" || cachedGroup?.badgeStyle === "official";

  useEffect(() => {
    if (isOfficial || !displayName) return;
    setChatMessages((current) => current.map((message) => message.id === "welcome" ? {
      ...message,
      content: `平安！我是${displayName}的社群助手。我可以解答信仰问题、陪伴生活需要，也能协助办理${displayName}事务。重要操作都会先请你确认。`,
    } : message));
  }, [displayName, isOfficial]);

  useEffect(() => {
    if (tab !== "assistant") return;
    const frame = requestAnimationFrame(() => chatScrollRef.current?.scrollTo({ top: chatScrollRef.current.scrollHeight, behavior: "smooth" }));
    return () => cancelAnimationFrame(frame);
  }, [tab, chatMessages, isSending]);

  function openMore(section: CommunityMoreSection) {
    setMoreSection(section);
    setTab("more");
  }

  function selectPrimaryTab(nextTab: TabId) {
    setTab(nextTab);
    if (nextTab !== "more") setMoreSection(null);
  }

  async function shareAssistantMessage(content: string) {
    if (!window.confirm("确认将这段助手回答分享至群动态？发布后群成员可以看到。")) return;
    const cleanContent = Array.from(content).slice(0, 2_000).join("");
    if (await runWorkspaceAction({ action: "CREATE_POST", content: cleanContent })) {
      selectPrimaryTab("feed");
    }
  }

  async function runWorkspaceAction(input: WorkspaceActionInput) {
    if (!groupId || workspaceBusy) return false;
    setWorkspaceBusy(true);
    setWorkspaceError("");
    setWorkspaceMessage("");
    const result = await performWorkspaceAction(groupId, input);
    if (result.ok) {
      setWorkspaceMessage(result.message);
      if (result.refresh !== false) await loadWorkspace(false);
    } else {
      setWorkspaceError(result.message);
    }
    setWorkspaceBusy(false);
    return result.ok;
  }

  async function handleAssistantSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const prompt = question.trim();
    if (!displayId || !prompt || isSending) return;
    const userMessage: ChatMessage = { id: `user-${Date.now()}`, role: "user", content: prompt, visibility };
    const history = chatMessages.map(({ role, content }) => ({ role, content }));
    setChatMessages((current) => [...current, userMessage]);
    setQuestion("");
    setChatError("");
    setIsSending(true);
    const result = await askCommunityAssistant({ groupId: groupId || displayId, message: prompt, history, visibility });
    if (result.ok) {
      setChatMessages((current) => [...current, { id: `assistant-${Date.now()}`, role: "assistant", content: result.answer, action: result.action }]);
      if (result.effect?.type === "COMMUNITY_CREATED" && result.effect.community) upsertAssistantCommunity(result.effect.community);
    } else {
      setChatMessages((current) => current.filter((message) => message.id !== userMessage.id));
      setQuestion(prompt);
      setChatError(result.message);
    }
    setIsSending(false);
  }

  async function handleActionConfirm(messageId: string, action: AssistantAction) {
    if (!displayId || confirmingMessageId) return;
    setConfirmingMessageId(messageId);
    setChatError("");
    const result = await confirmCommunityAssistantAction({ groupId: groupId || displayId, confirmationToken: action.token });
    if (result.ok) {
      setChatMessages((current) => [
        ...current.map((message) => message.id === messageId ? { ...message, action: undefined } : message),
        { id: `assistant-result-${Date.now()}`, role: "assistant", content: result.answer },
      ]);
      if (result.effect?.type === "COMMUNITY_CREATED" && result.effect.community) upsertAssistantCommunity(result.effect.community);
      await loadWorkspace(false);
    } else setChatError(result.message);
    setConfirmingMessageId("");
  }

  function handleActionCancel(messageId: string) {
    setChatMessages((current) => [
      ...current.map((message) => message.id === messageId ? { ...message, action: undefined } : message),
      { id: `assistant-cancel-${Date.now()}`, role: "assistant", content: "这次操作已经取消，没有修改任何资料。" },
    ]);
  }

  return (
    <div className="screen" style={{ background: "var(--surface)" }}>
      <UnifiedHeader
        title={displayName}
        subtitle={workspaceLoading ? "读取中" : workspace ? `${workspace.usage.members} 人` : "不可用"}
        ariaLabel={`${displayName}社群概览`}
        onBack={() => navigate("/community")}
        backLabel="返回社群列表"
        actions={workspace?.access.isAdmin ? (
          <button className="bible-toolbar-action" aria-label="社群管理" title="社群管理" onClick={() => navigate(`/community/${groupId}/settings`)}><Icon name="settings" size={20} /></button>
        ) : undefined}
      />

      <div className="community-tabs" role="tablist" aria-label="社群功能">
        {TABS.map((item) => (
          <button key={item.id} role="tab" aria-selected={tab === item.id} onClick={() => selectPrimaryTab(item.id)} className={tab === item.id ? "active" : ""}>{item.label}</button>
        ))}
      </div>

      {(workspaceError || workspaceMessage) && (
        <div className={`community-feedback${workspaceError ? " is-error" : ""}`} role={workspaceError ? "alert" : "status"}>
          {workspaceError || workspaceMessage}
          {workspaceError && <button onClick={() => loadWorkspace()}>重试</button>}
        </div>
      )}

      {workspaceLoading && !workspace && <div className="route-status"><Icon name="users" size={22} /><b>正在读取社群</b><span>同步成员权限和栏目内容…</span></div>}

      {workspace && tab === "feed" && <CommunitySharePanel workspace={workspace} busy={workspaceBusy} runAction={runWorkspaceAction} />}
      {workspace && tab === "events" && <CommunityEventsPanel workspace={workspace} busy={workspaceBusy} runAction={runWorkspaceAction} />}
      {workspace && tab === "more" && !moreSection && <CommunityMorePanel workspace={workspace} onOpen={setMoreSection} />}
      {workspace && tab === "more" && moreSection && (
        <>
          <div className="community-more-subheader">
            <button onClick={() => setMoreSection(null)}><Icon name="chevron-left" size={16} />更多</button>
            <b>{moreSection === "members" ? "成员" : moreSection === "groups" ? "小组" : "资料"}</b>
          </div>
          {moreSection === "members" && <CommunityMembersPanel workspace={workspace} busy={workspaceBusy} runAction={runWorkspaceAction} />}
          {moreSection === "groups" && <CommunityGroupsPanel workspace={workspace} busy={workspaceBusy} runAction={runWorkspaceAction} />}
          {moreSection === "resources" && <CommunityResourcesPanel workspace={workspace} busy={workspaceBusy} runAction={runWorkspaceAction} />}
        </>
      )}

      {tab === "assistant" && (
        <>
          <div ref={chatScrollRef} className="screen-scroll community-chat-scroll">
            <div className="community-assistant-banner">
              <span><Icon name="sparkle" size={18} /></span>
              <div><b>{isOfficial ? "慧读社群助手" : `${workspace?.community.abbreviation ?? cachedGroup?.letter ?? "群"}社群助手`}</b><small>{isOfficial ? "官方服务助手 · 操作前会请你确认" : "信仰陪伴 · 生活关怀 · 社群事务"}</small></div>
            </div>
            {workspace && (
              <div className="community-assistant-shortcuts" aria-label="助手快捷入口">
                <button onClick={() => setQuestion("我有一个查经与经文问题：")}><Icon name="book" size={16} />查经问题</button>
                <button onClick={() => selectPrimaryTab("events")}><Icon name="calendar" size={16} />创建活动</button>
                <button onClick={() => openMore("members")}><Icon name="users" size={16} />查找成员</button>
                <button onClick={() => openMore("groups")}><Icon name="users" size={16} />创建小组</button>
                <button onClick={() => openMore("resources")}><Icon name="search" size={16} />查找资料</button>
                <button onClick={() => workspace.access.isAdmin ? navigate(`/community/${groupId}/settings`) : setQuestion("请帮我查看当前有哪些待处理事项。")}><Icon name="bell" size={16} />待处理事项</button>
              </div>
            )}
            {chatMessages.map((message) => message.role === "user" ? (
              <div key={message.id} className="community-user-message"><div>{message.content}</div><small><Icon name="eye" size={11} />仅自己可见</small></div>
            ) : (
              <div key={message.id} className="card community-assistant-message">
                <div>{message.content}</div>
                {message.action && (
                  <div className="community-confirm-card">
                    <b>{message.action.title}</b><p>{message.action.summary}</p>
                    <div><button disabled={Boolean(confirmingMessageId)} onClick={() => handleActionCancel(message.id)} className="compact-action-btn">取消</button><button disabled={Boolean(confirmingMessageId)} onClick={() => handleActionConfirm(message.id, message.action!)} className="compact-action-btn is-primary">{confirmingMessageId === message.id ? "正在执行…" : message.action.confirmLabel}</button></div>
                  </div>
                )}
                {message.id !== "welcome" && !message.action && workspace && (
                  <button className="community-share-assistant" onClick={() => shareAssistantMessage(message.content)}>
                    <Icon name="share" size={14} />分享至动态
                  </button>
                )}
              </div>
            ))}
            {isSending && <div className="card community-assistant-message">正在思考…</div>}
            <div className="disclaimer">重要社群操作需本人确认，并由后台再次校验权限</div>
          </div>
          <form onSubmit={handleAssistantSubmit} className="community-chat-composer">
            {chatError && <div role="alert">{chatError}</div>}
            <span><input value={question} onChange={(event) => { setQuestion(event.target.value); if (chatError) setChatError(""); }} disabled={isSending || !workspace} maxLength={1200} aria-label="向社群助手提问" placeholder={isOfficial ? "告诉我你想办理的社群事项…" : `提问或办理${displayName}事务…`} /><button type="submit" aria-label="发送问题" disabled={isSending || !workspace || !question.trim()} className="icon-btn icon-btn-primary composer-icon-btn"><Icon name="send" size={20} /></button></span>
          </form>
        </>
      )}
    </div>
  );
}
