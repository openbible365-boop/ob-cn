import { apiFormRequest, apiRequest } from "./api";

const COMMUNITY_WORKSPACE_CACHE_KEY = "ob.community-workspace-session-cache";

export type WorkspaceRole = "OWNER" | "ADMIN" | "MEMBER" | "GUEST";
export type WorkspacePostType = "POST" | "ARTICLE" | "NOTICE" | "MEDIA";
export type WorkspacePostMediaType = "IMAGE" | "AUDIO" | "VIDEO";
export type WorkspacePostVisibility = "PUBLIC" | "MEMBERS" | "ADMINS";

export type WorkspacePost = {
  id: string;
  postType: WorkspacePostType;
  title: string | null;
  content: string;
  verseRef: string | null;
  mediaType: WorkspacePostMediaType | null;
  mediaUrl: string | null;
  visibility: WorkspacePostVisibility;
  pinnedAt: string | null;
  likeCount: number;
  commentCount: number;
  createdAt: string;
  likedByMe: boolean;
  bookmarkedByMe: boolean;
  author: {
    id: string;
    name: string;
    avatarColor: string;
    avatarUrl: string | null;
  };
  comments: Array<{
    id: string;
    content: string;
    createdAt: string;
    author: { id: string; name: string };
  }>;
};

export type WorkspaceEvent = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  startAt: string;
  endAt: string | null;
  createdAt: string;
  capacity: number | null;
  signupCount: number;
  state: "UPCOMING" | "ACTIVE" | "ENDED";
  signedUpByMe: boolean;
};

export type WorkspaceMember = {
  role: Exclude<WorkspaceRole, "GUEST">;
  joinedAt: string;
  user: {
    id: string;
    name: string;
    email: string | null;
    avatarColor: string;
    avatarUrl: string | null;
    status: "ACTIVE" | "MUTED" | "BANNED";
  };
};

export type WorkspaceGroup = {
  id: string;
  name: string;
  abbreviation: string;
  description: string | null;
  avatarColor: string;
  memberCount: number;
};

export type WorkspaceResource = {
  id: string;
  title: string;
  description: string | null;
  type: "LINK" | "DOCUMENT" | "AUDIO" | "VIDEO" | "IMAGE" | "TEXT" | "OTHER";
  url: string | null;
  contentText: string | null;
  fileName: string | null;
  mimeType: string | null;
  fileSize: number | null;
  indexedAt: string | null;
  knowledgeStatus: "PARSING" | "INDEXED" | "FAILED" | "REINDEX_REQUIRED";
  indexError: string | null;
  visibility: "MEMBERS" | "ADMINS";
  createdAt: string;
  uploader: { id: string; name: string };
};

export type CommunityWorkspace = {
  community: {
    id: string;
    name: string;
    abbreviation: string;
    description: string | null;
    avatarColor: string;
    tier: "OFFICIAL_FREE" | "BASIC_FREE" | "MID" | "HIGH";
    isOfficial: boolean;
    kind: "PUBLIC" | "PRIVATE";
    joinPolicy: "OPEN" | "APPROVAL" | "INVITE_ONLY";
  };
  access: {
    role: WorkspaceRole;
    isAdmin: boolean;
    isOwner: boolean;
    canPublish: boolean;
    canManageMembers: boolean;
    canManageRoles: boolean;
    canCreateGroups: boolean;
    canManageResources: boolean;
  };
  entitlements: {
    label: string;
    priceMonthlyCents: number;
    memberLimit: number | null;
    groupLimit: number | null;
    resourceLimit: number | null;
    aiDailyTokenLimit: number | null;
  };
  usage: { members: number; groups: number; resources: number };
  posts: WorkspacePost[];
  /** 还有更多动态时为下一页游标，已到底为 null。 */
  postsNextCursor?: string | null;
  events: WorkspaceEvent[];
  members: WorkspaceMember[];
  groups: WorkspaceGroup[];
  resources: WorkspaceResource[];
};

