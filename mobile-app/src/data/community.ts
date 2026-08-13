// Community directory data returned by the production API. Posts, comments,
// events, members, groups and resources live in community-workspace.ts.
import { load, save } from "./store";
import { apiRequest } from "./api";

export type Group = {
  id: string;
  letter: string;
  color: string;
  name: string;
  badge?: string;
  badgeStyle?: "official" | "owner" | "muted";
  desc: string;
  memberCount: number;
  tier?: string;
  membershipRole?: "OWNER" | "ADMIN" | "MEMBER" | null;
  pendingJoinRequestCount?: number;
  joinPolicy?: "OPEN" | "APPROVAL" | "INVITE_ONLY";
};

export type CommunityJoinRequest = {
  id: string;
  message: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string | null;
    avatarColor: string;
    avatarUrl: string | null;
  };
};

const GROUPS_KEY = "ob.groups";
const COMMUNITY_DIRECTORY_CACHE_KEY = "ob.community-directory-cache";

type CommunityDirectoryCache = {
  groups: Group[];
  discoverableGroups?: Group[];
  authenticated: boolean;
  canCreateCommunity: boolean;
  loadedAt: string;
};

function communityFailureMessage(
  status: number,
  fallback?: string,
  defaultMessage = "服务暂时不可用，请稍后重试",
) {
  if (status === 401) return "请先登录后继续操作";
  if (status === 403) return "当前账号没有执行此操作的权限";
  if (status === 404) return "相关社群内容不存在或已经关闭";
  if (fallback && !/^服务器返回异常/u.test(fallback)) return fallback;
  return defaultMessage;
}

function getCommunityDirectoryCache(): CommunityDirectoryCache | null {
  const cached = load<CommunityDirectoryCache | null>(
    COMMUNITY_DIRECTORY_CACHE_KEY,
    null,
  );
  if (cached && Array.isArray(cached.groups)) return cached;

  // Keep the directory resilient for people who already have the older
  // group-only cache, while the richer cache is gradually populated.
  const groups = getGroups();
  if (groups.length === 0) return null;
  return {
    groups,
    authenticated: groups.some((group) => group.badgeStyle !== "official"),
    canCreateCommunity: false,
    loadedAt: "",
  };
}

export function getGroups(): Group[] {
  return load<Group[]>(GROUPS_KEY, []);
}

export function getGroup(id: string) {
  return getGroups().find((g) => g.id === id) ?? null;
}

export function upsertAssistantCommunity(community: {
  id: string;
  name: string;
  abbreviation: string;
  description: string | null;
  avatarColor: string;
  memberCount: number;
}) {
  const group: Group = {
    id: community.id,
    letter: community.abbreviation,
    color: community.avatarColor,
    name: community.name,
    badge: "群主",
    badgeStyle: "owner",
    desc: community.description
      ? `${community.memberCount} 成员 · ${community.description}`
      : `${community.memberCount} 成员 · 刚刚创建`,
    memberCount: community.memberCount,
    tier: "初阶",
    membershipRole: "OWNER",
    pendingJoinRequestCount: 0,
  };
  save(GROUPS_KEY, [
    ...getGroups().filter((existing) => existing.id !== group.id),
    group,
  ]);
  return group;
}

export function cacheCommunityWorkspace(input: {
  community: {
    id: string;
    name: string;
    abbreviation: string;
    description: string | null;
    avatarColor: string;
  };
  role: "OWNER" | "ADMIN" | "MEMBER";
  memberCount: number;
  groups: Array<{
    id: string;
    name: string;
    abbreviation: string;
    description: string | null;
    avatarColor: string;
    memberCount: number;
  }>;
}) {
  const toGroup = (
    community: typeof input.community & { memberCount?: number },
    role: "OWNER" | "ADMIN" | "MEMBER",
  ): Group => ({
    id: community.id,
    letter: community.abbreviation,
    color: community.avatarColor,
    name: community.name,
    badge: role === "OWNER" ? "群主" : role === "ADMIN" ? "管理员" : undefined,
    badgeStyle: role === "OWNER" || role === "ADMIN" ? "owner" : undefined,
    desc: community.description
      ? `${community.memberCount ?? 0} 成员 · ${community.description}`
      : `${community.memberCount ?? 0} 成员`,
    memberCount: community.memberCount ?? 0,
    membershipRole: role,
  });

  const updates = [
    toGroup({ ...input.community, memberCount: input.memberCount }, input.role),
    ...input.groups.map((group) => toGroup(group, input.role)),
  ];
  const updateIds = new Set(updates.map(({ id }) => id));
  save(GROUPS_KEY, [...getGroups().filter(({ id }) => !updateIds.has(id)), ...updates]);
}

