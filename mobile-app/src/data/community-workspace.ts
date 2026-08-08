import { apiFormRequest, apiRequest } from "./api";

export type WorkspaceRole = "OWNER" | "ADMIN" | "MEMBER";
export type WorkspacePostType = "POST" | "ARTICLE" | "NOTICE" | "MEDIA";
export type WorkspacePostMediaType = "IMAGE" | "AUDIO" | "VIDEO";

export type WorkspacePost = {
  id: string;
  postType: WorkspacePostType;
  title: string | null;
  content: string;
  verseRef: string | null;
  mediaType: WorkspacePostMediaType | null;
  mediaUrl: string | null;
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
  role: WorkspaceRole;
  joinedAt: string;
  user: {
    id: string;
    name: string;
    email: string | null;
    avatarColor: string;
    avatarUrl: string | null;
    status: "ACTIVE" | "MUTED" | "BANNED";
    lastSeenAt?: string | null;
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
  visibility: "MEMBERS" | "ADMINS";
  createdAt: string;
  uploader: { id: string; name: string };
  downloadCount?: number;
  bookmarkedByMe?: boolean;
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
    parentId?: string | null;
  };
  access: {
    role: WorkspaceRole;
    isAdmin: boolean;
    isOwner: boolean;
    isDirectMember?: boolean;
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
  events: WorkspaceEvent[];
  members: WorkspaceMember[];
  groups: WorkspaceGroup[];
  resources: WorkspaceResource[];
};

type WorkspaceResponse = { ok: boolean; message?: string } & Partial<CommunityWorkspace>;

export type WorkspaceActionInput =
  | {
      action: "CREATE_POST";
      content: string;
      verseRef?: string;
      postType?: WorkspacePostType;
      title?: string;
      mediaType?: WorkspacePostMediaType;
      mediaUrl?: string;
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
  | { action: "CREATE_GROUP"; name: string; abbreviation: string; description?: string; avatarColor?: string }
  | { action: "CREATE_RESOURCE"; title: string; description?: string; type: WorkspaceResource["type"]; url?: string; contentText?: string; visibility: WorkspaceResource["visibility"] }
  | { action: "UPDATE_RESOURCE_STATUS"; resourceId: string; status: "ACTIVE" | "HIDDEN" | "DELETED" }
  | { action: "UPDATE_JOIN_POLICY"; joinPolicy: CommunityWorkspace["community"]["joinPolicy"] }
  | { action: "UPDATE_COMMUNITY"; name: string; description?: string }
  | { action: "INVITE_MEMBER"; email: string }
  | { action: "MUTE_MEMBER"; userId: string }
  | { action: "UNMUTE_MEMBER"; userId: string }
  | { action: "TRANSFER_OWNER"; userId: string }
  | { action: "JOIN_SUBGROUP" }
  | { action: "LEAVE_SUBGROUP" }
  | { action: "ARCHIVE_GROUP"; groupId: string }
  | { action: "TOGGLE_RESOURCE_BOOKMARK"; resourceId: string };

export async function fetchCommunityWorkspace(communityId: string): Promise<
  | { ok: true; workspace: CommunityWorkspace }
  | { ok: false; message: string }
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
      return { ok: false, message: data?.message ?? `服务器返回异常（${response.status}）` };
    }
    const isOfficial =
      data.community.isOfficial ??
      data.community.tier === "OFFICIAL_FREE";
    return {
      ok: true,
      workspace: {
        ...(data as CommunityWorkspace),
        community: {
          ...data.community,
          isOfficial,
          kind: isOfficial ? "PUBLIC" : "PRIVATE",
          joinPolicy: data.community.joinPolicy ?? "APPROVAL",
        },
      },
    };
  } catch {
    return { ok: false, message: "无法读取社群内容，请检查网络后重试" };
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
          response.data?.message ?? `服务器返回异常（${response.status}）`,
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

export async function performWorkspaceAction(
  communityId: string,
  input: WorkspaceActionInput,
): Promise<{ ok: boolean; message: string; refresh?: boolean }> {
  try {
    const response = await apiRequest<{ ok: boolean; message?: string; refresh?: boolean }>(
      `/api/mobile/community/${encodeURIComponent(communityId)}/workspace`,
      { method: "POST", body: input },
    );
    return {
      ok: response.ok && response.data?.ok === true,
      message: response.data?.message ?? `服务器返回异常（${response.status}）`,
      refresh: response.data?.refresh,
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
        response.data?.message ?? `服务器返回异常（${response.status}）`,
    };
  } catch {
    return { ok: false, message: "文件上传失败，请检查网络后重试" };
  }
}