// 非成员访问公开可发现的社群时，后端在 403 里附带这份公开信息，
// 让社群页可以显示「预览 + 申请加入」而不是一个死胡同。
export type CommunityPreview = {
  id: string;
  name: string;
  abbreviation: string;
  description: string | null;
  avatarColor: string;
  joinPolicy: CommunityWorkspace["community"]["joinPolicy"];
  memberCount: number;
  joinRequestPending: boolean;
};

type WorkspaceResponse = {
  ok: boolean;
  message?: string;
  preview?: CommunityPreview;
} & Partial<CommunityWorkspace>;

type CommunityWorkspaceCache = Record<
  string,
  { workspace: CommunityWorkspace; loadedAt: string }
>;

function readWorkspaceCache(): CommunityWorkspaceCache {
  try {
    const raw = sessionStorage.getItem(COMMUNITY_WORKSPACE_CACHE_KEY);
    if (!raw) return {};
    const value = JSON.parse(raw) as CommunityWorkspaceCache;
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}

function saveWorkspaceCache(
  communityId: string,
  workspace: CommunityWorkspace,
) {
  try {
    sessionStorage.setItem(
      COMMUNITY_WORKSPACE_CACHE_KEY,
      JSON.stringify({
        ...readWorkspaceCache(),
        [communityId]: { workspace, loadedAt: new Date().toISOString() },
      } satisfies CommunityWorkspaceCache),
    );
  } catch {
    // Cache failure must never block the live workspace.
  }
}

function getCachedWorkspace(communityId: string) {
  const cached = readWorkspaceCache()[communityId];
  if (!cached?.workspace?.community || !cached.workspace.access) return null;
  return cached;
}

export function clearCommunityWorkspaceCache() {
  try {
    sessionStorage.removeItem(COMMUNITY_WORKSPACE_CACHE_KEY);
  } catch {
    // Ignore storage restrictions during logout.
  }
}

function workspaceFailureMessage(status: number, fallback?: string) {
  if (status === 401) return "请先登录后再进入社群";
  if (status === 403) return "当前账号没有访问这个社群的权限";
  if (status === 404) return "这个社群不存在或已经关闭";
  if (fallback && !/^服务器返回异常/u.test(fallback)) return fallback;
  return "服务暂时不可用，暂时无法读取社群内容";
}

export type WorkspaceActionInput =
  | {
      action: "CREATE_POST";
      content: string;
      verseRef?: string;
      postType?: WorkspacePostType;
      title?: string;
      mediaType?: WorkspacePostMediaType;
      mediaUrl?: string;
      visibility?: WorkspacePostVisibility;
    }
  | { action: "TOGGLE_LIKE"; postId: string }
  | { action: "TOGGLE_BOOKMARK"; postId: string }
  | { action: "REPORT_POST"; postId: string; reason: string }
  | { action: "TOGGLE_PIN_POST"; postId: string }
  | { action: "UPDATE_POST_STATUS"; postId: string; status: "HIDDEN" | "DELETED" }
  | { action: "ADD_COMMENT"; postId: string; content: string }
  | { action: "CREATE_EVENT"; title: string; description?: string; location?: string; startAt: string; endAt?: string; capacity?: number }
  | { action: "TOGGLE_SIGNUP"; eventId: string }
  | { action: "UPDATE_MEMBER_ROLE"; userId: string; role: "ADMIN" | "MEMBER" }
  | { action: "REMOVE_MEMBER"; userId: string }
  | { action: "INVITE_MEMBER"; email: string }
  | { action: "CREATE_GROUP"; name: string; abbreviation: string; description?: string; avatarColor?: string }
  | { action: "CREATE_RESOURCE"; title: string; description?: string; type: WorkspaceResource["type"]; url?: string; contentText?: string; visibility: WorkspaceResource["visibility"] }
  | { action: "UPDATE_RESOURCE_STATUS"; resourceId: string; status: "ACTIVE" | "HIDDEN" | "DELETED" }
  | { action: "REINDEX_RESOURCE"; resourceId: string }
  | { action: "UPDATE_JOIN_POLICY"; joinPolicy: CommunityWorkspace["community"]["joinPolicy"] }
  | { action: "UPDATE_COMMUNITY"; name: string; description?: string };

export async function fetchCommunityWorkspace(
  communityId: string,
  options: { allowStale?: boolean } = {},
): Promise<
  | {
      ok: true;
      workspace: CommunityWorkspace;
      stale?: boolean;
      warning?: string;
      cachedAt?: string;
    }
  | { ok: false; message: string; status?: number; preview?: CommunityPreview }
> {
  try {
    const response = await apiRequest<WorkspaceResponse>(
      `/api/mobile/community/${encodeURIComponent(communityId)}/workspace`,
    );
    const data = response.data;
    if (
      !response.ok ||
      !data?.ok ||
      !data.community ||
      !data.access ||
      !data.entitlements ||
      !data.usage ||
      !data.posts ||
      !data.events ||
      !data.members ||
      !data.groups ||
      !data.resources
    ) {
      // Never expose cached private content after authentication or permission
      // failures. For transient service failures, a session-only snapshot keeps
      // the last successfully viewed workspace usable after a refresh.
      const cached =
        options.allowStale && response.status >= 500
          ? getCachedWorkspace(communityId)
          : null;
      if (cached) {
        return {
          ok: true,
          workspace: cached.workspace,
          stale: true,
          warning: "服务暂时不可用，正在显示本次使用期间最后加载的社群内容",
          cachedAt: cached.loadedAt,
        };
      }
      return {
        ok: false,
        message: workspaceFailureMessage(response.status, data?.message),
        status: response.status,
        preview: data?.preview,
      };
    }
    const isOfficial =
      data.community.isOfficial ??
      data.community.tier === "OFFICIAL_FREE";
    const workspace = {
      ...(data as CommunityWorkspace),
      community: {
        ...data.community,
        isOfficial,
        kind: isOfficial ? "PUBLIC" : "PRIVATE",
        joinPolicy: data.community.joinPolicy ?? "APPROVAL",
      },
    } satisfies CommunityWorkspace;
    saveWorkspaceCache(communityId, workspace);
    return {
      ok: true,
      workspace,
      stale: false,
    };
  } catch {
    const cached = options.allowStale ? getCachedWorkspace(communityId) : null;
    if (cached) {
      return {
        ok: true,
        workspace: cached.workspace,
        stale: true,
        warning: "服务暂时不可用，正在显示本次使用期间最后加载的社群内容",
        cachedAt: cached.loadedAt,
      };
    }
    return { ok: false, message: workspaceFailureMessage(0) };
  }
}

export async function fetchCommunityPosts(
  communityId: string,
  cursor?: string | null,
): Promise<
  | { ok: true; posts: WorkspacePost[]; nextCursor: string | null }
  | { ok: false; message: string }
> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  try {
    const response = await apiRequest<{
      ok: boolean;
      message?: string;
      posts?: WorkspacePost[];
      nextCursor?: string | null;
    }>(`/api/mobile/community/${encodeURIComponent(communityId)}/posts${query}`);
    const data = response.data;
    if (!response.ok || data?.ok !== true || !Array.isArray(data.posts)) {
      return {
        ok: false,
        message: workspaceFailureMessage(response.status, data?.message),
      };
    }
    return { ok: true, posts: data.posts, nextCursor: data.nextCursor ?? null };
  } catch {
    return { ok: false, message: "动态加载失败，请稍后重试" };
  }
}

