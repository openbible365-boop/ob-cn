import { type ChangeEvent, type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Icon } from "../components/Icon";
import { UnifiedHeader } from "../components/UnifiedHeader";
import { UserAvatar } from "../components/UserAvatar";
import { VoiceInputButton } from "../components/VoiceInputButton";
import {
  CommunityEventsPanel,
  CommunityGroupsPanel,
  CommunityMembersPanel,
  CommunityResourcesPanel,
  CommunitySharePanel,
} from "../components/community/WorkspacePanels";
import {
  askCommunityAssistant,
  askCommunityAssistantWithAttachment,
  confirmCommunityAssistantAction,
  type AssistantAction,
  type AssistantRole,
  type AssistantStructuredResult,
  type AssistantVisibility,
} from "../data/assistant";
import { cacheCommunityWorkspace, fetchCommunityGroups, getGroup, upsertAssistantCommunity } from "../data/community";
import {
  fetchCommunityWorkspace,
  heartbeatCommunityPresence,
  performWorkspaceAction,
  uploadCommunityResource,
  type CommunityWorkspace,
  type WorkspaceActionInput,
  type WorkspaceResource,
} from "../data/community-workspace";
import { useSpeechInput } from "../hooks/useSpeechInput";
import { useSessionUser } from "../hooks/useSessionUser";

