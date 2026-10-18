import { type ChangeEvent, type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useAppBack } from "../hooks/useAppBack";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Icon } from "../components/Icon";
import { AiThinking } from "../components/AiThinking";
import { UnifiedHeader } from "../components/UnifiedHeader";
import { UserAvatar } from "../components/UserAvatar";
import { VoiceInputButton } from "../components/VoiceInputButton";
import {
  CommunityDegradedNotice,
  CommunityErrorState,
} from "../components/community/CommunityServiceState";
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
  type AssistantActionChanges,
  type AssistantRole,
  type AssistantStructuredResult,
  type AssistantVisibility,
} from "../data/assistant";
import {
  cacheCommunityWorkspace,
  fetchCommunityGroups,
  fetchCommunityJoinRequests,
  getGroup,
  requestCommunityJoin,
  reviewCommunityJoinRequest,
  upsertAssistantCommunity,
  type CommunityJoinRequest,
} from "../data/community";
import { resolveAvatarUrl } from "../data/api";
import {
  fetchCommunityServiceHealth,
  type CommunityServiceHealth,
} from "../data/community-health";
import {
  applyWorkspacePatch,
  fetchCommunityWorkspace,
  heartbeatCommunityPresence,
  performWorkspaceAction,
  uploadCommunityResource,
  type CommunityPreview,
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

type PendingAssistantAction = {
  groupId: string;
  action: AssistantAction;
  createdAt: string;
};

const PENDING_ACTIONS_KEY = "ob.community.pending-actions.v1";

function readPendingActions(groupId: string) {
  try {
    const value = JSON.parse(localStorage.getItem(PENDING_ACTIONS_KEY) ?? "[]") as PendingAssistantAction[];
    const now = Date.now();
    return value.filter((item) =>
      item.groupId === groupId &&
      (!item.action.expiresAt || Date.parse(item.action.expiresAt) > now),
    );
  } catch {
    return [];
  }
}

function writePendingActions(groupId: string, nextForGroup: PendingAssistantAction[]) {
  try {
    const current = JSON.parse(localStorage.getItem(PENDING_ACTIONS_KEY) ?? "[]") as PendingAssistantAction[];
    const now = Date.now();
    const otherGroups = current.filter((item) =>
      item.groupId !== groupId &&
      (!item.action.expiresAt || Date.parse(item.action.expiresAt) > now),
    );
    localStorage.setItem(PENDING_ACTIONS_KEY, JSON.stringify([...otherGroups, ...nextForGroup]));
  } catch {
    // A blocked local store should not prevent the confirmation flow.
  }
}

function AssistantDraftCard({
  action,
  busy,
  isOfficial,
  canUseAdminVisibility,
  onModify,
  onConfirm,
}: {
  action: AssistantAction;
  busy: boolean;
  isOfficial: boolean;
  canUseAdminVisibility: boolean;
  onModify: () => void;
  onConfirm: (changes?: AssistantActionChanges) => void;
}) {
  const originalTitle = action.fields?.find((field) => field.label === "标题")?.value ?? "";
  const initialTitle = originalTitle === "未设置标题" ? "" : originalTitle;
  const initialVisibility: NonNullable<AssistantActionChanges["visibility"]> = isOfficial
    ? "PUBLIC"
    : action.fields?.find((field) => field.label === "可见范围")?.value === "仅管理员"
      ? "ADMINS"
      : "MEMBERS";
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(initialTitle);
  const [draftVisibility, setDraftVisibility] = useState(initialVisibility);
  const [savedTitle, setSavedTitle] = useState(initialTitle);
  const [savedVisibility, setSavedVisibility] = useState(initialVisibility);
  const isPublishDraft = action.kind === "PUBLISH_CONTENT";

  function beginModify() {
    if (!isPublishDraft) {
      onModify();
      return;
    }
    setDraftTitle(savedTitle);
    setDraftVisibility(savedVisibility);
    setEditing(true);
  }

  function cancelModify() {
    setDraftTitle(savedTitle);
    setDraftVisibility(savedVisibility);
    setEditing(false);
  }

  function saveModify() {
    setSavedTitle(draftTitle.trim());
    setSavedVisibility(draftVisibility);
    setEditing(false);
  }

  function displayFieldValue(label: string, value: string) {
    if (label === "标题") return savedTitle || "未设置标题";
    if (label === "可见范围") {
      return savedVisibility === "PUBLIC" ? "所有人可见" : savedVisibility === "ADMINS" ? "仅管理员" : "本群成员";
    }
    return value;
  }

  return (
    <div className="community-confirm-card">
      <span className="community-confirm-kicker">预览草稿</span>
      <b>{action.title}</b>
      {action.fields?.length ? (
        <dl>
          {action.fields.map((field, index) => (
            <div key={`${field.label}-${index}`}>
              <dt>{field.label}</dt>
              <dd>
                {editing && isPublishDraft && field.label === "标题" ? (
                  <input
                    className="community-confirm-field"
                    value={draftTitle}
                    maxLength={120}
                    placeholder="输入标题（普通动态可留空）"
                    onChange={(event) => setDraftTitle(event.target.value)}
                  />
                ) : editing && isPublishDraft && field.label === "可见范围" ? (
                  <select
                    className="community-confirm-field"
                    value={draftVisibility}
                    onChange={(event) => setDraftVisibility(event.target.value as NonNullable<AssistantActionChanges["visibility"]>)}
                  >
                    {isOfficial ? (
                      <option value="PUBLIC">所有人可见</option>
                    ) : (
                      <>
                        <option value="MEMBERS">本群成员</option>
                        {canUseAdminVisibility && <option value="ADMINS">仅管理员</option>}
                      </>
                    )}
                  </select>
                ) : displayFieldValue(field.label, field.value)}
              </dd>
            </div>
          ))}
        </dl>
      ) : <p>{action.summary}</p>}
      <div className="community-confirm-actions">
        {editing ? (
          <>
            <button disabled={busy} onClick={cancelModify} className="compact-action-btn">取消</button>
            <button disabled={busy} onClick={saveModify} className="compact-action-btn is-primary">保存修改</button>
          </>
        ) : (
          <>
            <button disabled={busy} onClick={beginModify} className="compact-action-btn">修改</button>
            <button
              disabled={busy}
              onClick={() => onConfirm(isPublishDraft ? { title: savedTitle, visibility: savedVisibility } : undefined)}
              className="compact-action-btn is-primary"
            >{busy ? "正在执行…" : action.confirmLabel}</button>
          </>
        )}
      </div>
    </div>
  );
}

function isAssistantOperationPrompt(value: string) {
  return /^(?:请(?:帮我)?|帮我)?(?:发布|发表|发一条|发个|创建|新建|安排|管理|进入|前往|查找|搜索|寻找|找一下|查看|列出|申请加入|邀请|移除|设置|审核|批准|拒绝|报名)/u.test(
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

function workspaceRoleLabel(role?: "OWNER" | "ADMIN" | "MEMBER" | "GUEST") {
  return role === "OWNER" ? "群主" : role === "ADMIN" ? "管理员" : role === "GUEST" ? "游客" : "成员";
}

export function GroupPage() {
  const sessionUser = useSessionUser();
  const { groupId = "" } = useParams();
  const navigate = useNavigate();
  const goBack = useAppBack("/community");
  const [searchParams, setSearchParams] = useSearchParams();
  const cachedGroup = getGroup(groupId);
  const requestedTab = searchParams.get("tab");
  const [tab, setTab] = useState<TabId>(() => tabFromParam(requestedTab));
  const [workspace, setWorkspace] = useState<CommunityWorkspace | null>(null);
  const [workspaceLoading, setWorkspaceLoading] = useState(true);
  const [workspaceError, setWorkspaceError] = useState("");
  const [workspaceErrorStatus, setWorkspaceErrorStatus] = useState<number | null>(null);
  const [preview, setPreview] = useState<CommunityPreview | null>(null);
  const [joinRequests, setJoinRequests] = useState<CommunityJoinRequest[]>([]);
  const [joinRequestsLoading, setJoinRequestsLoading] = useState(true);
  const [canCreateCommunity, setCanCreateCommunity] = useState(false);
  const [joining, setJoining] = useState(false);
  const [joinMessage, setJoinMessage] = useState("");
  const [workspaceIsStale, setWorkspaceIsStale] = useState(false);
  const [workspaceMessage, setWorkspaceMessage] = useState("");
  const [workspaceBusy, setWorkspaceBusy] = useState(false);
  const [serviceHealth, setServiceHealth] = useState<CommunityServiceHealth | null>(null);
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
  const [pendingActions, setPendingActions] = useState<PendingAssistantAction[]>([]);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const resourceFileInputRef = useRef<HTMLInputElement>(null);
  const speechInput = useSpeechInput({
    value: question,
    onChange: setQuestion,
    disabled: isSending || !workspace || workspaceIsStale,
  });

  // 只有切换社群才重置会话；切换栏目会改写 URL，不能连带清空助手对话。
  useEffect(() => {
    setWorkspace(null);
    setWorkspaceIsStale(false);
    setWorkspaceErrorStatus(null);
    setPreview(null);
    setJoinMessage("");
    setOnlineCount(null);
    setQuestion("");
    setChatError("");
    setPendingResourceFile(null);
    setPendingActions(readPendingActions(groupId));
    setChatMessages([
      {
        id: "welcome",
        role: "assistant",
        content: assistantWelcomeMessage(groupId, getGroup(groupId)?.name),
      },
    ]);
  }, [groupId]);

  useEffect(() => {
    setTab(tabFromParam(requestedTab));
  }, [requestedTab]);

  function updatePendingActions(
    updater: (current: PendingAssistantAction[]) => PendingAssistantAction[],
  ) {
    setPendingActions((current) => {
      const next = updater(current);
      writePendingActions(groupId, next);
      return next;
    });
  }

  const loadWorkspace = useCallback(async (showLoading = true) => {
    if (!groupId) return;
    if (showLoading) setWorkspaceLoading(true);
    setWorkspaceError("");
    setWorkspaceErrorStatus(null);
    const result = await fetchCommunityWorkspace(groupId, { allowStale: true });
    if (result.ok) {
      setWorkspace(result.workspace);
      setWorkspaceIsStale(result.stale === true);
      if (result.stale) {
        setWorkspaceError(
          result.warning ?? "服务暂时不可用，正在显示上次加载的社群内容",
        );
      }
      if (groupId !== "official" && result.workspace.access.role !== "GUEST") {
        cacheCommunityWorkspace({
          community: result.workspace.community,
          role: result.workspace.access.role,
          memberCount: result.workspace.usage.members,
          groups: result.workspace.groups,
        });
      }
    }
    else {
      setWorkspaceIsStale(false);
      setWorkspaceError(result.message);
      setWorkspaceErrorStatus(result.status ?? null);
      setPreview(result.preview ?? null);
    }
    setWorkspaceLoading(false);
  }, [groupId]);

  async function submitJoinRequest() {
    if (!preview || joining) return;
    setJoining(true);
    setJoinMessage("");
    const result = await requestCommunityJoin(preview.id);
    if (result.status === 401) {
      navigate("/me/login");
      setJoining(false);
      return;
    }
    setJoinMessage(result.message);
    if (result.ok) {
      if (result.state === "JOINED") await loadWorkspace();
      else setPreview({ ...preview, joinRequestPending: true });
    }
    setJoining(false);
  }

  const loadServiceHealth = useCallback(async () => {
    const result = await fetchCommunityServiceHealth();
    setServiceHealth(result.health);
  }, []);

  const loadJoinRequests = useCallback(async () => {
    if (!groupId) return;
    setJoinRequestsLoading(true);
    const result = await fetchCommunityJoinRequests(groupId);
    setJoinRequests(result.ok ? result.requests : []);
    setJoinRequestsLoading(false);
  }, [groupId]);

  async function reviewJoinRequest(requestId: string, decision: "APPROVE" | "REJECT") {
    if (!groupId) return false;
    setWorkspaceError("");
    setWorkspaceMessage("");
    const result = await reviewCommunityJoinRequest(groupId, requestId, decision);
    if (result.ok) {
      setJoinRequests((current) => current.filter((item) => item.id !== requestId));
      setWorkspaceMessage(result.message);
      if (decision === "APPROVE") await loadWorkspace(false);
    } else {
      setWorkspaceError(result.message);
    }
    return result.ok;
  }

  useEffect(() => {
    let active = true;
    void fetchCommunityGroups().then((result) => {
      if (active && result.ok) setCanCreateCommunity(result.canCreateCommunity);
    });
    if (active) {
      void loadWorkspace();
      void loadServiceHealth();
    }
    return () => { active = false; };
  }, [loadServiceHealth, loadWorkspace]);

  // 只有能管理成员的身份才需要加入申请列表。
  useEffect(() => {
    if (!workspace?.access.canManageMembers) {
      setJoinRequests([]);
      setJoinRequestsLoading(false);
      return;
    }
    void loadJoinRequests();
  }, [workspace?.access.canManageMembers, loadJoinRequests]);

  const displayName = workspace?.community.name ?? preview?.name ?? cachedGroup?.name ?? "社群";
  const subtitle = workspaceLoading
    ? "读取中"
    : workspace
      // 首次心跳返回前不谎报在线人数。
      ? onlineCount === null
        ? `${workspace.usage.members} 成员`
        : `${onlineCount} 在线`
      : preview
        ? "未加入"
        : "不可用";
  const displayId = workspace?.community.id ?? cachedGroup?.id ?? groupId;
  const isOfficial =
    groupId === "official" ||
    workspace?.community.isOfficial === true ||
    workspace?.community.tier === "OFFICIAL_FREE" ||
    cachedGroup?.badgeStyle === "official";
  const usesPrivateConversationAttachments = isOfficial && !workspace?.access.canManageResources;
  const aiUnavailable =
    serviceHealth?.services.ai.state === "unavailable" ||
    serviceHealth?.services.ai.state === "unconfigured";
  const uploadUnavailable = serviceHealth?.services.upload.state === "unavailable";
  const canAttachFiles = Boolean(
    (workspace?.access.canManageResources || isOfficial) &&
      !uploadUnavailable &&
      !workspaceIsStale,
  );
  const visibleTabs = isOfficial
    ? TABS.filter((item) => item.id === "assistant" || item.id === "feed" || item.id === "events")
    : TABS.filter((item) => item.id !== "groups" || Boolean(workspace?.access.isAdmin));
  const visibleTabIds = visibleTabs.map((item) => item.id).join(",");
  const isAssistantHome =
    Boolean(workspace) &&
    chatMessages.length === 1 &&
    !isSending;

  // 深链或降级后落在一个当前身份看不到的栏目时，回到助手而不是空白页。
  useEffect(() => {
    if (!workspace || visibleTabIds.split(",").includes(tab)) return;
    setTab("assistant");
  }, [workspace, visibleTabIds, tab]);

  useEffect(() => {
    if (!workspace || !groupId || workspace.access.role === "GUEST") return;
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

  // 栏目状态写回 URL，返回键可以退回上一个栏目，刷新也停在原处。
  function selectPrimaryTab(nextTab: TabId) {
    if (nextTab === tab) return;
    setTab(nextTab);
    // 用函数式更新，连续切换栏目时不会读到上一次渲染的旧参数。
    setSearchParams((current) => {
      const nextParams = new URLSearchParams(current);
      nextParams.set("tab", nextTab);
      return nextParams;
    });
  }

  function askAboutResource(resource: WorkspaceResource) {
    setQuestion(`请根据本群资料《${resource.title}》回答：`);
    setTab("assistant");
  }

  async function runWorkspaceAction(input: WorkspaceActionInput) {
    if (!groupId || workspaceBusy) return false;
    if (workspace?.access.role === "GUEST") {
      navigate("/me/login");
      return false;
    }
    if (workspaceIsStale) {
      setWorkspaceError("服务恢复后才能修改社群内容，请先重试");
      return false;
    }
    setWorkspaceBusy(true);
    setWorkspaceError("");
    setWorkspaceMessage("");
    const result = await performWorkspaceAction(groupId, input);
    if (result.ok) {
      setWorkspaceMessage(result.message);
      // 点赞、收藏、评论、报名只回传增量，直接改本地状态。
      if (result.patch) {
        const patch = result.patch;
        setWorkspace((current) => current ? applyWorkspacePatch(current, patch) : current);
      }
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
    if (!displayId || (!prompt && !resourceFile) || isSending || workspaceIsStale) return;
    if (workspace?.access.role === "GUEST") {
      navigate("/me/login");
      return;
    }
    if (aiUnavailable && !resourceFile && !isAssistantOperationPrompt(prompt)) {
      setChatError("AI 开放式问答暂时不可用；创建活动、查找成员等社群事务仍可使用。");
      return;
    }
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
      const result = await uploadCommunityResource(groupId || displayId, {
        file: resourceFile,
        title: resourceFile.name.replace(/\.[^.]+$/, "") || resourceFile.name,
        description: prompt || undefined,
        knowledgeText: prompt || undefined,
        visibility: "MEMBERS",
      });
      if (result.ok) {
        setChatMessages((current) => [...current, {
          id: `assistant-upload-${Date.now()}`,
          role: "assistant",
          content: `${result.message} 已保存到${displayName}资料库，并加入本群知识库。`,
          operation: true,
        }]);
        await loadWorkspace(false);
      } else {
        setChatMessages((current) => current.filter((message) => message.id !== userMessage.id));
        setPendingResourceFile(resourceFile);
        setQuestion(prompt);
        setChatError(result.message);
      }
      setIsSending(false);
      return;
    }
    const result = await askCommunityAssistant({ groupId: groupId || displayId, message: prompt, history, visibility });
    if (result.ok) {
      if (result.action) {
        updatePendingActions((current) => [
          ...current.filter((item) => item.action.token !== result.action!.token),
          { groupId, action: result.action!, createdAt: new Date().toISOString() },
        ]);
      }
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
    if (uploadUnavailable) {
      setChatError("文件上传暂时不可用，请稍后重试");
      return;
    }
    if (file.size > 50 * 1_024 * 1_024) {
      setChatError("单个文件不能超过 50 MB");
      return;
    }
    setPendingResourceFile(file);
    setChatError("");
    setTab("assistant");
  }

  // 资料栏目直接上传文件，与助手里的上传走同一个接口。
  async function uploadResourceFile(input: {
    file: File;
    title: string;
    description?: string;
    visibility: "MEMBERS" | "ADMINS";
  }) {
    if (!groupId || workspaceBusy) return false;
    if (input.file.size > 50 * 1_024 * 1_024) {
      setWorkspaceError("单个文件不能超过 50 MB");
      return false;
    }
    setWorkspaceBusy(true);
    setWorkspaceError("");
    setWorkspaceMessage("");
    const result = await uploadCommunityResource(groupId, {
      ...input,
      knowledgeText: input.description,
    });
    if (result.ok) {
      setWorkspaceMessage(result.message);
      await loadWorkspace(false);
    } else {
      setWorkspaceError(result.message);
    }
    setWorkspaceBusy(false);
    return result.ok;
  }

  async function handleActionConfirm(messageId: string, action: AssistantAction, changes?: AssistantActionChanges) {
    if (!displayId || confirmingMessageId) return;
    setConfirmingMessageId(messageId);
    setChatError("");
    const result = await confirmCommunityAssistantAction({
      groupId: groupId || displayId,
      confirmationToken: action.token,
      actionChanges: changes,
    });
    if (result.ok) {
      updatePendingActions((current) => current.filter((item) => item.action.token !== action.token));
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
      if (
        result.effect?.type === "GROUP_CREATED" &&
        result.effect.group &&
        result.effect.communityId === displayId
      ) {
        const createdGroup = result.effect.group;
        setWorkspace((current) => {
          if (!current || current.community.id !== result.effect?.communityId) return current;
          const groups = [
            ...current.groups.filter((group) => group.id !== createdGroup.id),
            createdGroup,
          ];
          return {
            ...current,
            groups,
            usage: { ...current.usage, groups: groups.length },
          };
        });
      }
    } else {
      if ([400, 403, 409].includes(result.status ?? 0)) {
        updatePendingActions((current) =>
          current.filter((item) => item.action.token !== action.token),
        );
        setChatMessages((current) =>
          current.map((message) =>
            message.id === messageId ? { ...message, action: undefined } : message,
          ),
        );
      }
      setChatError(result.message);
    }
    setConfirmingMessageId("");
  }

  function handleActionModify(messageId: string, action: AssistantAction) {
    updatePendingActions((current) => current.filter((item) => item.action.token !== action.token));
    setQuestion(`请修改这项草稿：${action.title}。需要调整：`);
    setChatMessages((current) => [
      ...current.map((message) => message.id === messageId ? { ...message, action: undefined } : message),
      { id: `assistant-modify-${Date.now()}`, role: "assistant", content: "请在输入框中说明需要修改的内容，我会重新生成草稿。", operation: true },
    ]);
  }

  const messageActionTokens = new Set(
    chatMessages.flatMap((message) => message.action ? [message.action.token] : []),
  );
  const detachedPendingActions = pendingActions.filter(
    (item) => !messageActionTokens.has(item.action.token),
  );

  return (
    <div className={`screen community-group-screen${isOfficial ? " is-official" : ""}`}>
      <UnifiedHeader
        title={displayName}
        subtitle={subtitle}
        ariaLabel={`${displayName}${isOfficial ? "公共社群" : "私有社群"}概览`}
        onBack={goBack}
        backLabel="返回社群列表"
        actions={workspace?.access.isAdmin ? (
          <button data-icon-button="default" className="bible-toolbar-action" aria-label={isOfficial ? "平台管理" : "社群管理"} title={isOfficial ? "平台管理" : "社群管理"} onClick={() => navigate(`/community/${groupId}/settings`)}><Icon name="settings" size={20} /></button>
        ) : undefined}
      />

      {/* 没有工作台数据时不展示空栏目，避免点进去只有空白。 */}
      {(workspace || workspaceLoading) && (
        <div className={`community-tabs${isOfficial ? " is-official" : workspace?.access.isAdmin ? " has-groups" : ""}`} role="tablist" aria-label="社群功能">
          {visibleTabs.map((item) => (
            <button key={item.id} role="tab" aria-selected={tab === item.id} onClick={() => selectPrimaryTab(item.id)} className={tab === item.id ? "active" : ""}>{item.label}</button>
          ))}
        </div>
      )}

      {preview && !workspace && (
        <section className="community-join-preview" aria-label={`${preview.name}社群介绍`}>
          <span className="community-join-preview-mark" style={{ background: preview.avatarColor }}>
            {preview.abbreviation}
          </span>
          <h2>{preview.name}</h2>
          <p>{preview.description || "这个社群还没有填写简介。"}</p>
          <div className="community-join-preview-meta">
            <span>{preview.memberCount} 位成员</span>
            <span>{preview.joinPolicy === "OPEN" ? "无需审核" : "管理员审核"}</span>
          </div>
          {joinMessage && <div className="community-feedback" role="status">{joinMessage}</div>}
          <button
            type="button"
            className="btn-primary"
            disabled={joining || preview.joinRequestPending}
            onClick={() => void submitJoinRequest()}
          >
            {preview.joinRequestPending
              ? "申请已提交，等待管理员审核"
              : joining
                ? "处理中…"
                : preview.joinPolicy === "OPEN"
                  ? "加入社群"
                  : "申请加入"}
          </button>
          <small>加入后才能查看动态、活动、成员与群资料。</small>
        </section>
      )}

      {workspaceError && !workspace && !preview && (
        <CommunityErrorState
          title={
            workspaceErrorStatus === 401
              ? "请先登录"
              : workspaceErrorStatus === 403
                ? "无法访问社群"
                : workspaceErrorStatus === 404
                  ? "社群不存在"
                  : undefined
          }
          message={workspaceError}
          status={workspaceErrorStatus}
          health={serviceHealth}
          onRetry={() => {
            void loadWorkspace();
            void loadServiceHealth();
          }}
          onBack={goBack}
        />
      )}

      {workspaceError && workspace && (
        <CommunityDegradedNotice
          health={serviceHealth}
          onRetry={() => {
            void loadWorkspace(false);
            void loadServiceHealth();
          }}
          onBack={goBack}
        >
          {workspaceError}
        </CommunityDegradedNotice>
      )}

      {workspaceMessage && (
        <div className="community-feedback" role="status">{workspaceMessage}</div>
      )}

      {workspaceLoading && !workspace && <div className="route-status"><Icon name="users" size={20} /><b>正在读取社群</b><span>同步成员权限和栏目内容…</span></div>}

      {workspace && tab === "feed" && <CommunitySharePanel workspace={workspace} busy={workspaceBusy || workspaceIsStale} runAction={runWorkspaceAction} />}
      {workspace && tab === "events" && <CommunityEventsPanel workspace={workspace} busy={workspaceBusy || workspaceIsStale} runAction={runWorkspaceAction} />}
      {workspace && tab === "members" && (
        <CommunityMembersPanel
          workspace={workspace}
          busy={workspaceBusy || workspaceIsStale}
          runAction={runWorkspaceAction}
          joinRequests={joinRequests}
          joinRequestsLoading={joinRequestsLoading}
          onReviewJoinRequest={reviewJoinRequest}
        />
      )}
      {workspace && tab === "groups" && workspace.access.isAdmin && <CommunityGroupsPanel workspace={workspace} busy={workspaceBusy || workspaceIsStale} runAction={runWorkspaceAction} />}
      {workspace && tab === "resources" && <CommunityResourcesPanel workspace={workspace} busy={workspaceBusy || workspaceIsStale} runAction={runWorkspaceAction} onAskAssistant={askAboutResource} onUploadFile={uploadResourceFile} />}

      {tab === "assistant" && workspace && (
        <>
          <div ref={chatScrollRef} className="screen-scroll community-chat-scroll">
            {detachedPendingActions.length > 0 && (
              <section className="community-pending-actions" aria-label="待确认事项">
                <header><b>待确认事项</b><span>{detachedPendingActions.length}</span></header>
                {detachedPendingActions.map((item) => (
                  <AssistantDraftCard
                    key={item.action.token}
                    action={item.action}
                    busy={confirmingMessageId === item.action.token}
                    isOfficial={isOfficial}
                    canUseAdminVisibility={Boolean(workspace?.access.isAdmin)}
                    onModify={() => {
                      updatePendingActions((current) => current.filter((entry) => entry.action.token !== item.action.token));
                      setQuestion(`请修改这项草稿：${item.action.title}。需要调整：`);
                    }}
                    onConfirm={(changes) => void handleActionConfirm(item.action.token, item.action, changes)}
                  />
                ))}
              </section>
            )}
            {isAssistantHome ? (
              <section className={`community-assistant-home${isOfficial ? " is-official" : " is-community"}`} aria-labelledby="community-assistant-title">
                <span
                  className="community-assistant-home-mark"
                  style={isOfficial ? undefined : { background: workspace?.community.avatarColor }}
                >
                  {isOfficial
                    ? <Icon name="sparkle" size={20} />
                    : (workspace?.community.abbreviation ?? cachedGroup?.letter ?? "群").slice(0, 2)}
                </span>
                <h2 id="community-assistant-title">
                  {isOfficial ? "今天想一起做什么？" : `${displayName}助手`}
                  <span className="community-assistant-type">
                    {isOfficial ? workspace.access.role === "GUEST" ? "公共社群 · 游客浏览" : "公共社群" : `私有社群 · ${workspaceRoleLabel(workspace?.access.role)}`}
                  </span>
                </h2>
                <p>{isOfficial ? "问经文、查总群资料，或用一句话办理社群事务。" : `问经文、查${displayName}资料，或用一句话办理群事务。`}</p>
                <div className="community-assistant-home-prompts" aria-label={`${displayName}助手推荐提示词`}>
                  {isOfficial ? (
                    <>
                      <button onClick={() => setQuestion("请解释这段经文的背景、重点和生活应用：")}>解释一段经文</button>
                      <button onClick={() => setQuestion("请根据慧读总群资料回答：")}>查询总群资料</button>
                      {canCreateCommunity && <button onClick={() => setQuestion("创建社群“”，简称“”，简介“”")}>创建我的社群</button>}
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
                <small>{isOfficial ? workspace.access.role === "GUEST" ? "动态和活动可直接浏览，互动与提问需要登录" : "公共内容由平台维护，管理操作会先确认权限" : "本群资料独立隔离，管理操作会先请你确认"}</small>
              </section>
            ) : (
              <>
            {chatMessages.filter((message) => message.id !== "welcome").map((message) => message.role === "user" ? (
              <div key={message.id} className="community-user-message-row">
                <div className="community-user-message">
                  <div>{message.content}</div>
                  <small><Icon name="eye" size={12} />仅自己可见</small>
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
                  <AssistantDraftCard
                    action={message.action}
                    busy={confirmingMessageId === message.id}
                    isOfficial={isOfficial}
                    canUseAdminVisibility={Boolean(workspace?.access.isAdmin)}
                    onModify={() => handleActionModify(message.id, message.action!)}
                    onConfirm={(changes) => void handleActionConfirm(message.id, message.action!, changes)}
                  />
                )}
                {message.result?.kind === "MEMBER_LIST" && (
                  <div className="community-assistant-result">
                    <b>{message.result.title}</b>
                    <div>
                      {message.result.items.map((item) => (
                        <div key={item.id} className="community-member-result-row">
                          <span style={{ background: item.avatarColor }}>
                            {item.avatarUrl
                              ? <img src={resolveAvatarUrl(item.avatarUrl) ?? ""} alt="" />
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
                          <Icon name="chevron-right" size={16} />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
            {isSending && <div className="card community-assistant-message"><AiThinking /></div>}
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
                  <button data-icon-button="default" type="button" aria-label="添加附件" title="添加附件" disabled={isSending} className="icon-btn composer-icon-btn community-attachment-btn" onClick={() => resourceFileInputRef.current?.click()}>
                    <Icon name="paperclip" size={20} />
                  </button>
                )}
                <input value={question} onChange={(event) => { setQuestion(event.target.value); if (chatError) setChatError(""); if (speechInput.error) speechInput.clearError(); }} disabled={isSending || !workspace || workspaceIsStale} maxLength={1200} aria-label="向社群助手提问" placeholder={workspaceIsStale ? "服务恢复后可继续使用助手" : speechInput.isListening ? "正在聆听…" : pendingResourceFile ? usesPrivateConversationAttachments ? "可补充问题，发送后分析附件…" : "可补充资料说明，发送后上传…" : `提问或办理${displayName}事务…`} />
                <VoiceInputButton isSupported={speechInput.isSupported} isListening={speechInput.isListening} disabled={isSending || !workspace || workspaceIsStale} onClick={speechInput.toggleListening} />
                {/* 与慧读输入栏同构：发送键收进框内，圆形上箭头 */}
                <button data-icon-button="primary" type="submit" aria-label={pendingResourceFile ? usesPrivateConversationAttachments ? "发送附件" : "确认上传资料" : "发送问题"} disabled={isSending || !workspace || workspaceIsStale || (!question.trim() && !pendingResourceFile)} className="huidu-send-btn"><Icon name="arrow-up" size={17} /></button>
              </span>
            </span>
          </form>
        </>
      )}
    </div>
  );
}