export type WorkspaceComment = {
  id: string;
  content: string;
  createdAt: string;
  author: { id: string; name: string };
};

export async function fetchPostComments(
  communityId: string,
  postId: string,
  cursor?: string | null,
): Promise<
  | { ok: true; comments: WorkspaceComment[]; total: number; nextCursor: string | null }
  | { ok: false; message: string }
> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  try {
    const response = await apiRequest<{
      ok: boolean;
      message?: string;
      comments?: WorkspaceComment[];
      total?: number;
      nextCursor?: string | null;
    }>(
      `/api/mobile/community/${encodeURIComponent(communityId)}/posts/${encodeURIComponent(postId)}/comments${query}`,
    );
    const data = response.data;
    if (!response.ok || data?.ok !== true || !Array.isArray(data.comments)) {
      return {
        ok: false,
        message: workspaceFailureMessage(response.status, data?.message),
      };
    }
    return {
      ok: true,
      comments: data.comments,
      total: data.total ?? data.comments.length,
      nextCursor: data.nextCursor ?? null,
    };
  } catch {
    return { ok: false, message: "评论加载失败，请稍后重试" };
  }
}

export async function heartbeatCommunityPresence(
  communityId: string,
): Promise<
  | { ok: true; onlineCount: number; sampledAt: string }
  | { ok: false; message: string }
