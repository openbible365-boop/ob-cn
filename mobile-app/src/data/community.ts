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
};

export async function fetchCommunityGroups(): Promise<
  | {
      ok: true;
      groups: Group[];
      authenticated: boolean;
      canCreateCommunity: boolean;
    }
  | { ok: false; message: string }
> {
  try {
    const response = await apiRequest<CommunityListApiResult>(
      "/api/mobile/community",
    );
    const result = response.data;
    if (!response.ok || !result?.ok || !Array.isArray(result.communities)) {
      return {
        ok: false,
        message: result?.message ?? `服务器返回异常（${response.status}）`,
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
    save(GROUPS_KEY, groups);
    return {
      ok: true,
      groups,
      authenticated: result.authenticated === true,
      canCreateCommunity: result.canCreateCommunity === true,
    };
  } catch {
    return { ok: false, message: "无法读取服务器社群列表，请稍后重试" };
  }
}

type JoinRequestListApiResult = {
  ok: boolean;
  message?: string;
  requests?: CommunityJoinRequest[];
};

export async function fetchCommunityJoinRequests(communityId: string): Promise<
  | { ok: true; requests: CommunityJoinRequest[] }
  | { ok: false; message: string }
> {
  try {
    const response = await apiRequest<JoinRequestListApiResult>(
      `/api/mobile/community/${encodeURIComponent(communityId)}/join-requests`,
    );
    if (!response.ok || !response.data?.ok || !response.data.requests) {
      return {
        ok: false,
        message:
          response.data?.message ?? `服务器返回异常（${response.status}）`,
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
        response.data?.message ?? `服务器返回异常（${response.status}）`,
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
  | { ok: false; message: string };

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
        message: result?.message ?? `服务器返回异常（${response.status}）`,
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