const TABS = [
  { id: "assistant", label: "助手" },
  { id: "feed", label: "动态" },
  { id: "events", label: "活动" },
  { id: "members", label: "成员" },
  { id: "groups", label: "小组" },
  { id: "resources", label: "资料" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function tabFromParam(value: string | null): TabId {
  return TABS.some((item) => item.id === value)
    ? (value as TabId)
    : "assistant";
}

type ChatMessage = {
  id: string;
  role: AssistantRole;
  content: string;
  visibility?: AssistantVisibility;
  action?: AssistantAction;
  result?: AssistantStructuredResult;
  operation?: boolean;
};

function isAssistantOperationPrompt(value: string) {
  return /^(?:请(?:帮我)?|帮我)?(?:发布|发表|发一条|发个|创建|新建|安排|管理|进入|前往|查找|搜索|寻找|找一下|查看|列出|申请加入)/u.test(
    value.trim(),
  );
}

function assistantWelcomeMessage(groupId: string, groupName?: string) {
  const name = groupId === "official" ? "慧读总群" : groupName ?? "当前社群";
  return `平安！我是${name}的专属助手，只使用本群资料和权限。你可以问经文、查资料，或直接告诉我需要办理的群事务。`;
}

function readableFileSize(value: number) {
  if (value < 1_024) return `${value} B`;
  if (value < 1_024 * 1_024) return `${(value / 1_024).toFixed(1)} KB`;
  return `${(value / (1_024 * 1_024)).toFixed(1)} MB`;
}

function workspaceRoleLabel(role?: "OWNER" | "ADMIN" | "MEMBER") {
  return role === "OWNER" ? "群主" : role === "ADMIN" ? "管理员" : "成员";
}

export function GroupPage() {
  const sessionUser = useSessionUser();
  const { groupId = "" } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const cachedGroup = getGroup(groupId);
  const requestedTab = searchParams.get("tab");
  const [tab, setTab] = useState<TabId>(() => tabFromParam(requestedTab));
  const [workspace, setWorkspace] = useState<CommunityWorkspace | null>(null);
  const [workspaceLoading, setWorkspaceLoading] = useState(true);
  const [workspaceError, setWorkspaceError] = useState("");
  const [workspaceMessage, setWorkspaceMessage] = useState("");
  const [workspaceBusy, setWorkspaceBusy] = useState(false);
  const [onlineCount, setOnlineCount] = useState<number | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: assistantWelcomeMessage(groupId, cachedGroup?.name),
    },
  ]);
  const [question, setQuestion] = useState("");
  const visibility: AssistantVisibility = "private";
  const [isSending, setIsSending] = useState(false);
  const [confirmingMessageId, setConfirmingMessageId] = useState("");
  const [chatError, setChatError] = useState("");
  const [pendingResourceFile, setPendingResourceFile] = useState<File | null>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const resourceFileInputRef = useRef<HTMLInputElement>(null);

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadDesc, setUploadDesc] = useState("");
  const [uploadKnowledge, setUploadKnowledge] = useState(true);
  const [uploadVisibility, setUploadVisibility] = useState<"MEMBERS" | "ADMINS">("MEMBERS");
  const speechInput = useSpeechInput({
    value: question,
    onChange: setQuestion,
    disabled: isSending || !workspace,
  });

  useEffect(() => {
    setWorkspace(null);
    setOnlineCount(null);
    setTab(tabFromParam(requestedTab));
    setQuestion("");
    setChatError("");
    setPendingResourceFile(null);
    setChatMessages([
      {
        id: "welcome",
        role: "assistant",
        content: assistantWelcomeMessage(groupId, getGroup(groupId)?.name),
      },
    ]);
  }, [groupId, requestedTab]);

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
  const isOfficial =
    groupId === "official" ||
    workspace?.community.isOfficial === true ||
    workspace?.community.tier === "OFFICIAL_FREE" ||
    cachedGroup?.badgeStyle === "official";
  const usesPrivateConversationAttachments = isOfficial && !workspace?.access.canManageResources;
  const canAttachFiles = Boolean(workspace?.access.canManageResources || isOfficial);
  const visibleTabs = isOfficial
    ? TABS.filter((item) => item.id === "assistant" || item.id === "feed" || item.id === "events")
    : TABS.filter((item) => item.id !== "groups" || Boolean(workspace?.access.isAdmin));
  const isAssistantHome =
    Boolean(workspace) &&
    chatMessages.length === 1 &&
    !isSending;

  useEffect(() => {
    if (!workspace || !groupId) return;
    let active = true;

    async function heartbeat() {
      if (document.visibilityState !== "visible") return;
      const result = await heartbeatCommunityPresence(groupId);
      if (active && result.ok) setOnlineCount(result.onlineCount);
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") void heartbeat();
    }

    void heartbeat();
    const interval = window.setInterval(() => void heartbeat(), 30_000);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      active = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [groupId, workspace]);

  useEffect(() => {
    if (!displayName) return;
    setChatMessages((current) => current.map((message) => message.id === "welcome" ? {
      ...message,
      content: `平安！我是${displayName}的专属助手，只使用本群资料和权限。你可以问经文、查资料，或直接告诉我需要办理的群事务。`,
    } : message));
  }, [displayName]);

  useEffect(() => {
    if (tab !== "assistant") return;
    const frame = requestAnimationFrame(() => {
      const container = chatScrollRef.current;
      if (!container) return;
      container.scrollTo({
        top:
          chatMessages.length <= 1 && !isSending
            ? 0
            : container.scrollHeight,
        behavior: chatMessages.length <= 1 ? "auto" : "smooth",
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [tab, chatMessages, isSending]);

  function selectPrimaryTab(nextTab: TabId) {
    setTab(nextTab);
  }

  function askAboutResource(resource: WorkspaceResource) {
    setQuestion(`请根据本群资料《${resource.title}》回答：`);
    setTab("assistant");
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
    const resourceFile = pendingResourceFile;
    if (!displayId || (!prompt && !resourceFile) || isSending) return;
    speechInput.stopListening();
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: resourceFile
        ? `${usesPrivateConversationAttachments ? "发送附件" : "上传资料"}：${resourceFile.name}${prompt ? `\n${usesPrivateConversationAttachments ? "问题" : "说明"}：${prompt}` : ""}`
        : prompt,
      visibility,
    };
    const history = chatMessages.map(({ role, content }) => ({ role, content }));
    setChatMessages((current) => [...current, userMessage]);
    setQuestion("");
    setPendingResourceFile(null);
    setChatError("");
    setIsSending(true);
    if (resourceFile) {
      if (usesPrivateConversationAttachments) {
        const result = await askCommunityAssistantWithAttachment({
          groupId: groupId || displayId,
          message: prompt || "请阅读并总结这个附件。",
          history,
          visibility,
          file: resourceFile,
        });
        if (result.ok) {
          setChatMessages((current) => [...current, {
            id: `assistant-attachment-${Date.now()}`,
            role: "assistant",
            content: result.answer,
            operation: false,
          }]);
        } else {
          setChatMessages((current) => current.filter((message) => message.id !== userMessage.id));
          setPendingResourceFile(resourceFile);
          setQuestion(prompt);
          setChatError(result.message);
        }
        setIsSending(false);
        return;
      }
      return;
    }
    const result = await askCommunityAssistant({ groupId: groupId || displayId, message: prompt, history, visibility });
    if (result.ok) {
      setChatMessages((current) => [...current, {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: result.answer,
        action: result.action,
        result: result.result,
        operation: Boolean(
          result.action ||
          result.effect ||
          result.result ||
          isAssistantOperationPrompt(prompt),
        ),
      }]);
      if (result.effect?.type === "COMMUNITY_CREATED" && result.effect.community) upsertAssistantCommunity(result.effect.community);
    } else {
      setChatMessages((current) => current.filter((message) => message.id !== userMessage.id));
      setQuestion(prompt);
      setChatError(result.message);
    }
    setIsSending(false);
  }

  function handleResourceFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (!file) return;
    if (file.size > 50 * 1_024 * 1_024) {
      setChatError("单个文件不能超过 50 MB");
      return;
    }
    setPendingResourceFile(file);
    if (!usesPrivateConversationAttachments) {
      setUploadTitle(file.name.replace(/\.[^.]+$/, "") || file.name);
      setUploadDesc("");
      setUploadKnowledge(true);
      setUploadVisibility("MEMBERS");
      setShowUploadModal(true);
    }
  }

  const handleCancelUpload = () => {
    setPendingResourceFile(null);
    setShowUploadModal(false);
  };

  const handleRealUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingResourceFile || !displayId || isSending) return;
    setIsSending(true);
    setChatError("");
    
    const userMessage: ChatMessage = {
      id: `user-upload-${Date.now()}`,
      role: "user",
      content: `上传资料：《${uploadTitle}》${uploadDesc ? `\n说明：${uploadDesc}` : ""}`,
      visibility,
    };
    setChatMessages((current) => [...current, userMessage]);
    setShowUploadModal(false);

    const result = await uploadCommunityResource(groupId || displayId, {
      file: pendingResourceFile,
      title: uploadTitle.trim(),
      description: uploadDesc.trim() || undefined,
      knowledgeText: uploadKnowledge ? (uploadDesc.trim() || "群资料内容") : undefined,
      visibility: uploadVisibility,
    });

    if (result.ok) {
      setChatMessages((current) => [...current, {
        id: `assistant-upload-${Date.now()}`,
        role: "assistant",
        content: `资料《${uploadTitle}》上传成功，已加入${displayName}资料库${uploadKnowledge ? "并完成 AI 索引" : ""}。`,
        operation: true,
      }]);
      setPendingResourceFile(null);
      await loadWorkspace(false);
    } else {
      setChatMessages((current) => current.filter((message) => message.id !== userMessage.id));
      setChatError(result.message);
      setShowUploadModal(true);
    }
    setIsSending(false);
  };

  async function handleActionConfirm(messageId: string, action: AssistantAction) {
    if (!displayId || confirmingMessageId) return;
    setConfirmingMessageId(messageId);
    setChatError("");
    const result = await confirmCommunityAssistantAction({ groupId: groupId || displayId, confirmationToken: action.token });
    if (result.ok) {
      setChatMessages((current) => [
        ...current.map((message) => message.id === messageId ? { ...message, action: undefined } : message),
        {
          id: `assistant-result-${Date.now()}`,
          role: "assistant",
          content: result.answer,
          result: result.result,
          operation: true,
        },
      ]);
      if (result.effect?.type === "COMMUNITY_CREATED" && result.effect.community) upsertAssistantCommunity(result.effect.community);
      if (result.effect?.targetTab) selectPrimaryTab(result.effect.targetTab);
      await loadWorkspace(false);
    } else setChatError(result.message);
    setConfirmingMessageId("");
  }

  function handleActionCancel(messageId: string) {
    setChatMessages((current) => [
      ...current.map((message) => message.id === messageId ? { ...message, action: undefined } : message),
      { id: `assistant-cancel-${Date.now()}`, role: "assistant", content: "这次操作已经取消，没有修改任何资料。", operation: true },
    ]);
  }

  return (
    <div className={`screen community-group-screen${isOfficial ? " is-official" : ""}`}>
      <UnifiedHeader
        title={displayName}
        subtitle={workspaceLoading ? "读取中" : workspace ? `${onlineCount ?? 1} 在线` : "不可用"}
        ariaLabel={`${displayName}${isOfficial ? "公共社群" : "私有社群"}概览`}
        onBack={() => navigate("/community")}
        backLabel="返回社群列表"
        actions={workspace?.access.isAdmin ? (
          <button className="bible-toolbar-action" aria-label={isOfficial ? "平台管理" : "社群管理"} title={isOfficial ? "平台管理" : "社群管理"} onClick={() => navigate(`/community/${groupId}/settings`)}><Icon name="settings" size={20} /></button>
        ) : undefined}
      />

      {workspace && workspace.community.parentId && (
        <div style={{ background: "rgba(191,120,246,0.08)", padding: "10px 16px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--ink)", fontWeight: 600 }}>
            <span style={{ display: "flex", alignItems: "center", color: "var(--purple)" }}>
              <Icon name="users" size={14} />
            </span>
            <span>{workspace.access.isDirectMember ? "已加入该小组" : "目前通过主社群访问此小组"}</span>
          </div>
          <button
            type="button"
            disabled={workspaceBusy}
            onClick={() => {
              if (workspace.access.isDirectMember) {
                if (window.confirm("确定退出该小组吗？")) {
                  void runWorkspaceAction({ action: "LEAVE_SUBGROUP" });
                }
              } else {
                void runWorkspaceAction({ action: "JOIN_SUBGROUP" });
              }
            }}
            style={{
              padding: "4px 10px",
              background: workspace.access.isDirectMember ? "transparent" : "var(--purple)",
              color: workspace.access.isDirectMember ? "var(--pink)" : "var(--white)",
              border: workspace.access.isDirectMember ? "1px solid var(--line)" : 0,
              borderRadius: 8,
              fontSize: 11,
              fontWeight: 800,
              cursor: "pointer"
            }}
          >
            {workspace.access.isDirectMember ? "退出小组" : "加入小组"}
          </button>
        </div>
      )}

      <div className={`community-tabs${isOfficial ? " is-official" : workspace?.access.isAdmin ? " has-groups" : ""}`} role="tablist" aria-label="社群功能">
        {visibleTabs.map((item) => (
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
      {workspace && tab === "members" && <CommunityMembersPanel workspace={workspace} busy={workspaceBusy} runAction={runWorkspaceAction} />}
      {workspace && tab === "groups" && workspace.access.isAdmin && <CommunityGroupsPanel workspace={workspace} busy={workspaceBusy} runAction={runWorkspaceAction} />}
      {workspace && tab === "resources" && <CommunityResourcesPanel workspace={workspace} busy={workspaceBusy} runAction={runWorkspaceAction} onAskAssistant={askAboutResource} />}

      {tab === "assistant" && (
        <>
          <div ref={chatScrollRef} className="screen-scroll community-chat-scroll">
            {isAssistantHome ? (
              <section className={`community-assistant-home${isOfficial ? " is-official" : " is-community"}`} aria-labelledby="community-assistant-title">
                <span
                  className="community-assistant-home-mark"
                  style={isOfficial ? undefined : { background: workspace?.community.avatarColor }}
                >
                  {isOfficial
                    ? <Icon name="sparkle" size={22} />
                    : (workspace?.community.abbreviation ?? cachedGroup?.letter ?? "群").slice(0, 2)}
                </span>
                <h2 id="community-assistant-title">
                  {isOfficial ? "今天想一起做什么？" : `${displayName}助手`}
                  <span className="community-assistant-type">
                    {isOfficial ? "公共社群" : `私有社群 · ${workspaceRoleLabel(workspace?.access.role)}`}
                  </span>
                </h2>
                <p>{isOfficial ? "问经文、查总群资料，或用一句话办理社群事务。" : `问经文、查${displayName}资料，或用一句话办理群事务。`}</p>
                <div className="community-assistant-home-prompts" aria-label={`${displayName}助手推荐提示词`}>
                  {isOfficial ? (
                    <>
                      <button onClick={() => setQuestion("请解释这段经文的背景、重点和生活应用：")}>解释一段经文</button>
                      <button onClick={() => setQuestion("请根据慧读总群资料回答：")}>查询总群资料</button>
                      <button onClick={() => setQuestion("创建社群“”，简称“”，简介“”")}>创建我的社群</button>
                      <button onClick={() => setQuestion("管理我的社群")}>管理我的社群</button>
                      <button onClick={() => setQuestion("搜索适合我的社群：")}>查找可加入社群</button>
                      <button onClick={() => setQuestion("申请加入社群“”")}>申请加入社群</button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => setQuestion("发布动态，请把这段内容整理成适合群内发布的动态：")}>整理为群动态</button>
                      {workspace?.access.isAdmin
                        ? <button onClick={() => setQuestion("创建活动，标题“周五查经”，时间“YYYY-MM-DD 19:30”，地点“线上”，说明“”")}>创建查经活动</button>
                        : <button onClick={() => setQuestion(`请查看${displayName}近期有哪些活动。`)}>查看近期活动</button>}
                      {workspace?.access.isAdmin
                        ? <button onClick={() => setQuestion("邀请成员，请填写已注册邮箱：")}>邀请新成员</button>
                        : <button onClick={() => setQuestion("查找成员：")}>查找群内成员</button>}
                      <button onClick={() => setQuestion(`请根据${displayName}的群资料回答：`)}>查询本群资料</button>
                      {workspace?.access.canCreateGroups
                        ? <button onClick={() => setQuestion("新建小组，名称“青年查经组”，简称“青年”，简介“”")}>新建社群小组</button>
                        : <button onClick={() => setQuestion("请解释这段经文的背景、重点和生活应用：")}>解释一段经文</button>}
                      {workspace?.access.canManageResources
                        ? <button type="button" onClick={() => resourceFileInputRef.current?.click()}>上传群资料</button>
                        : <button onClick={() => setQuestion("请帮我提炼下面这段内容的重点：")}>提炼内容重点</button>}
                    </>
                  )}
                </div>
                <small>{isOfficial ? "公共内容由平台维护，管理操作会先确认权限" : "本群资料独立隔离，管理操作会先请你确认"}</small>
              </section>
            ) : (
              <>
            {chatMessages.filter((message) => message.id !== "welcome").map((message) => message.role === "user" ? (
              <div key={message.id} className="community-user-message-row">
                <div className="community-user-message">
                  <div>{message.content}</div>
                  <small><Icon name="eye" size={11} />仅自己可见</small>
                </div>
                <UserAvatar
                  name={sessionUser?.name ?? "我"}
                  avatarColor={sessionUser?.avatarColor ?? "var(--yellow)"}
                  avatarUrl={sessionUser?.avatarUrl ?? null}
                  size={30}
                />
              </div>
            ) : (
              <div key={message.id} className="card community-assistant-message">
                <div>{message.content}</div>
                {message.action && (
                  <div className="community-confirm-card">
                    <b>{message.action.title}</b><p>{message.action.summary}</p>
                    <div><button disabled={Boolean(confirmingMessageId)} onClick={() => handleActionCancel(message.id)} className="compact-action-btn">取消</button><button disabled={Boolean(confirmingMessageId)} onClick={() => handleActionConfirm(message.id, message.action!)} className="compact-action-btn is-primary">{confirmingMessageId === message.id ? "正在执行…" : message.action.confirmLabel}</button></div>
                  </div>
                )}
                {message.result?.kind === "MEMBER_LIST" && (
                  <div className="community-assistant-result">
                    <b>{message.result.title}</b>
                    <div>
                      {message.result.items.map((item) => (
                        <div key={item.id} className="community-member-result-row">
                          <span style={{ background: item.avatarColor }}>
                            {item.avatarUrl
                              ? <img src={item.avatarUrl} alt="" />
                              : item.name.slice(0, 1)}
                          </span>
                          <strong>{item.name}</strong>
                          <small>{item.role === "OWNER" ? "群主" : item.role === "ADMIN" ? "管理员" : "成员"}</small>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {message.result?.kind === "COMMUNITY_MANAGEMENT_LIST" && (
                  <div className="community-assistant-result community-management-result">
                    <b>{message.result.title}</b>
                    <div>
                      {message.result.items.map((item) => (
                        <button key={item.id} onClick={() => navigate(`/community/${item.id}/settings`)}>
                          <span style={{ background: item.avatarColor }}>{item.abbreviation}</span>
                          <div>
                            <strong>{item.name}</strong>
                            <small>{item.role === "OWNER" ? "群主" : "管理员"} · {item.memberCount} 人</small>
                          </div>
                          <Icon name="chevron-right" size={15} />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
            {isSending && <div className="card community-assistant-message">正在思考…</div>}
            <div className="disclaimer">重要社群操作需本人确认，并由后台再次校验权限</div>
              </>
            )}
          </div>
          <form onSubmit={handleAssistantSubmit} className="community-chat-composer">
            {chatError && <div role="alert">{chatError}</div>}
            {speechInput.error && <div role="alert">{speechInput.error}</div>}
            {speechInput.isListening && <div role="status" className="voice-listening-status">正在聆听…说完后再点一次麦克风</div>}
            <input ref={resourceFileInputRef} className="community-resource-file-input" type="file" aria-label="选择附件" onChange={handleResourceFileSelected} />
            {pendingResourceFile && (
              <div className="community-pending-upload">
                <span><b>{pendingResourceFile.name}</b><small>{readableFileSize(pendingResourceFile.size)} · {usesPrivateConversationAttachments ? "仅用于本次私人对话" : "待上传到本群知识库"}</small></span>
                <button type="button" onClick={() => setPendingResourceFile(null)}>移除</button>
              </div>
            )}
            <span className="community-chat-row">
              <span className="community-chat-field">
                {canAttachFiles && (
                  <button type="button" aria-label="添加附件" title="添加附件" disabled={isSending} className="icon-btn composer-icon-btn community-attachment-btn" onClick={() => resourceFileInputRef.current?.click()}>
                    <Icon name="paperclip" size={18} />
                  </button>
                )}
                <input value={question} onChange={(event) => { setQuestion(event.target.value); if (chatError) setChatError(""); if (speechInput.error) speechInput.clearError(); }} disabled={isSending || !workspace} maxLength={1200} aria-label="向社群助手提问" placeholder={speechInput.isListening ? "正在聆听…" : pendingResourceFile ? usesPrivateConversationAttachments ? "可补充问题，发送后分析附件…" : "可补充资料说明，发送后上传…" : `提问或办理${displayName}事务…`} />
                <VoiceInputButton isSupported={speechInput.isSupported} isListening={speechInput.isListening} disabled={isSending || !workspace} onClick={speechInput.toggleListening} />
              </span>
              <button type="submit" aria-label={pendingResourceFile ? usesPrivateConversationAttachments ? "发送附件" : "确认上传资料" : "发送问题"} disabled={isSending || !workspace || (!question.trim() && !pendingResourceFile)} className="icon-btn icon-btn-primary composer-icon-btn community-send-btn"><Icon name="send" size={18} /></button>
            </span>
          </form>
        </>
      )}
      {showUploadModal && pendingResourceFile && (
        <div className="community-publish-backdrop" onClick={handleCancelUpload} style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="community-action-sheet" role="dialog" aria-modal="true" aria-label="资料上传详情" onClick={(event) => event.stopPropagation()} style={{ maxWidth: 400, width: "95%", borderRadius: 18, padding: 22 }}>
            <div className="community-publish-sheet-header" style={{ marginBottom: 15 }}>
              <div><b>上传群资料</b><span>补充资料详细信息，使群成员及 AI 更易检索</span></div>
              <button type="button" aria-label="关闭" onClick={handleCancelUpload}><Icon name="x" size={19} /></button>
            </div>
            <form onSubmit={handleRealUpload} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, fontWeight: 700, color: "var(--body)" }}>
                资料标题 (最多 100 字)
                <input
                  required
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value.slice(0, 100))}
                  style={{ width: "100%", height: 40, padding: "0 12px", border: "1px solid var(--line)", borderRadius: 10, fontSize: 13, background: "var(--white)" }}
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, fontWeight: 700, color: "var(--body)" }}>
                资料简介 (说明)
                <textarea
                  value={uploadDesc}
                  onChange={(e) => setUploadDesc(e.target.value.slice(0, 500))}
                  rows={3}
                  placeholder="填写资料摘要、用途，有助于小组成员阅读"
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--line)", borderRadius: 10, fontSize: 13, background: "var(--white)", resize: "vertical", font: "inherit" }}
                />
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 700, color: "var(--body)", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={uploadKnowledge}
                  onChange={(e) => setUploadKnowledge(e.target.checked)}
                  style={{ width: 16, height: 16, cursor: "pointer" }}
                />
                同步至 AI 知识库 (允许助手引用此内容)
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, fontWeight: 700, color: "var(--body)" }}>
                可见范围
                <select
                  value={uploadVisibility}
                  onChange={(e) => setUploadVisibility(e.target.value as "MEMBERS" | "ADMINS")}
                  style={{ width: "100%", height: 40, padding: "0 10px", border: "1px solid var(--line)", borderRadius: 10, fontSize: 13, background: "var(--white)" }}
                >
                  <option value="MEMBERS">全体成员可见 (MEMBERS)</option>
                  <option value="ADMINS">仅管理员可见 (ADMINS)</option>
                </select>
              </label>

              <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                <button type="button" className="btn-secondary" onClick={handleCancelUpload} style={{ flex: 1, minHeight: 40, border: "1px solid var(--line)" }}>取消</button>
                <button type="submit" className="btn-primary" disabled={isSending} style={{ flex: 1, minHeight: 40 }}>
                  {isSending ? "正在上传..." : "确认上传"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