type CommunityListApiResult = {
  ok: boolean;
  authenticated?: boolean;
  canCreateCommunity?: boolean;
  message?: string;
  communities?: Array<{
    id: string;
    name: string;
    abbreviation: string;
    description: string | null;
    avatarColor: string;
    tier: "OFFICIAL_FREE" | "BASIC_FREE" | "MID" | "HIGH";
    isOfficial: boolean;
    membershipRole: "OWNER" | "ADMIN" | "MEMBER" | null;
    memberCount: number;
    pendingJoinRequestCount: number;
  }>;
  discoverableCommunities?: Array<{
    id: string;
    name: string;
    abbreviation: string;
    description: string | null;
    avatarColor: string;
    tier: "OFFICIAL_FREE" | "BASIC_FREE" | "MID" | "HIGH";
    joinPolicy: "OPEN" | "APPROVAL" | "INVITE_ONLY";
    memberCount: number;
  }>;
};

export async function fetchCommunityGroups(
  options: { allowStale?: boolean; keyword?: string } = {},
): Promise<
  | {
      ok: true;
      groups: Group[];
      authenticated: boolean;
      canCreateCommunity: boolean;
      discoverableGroups: Group[];
      stale?: boolean;
      warning?: string;
      cachedAt?: string;
    }
  | { ok: false; message: string; status?: number }
> {
  const staleResult = () => {
    if (!options.allowStale) return null;
    const cached = getCommunityDirectoryCache();
    if (!cached || cached.groups.length === 0) return null;
    return {
      ok: true as const,
      groups: cached.groups,
      authenticated: cached.authenticated,
      // Creation and other writes should not be offered while the server
      // cannot confirm the current session and permissions.
      canCreateCommunity: false,
      discoverableGroups: cached.discoverableGroups ?? [],
      stale: true,
      warning: "服务暂时不可用，正在显示上次成功加载的社群",
      cachedAt: cached.loadedAt,
    };
  };

  try {
    const keyword = options.keyword?.trim() ?? "";
    const response = await apiRequest<CommunityListApiResult>(
      keyword
        ? `/api/mobile/community?q=${encodeURIComponent(keyword)}`
        : "/api/mobile/community",
    );
    const result = response.data;
    if (!response.ok || !result?.ok || !Array.isArray(result.communities)) {
      const cached = response.status >= 500 ? staleResult() : null;
      if (cached) return cached;
      return {
        ok: false,
        message: communityFailureMessage(
          response.status,
          result?.message,
          "服务暂时不可用，暂时无法读取社群",
        ),
        status: response.status,
      };
    }

    const groups = result.communities.map((community): Group => ({
      id: community.id,
      letter: community.abbreviation,
      color: community.avatarColor,
      name: community.name,
      badge: community.isOfficial
        ? "公共社群"
        : community.membershipRole === "OWNER"
          ? "群主"
          : undefined,
      badgeStyle: community.isOfficial
        ? "official"
        : community.membershipRole === "OWNER"
          ? "owner"
          : undefined,
      desc: community.isOfficial
        ? "全体已注册成员"
        : community.description
          ? `${community.memberCount} 成员 · ${community.description}`
          : `${community.memberCount} 成员`,
      memberCount: community.memberCount,
      tier:
        community.tier === "MID"
          ? "中阶"
          : community.tier === "HIGH"
            ? "高阶"
            : community.tier === "BASIC_FREE"
              ? "初阶"
              : "官方",
      membershipRole: community.membershipRole,
      pendingJoinRequestCount: community.pendingJoinRequestCount,
    }));
    const discoverableGroups = (result.discoverableCommunities ?? []).map(
      (community): Group => ({
        id: community.id,
        letter: community.abbreviation,
        color: community.avatarColor,
        name: community.name,
        badge: community.joinPolicy === "OPEN" ? "可直接加入" : "需审核",
        badgeStyle: "muted",
        desc: community.description
          ? `${community.memberCount} 成员 · ${community.description}`
          : `${community.memberCount} 成员`,
        memberCount: community.memberCount,
        tier: community.tier === "MID" ? "中阶" : community.tier === "HIGH" ? "高阶" : "初阶",
        membershipRole: null,
        joinPolicy: community.joinPolicy,
      }),
    );
    save(GROUPS_KEY, groups);
    // 带关键词的结果是一次搜索，不能覆盖完整的可发现社群缓存。
    if (!keyword) {
      save<CommunityDirectoryCache>(COMMUNITY_DIRECTORY_CACHE_KEY, {
        groups,
        discoverableGroups,
        authenticated: result.authenticated === true,
        canCreateCommunity: result.canCreateCommunity === true,
        loadedAt: new Date().toISOString(),
      });
    }
    return {
      ok: true,
      groups,
      discoverableGroups,
      authenticated: result.authenticated === true,
      canCreateCommunity: result.canCreateCommunity === true,
      stale: false,
    };
  } catch {
    const cached = staleResult();
    if (cached) return cached;
    return { ok: false, message: "服务暂时不可用，暂时无法读取社群" };
  }
}