> {
  try {
    const response = await apiRequest<{
      ok: boolean;
      onlineCount?: number;
      sampledAt?: string;
      message?: string;
    }>(
      `/api/mobile/community/${encodeURIComponent(communityId)}/presence`,
      { method: "POST" },
    );
    if (
      !response.ok ||
      response.data?.ok !== true ||
      typeof response.data.onlineCount !== "number" ||
      typeof response.data.sampledAt !== "string"
    ) {
      return {
        ok: false,
        message:
          workspaceFailureMessage(response.status, response.data?.message),
      };
    }
    return {
      ok: true,
      onlineCount: response.data.onlineCount,
      sampledAt: response.data.sampledAt,
    };
  } catch {
    return { ok: false, message: "无法更新在线状态" };
  }
}

/** 轻量互动的增量结果，避免为一次点赞重新拉取整个工作台。 */
export type WorkspacePatch = {
  post?: {
    id: string;
    likeCount?: number;
    likedByMe?: boolean;
    bookmarkedByMe?: boolean;
    commentCount?: number;
  };
  comment?: WorkspaceComment;
  event?: { id: string; signupCount: number; signedUpByMe: boolean };
};

export function applyWorkspacePatch(
  workspace: CommunityWorkspace,
  patch: WorkspacePatch,
): CommunityWorkspace {
  let next = workspace;
  if (patch.post) {
    const { id, ...changes } = patch.post;
    next = {
      ...next,
      posts: next.posts.map((post) =>
        post.id === id
          ? {
              ...post,
              ...changes,
              comments: patch.comment
                ? [...post.comments, patch.comment].slice(-2)
                : post.comments,
            }
          : post,
      ),
    };
  }
  if (patch.event) {
    const { id, ...changes } = patch.event;
    next = {
      ...next,
      events: next.events.map((event) =>
        event.id === id ? { ...event, ...changes } : event,
      ),
    };
  }
  return next;
}

export async function performWorkspaceAction(
  communityId: string,
  input: WorkspaceActionInput,
): Promise<{
  ok: boolean;
  message: string;
  refresh?: boolean;
  patch?: WorkspacePatch;
}> {
  try {
    const response = await apiRequest<{
      ok: boolean;
      message?: string;
      refresh?: boolean;
      patch?: WorkspacePatch;
    }>(
      `/api/mobile/community/${encodeURIComponent(communityId)}/workspace`,
      { method: "POST", body: input },
    );
    return {
      ok: response.ok && response.data?.ok === true,
      message:
        response.data?.message ??
        (response.ok
          ? "操作已完成"
          : workspaceFailureMessage(response.status)),
      refresh: response.data?.refresh,
      patch: response.data?.patch,
    };
  } catch {
    return { ok: false, message: "网络错误，请稍后重试" };
  }
}

export async function uploadCommunityResource(
  communityId: string,
  input: {
    file: File;
    title: string;
    description?: string;
    knowledgeText?: string;
    visibility: WorkspaceResource["visibility"];
  },
): Promise<{ ok: boolean; message: string }> {
  const form = new FormData();
  form.append("file", input.file);
  form.append("title", input.title);
  form.append("description", input.description ?? "");
  form.append("knowledgeText", input.knowledgeText ?? "");
  form.append("visibility", input.visibility);
  try {
    const response = await apiFormRequest<{
      ok: boolean;
      message?: string;
    }>(
      `/api/mobile/community/${encodeURIComponent(communityId)}/resources/upload`,
      form,
    );
    return {
      ok: response.ok && response.data?.ok === true,
      message:
        response.data?.message ??
        (response.ok
          ? "文件上传完成"
          : response.status === 413
            ? "文件过大，请选择较小的文件"
            : workspaceFailureMessage(response.status)),
    };
  } catch {
    return { ok: false, message: "文件上传失败，请检查网络后重试" };
  }
}