type JoinCommunityApiResult = {
  ok: boolean;
  message?: string;
  state?: "JOINED" | "PENDING";
};

export async function requestCommunityJoin(communityId: string): Promise<{
  ok: boolean;
  message: string;
  state?: "JOINED" | "PENDING";
  status?: number;
}> {
  try {
    const response = await apiRequest<JoinCommunityApiResult>(
      `/api/mobile/community/${encodeURIComponent(communityId)}/join`,
      { method: "POST" },
    );
    return {
      ok: response.ok && response.data?.ok === true,
      message:
        response.data?.message ??
        (response.ok ? "申请已提交" : communityFailureMessage(response.status)),
      state: response.data?.state,
      status: response.status,
    };
  } catch {
    return { ok: false, message: "网络错误，请稍后重试" };
  }
}

type JoinRequestListApiResult = {
  ok: boolean;
  message?: string;
  requests?: CommunityJoinRequest[];
};

export async function fetchCommunityJoinRequests(communityId: string): Promise<
  | { ok: true; requests: CommunityJoinRequest[] }
  | { ok: false; message: string; status?: number }
> {
  try {
    const response = await apiRequest<JoinRequestListApiResult>(
      `/api/mobile/community/${encodeURIComponent(communityId)}/join-requests`,
    );
    if (!response.ok || !response.data?.ok || !response.data.requests) {
      return {
        ok: false,
        message: communityFailureMessage(
          response.status,
          response.data?.message,
          "暂时无法读取加入申请",
        ),
        status: response.status,
      };
    }
    return { ok: true, requests: response.data.requests };
  } catch {
    return { ok: false, message: "无法读取加入申请，请稍后重试" };
  }
}

type ReviewJoinRequestApiResult = {
  ok: boolean;
  message?: string;
};

export async function reviewCommunityJoinRequest(
  communityId: string,
  requestId: string,
  decision: "APPROVE" | "REJECT",
): Promise<{ ok: boolean; message: string }> {
  try {
    const response = await apiRequest<ReviewJoinRequestApiResult>(
      `/api/mobile/community/${encodeURIComponent(communityId)}/join-requests`,
      { method: "POST", body: { requestId, decision } },
    );
    return {
      ok: response.ok && response.data?.ok === true,
      message:
        response.data?.message ??
        (response.ok
          ? decision === "APPROVE" ? "已通过加入申请" : "已拒绝加入申请"
          : communityFailureMessage(response.status)),
    };
  } catch {
    return { ok: false, message: "网络错误，请稍后重试" };
  }
}

type CreateCommunityApiResult = {
  ok: boolean;
  message: string;
  community?: {
    id: string;
    name: string;
    abbreviation: string;
    description: string | null;
    avatarColor: string;
    tier: "OFFICIAL_FREE" | "BASIC_FREE" | "MID" | "HIGH";
    memberCount: number;
  };
};

export type CreateCommunityResult =
  | { ok: true; message: string; group: Group }
  | { ok: false; message: string; status?: number };

export async function createCommunity(input: {
  name: string;
  abbreviation: string;
  description?: string;
  avatarColor?: string;
}): Promise<CreateCommunityResult> {
  try {
    const response = await apiRequest<CreateCommunityApiResult>(
      "/api/mobile/community",
      { method: "POST", body: input },
    );
    const result = response.data;
    if (!response.ok || !result?.ok || !result.community) {
      return {
        ok: false,
        message: communityFailureMessage(
          response.status,
          result?.message,
          "暂时无法创建社群",
        ),
        status: response.status,
      };
    }

    const community = result.community;
    const group: Group = {
      id: community.id,
      letter: community.abbreviation,
      color: community.avatarColor,
      name: community.name,
      badge: "群主",
      badgeStyle: "owner",
      desc: community.description
        ? `${community.memberCount} 成员 · ${community.description}`
        : `${community.memberCount} 成员 · 刚刚创建`,
      memberCount: community.memberCount,
      tier: "初阶",
      membershipRole: "OWNER",
      pendingJoinRequestCount: 0,
    };
    save(GROUPS_KEY, [
      ...getGroups().filter((existing) => existing.id !== group.id),
      group,
    ]);
    return { ok: true, message: result.message, group };
  } catch {
    return { ok: false, message: "网络错误，请稍后重试" };
  }
}

export function updateGroup(id: string, patch: Partial<Pick<Group, "name" | "tier">>) {
  const groups = getGroups().map((g) =>
    g.id === id ? { ...g, ...patch, letter: (patch.name ?? g.name).slice(0, 1) || g.letter } : g,
  );
  save(GROUPS_KEY, groups);
}
