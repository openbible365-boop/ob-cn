// Community data returned by the production API. Posts and event prototypes
// remain device-local until their backend endpoints are implemented.
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

export type Post = {
  id: string;
  groupId: string;
  avatar: string;
  avatarColor: string;
  author: string;
  time: string;
  text: string;
  verseRef?: string;
  verseText?: string;
  verseBook?: string;
  verseChapter?: number;
  verseNumber?: number;
  verseVersion?: string;
  likes: number;
  comments: number;
};

export type GroupEvent = {
  id: string;
  groupId: string;
  tag: string;
  tagStyle: "purple" | "orange";
  status: string;
  title: string;
  when?: string;
  where?: string;
  note?: string;
  reminder?: string;
  capacity?: number;
  signups: number;
};

const SEED_POSTS: Post[] = [
  {
    id: "p1", groupId: "youth", avatar: "陈", avatarColor: "rgba(233,130,100,.3)", author: "陈姊妹", time: "今天 14:05",
    text: "今天重读这节，被「甚至」两个字击中——神的爱不是抽象的，是舍己的行动。",
    verseRef: "约翰福音 3:16 · 和合本", verseText: "「神爱世人，甚至将他的独生子赐给他们……」",
    verseBook: "jhn", verseChapter: 3, verseNumber: 16, verseVersion: "cuv",
    likes: 24, comments: 8,
  },
  {
    id: "p2", groupId: "youth", avatar: "李", avatarColor: "rgba(191,120,246,.3)", author: "李弟兄", time: "昨天 22:41",
    text: "周五查经前建议大家先读完 3 章，把不明白的地方先问问慧读，带着问题来。",
    likes: 11, comments: 3,
  },
];

const SEED_EVENTS: GroupEvent[] = [
  {
    id: "e1", groupId: "youth", tag: "线上查经班", tagStyle: "purple", status: "报名中",
    title: "约翰福音 3 章共读", when: "本周五 20:00 – 21:30", where: "线上 · 会议链接报名后可见",
    capacity: 20, signups: 12,
  },
  {
    id: "e2", groupId: "youth", tag: "每日读经打卡", tagStyle: "orange", status: "进行中 · 第 18 天",
    title: "四福音 40 天通读", note: "今日已有 8 人完成打卡", reminder: "开始前 2 小时自动提醒",
    capacity: undefined, signups: 20,
  },
];

const GROUPS_KEY = "ob.groups";
const LIKES_KEY = "ob.postLikes";
const SIGNUP_KEY = "ob.eventSignups";
const POSTS_KEY = "ob.communityPosts";

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

export function getPosts(groupId: string): Post[] {
  return [...load<Post[]>(POSTS_KEY, []), ...SEED_POSTS].filter((p) => p.groupId === groupId);
}

export function createPost(groupId: string, text: string): Post {
  const post: Post = {
    id: uid(), groupId, avatar: "我", avatarColor: "rgba(191,120,246,.18)",
    author: "我", time: "刚刚", text, likes: 0, comments: 0,
  };
  save(POSTS_KEY, [post, ...load<Post[]>(POSTS_KEY, [])]);
  return post;
}

export function getMyLikes(): string[] {
  return load<string[]>(LIKES_KEY, []);
}

export function toggleLike(postId: string) {
  const likes = getMyLikes();
  save(LIKES_KEY, likes.includes(postId) ? likes.filter((x) => x !== postId) : [...likes, postId]);
}

export function getEvents(groupId: string): GroupEvent[] {
  return SEED_EVENTS.filter((e) => e.groupId === groupId);
}

export function getMySignups(): string[] {
  return load<string[]>(SIGNUP_KEY, []);
}

export function toggleSignup(eventId: string) {
  const s = getMySignups();
  save(SIGNUP_KEY, s.includes(eventId) ? s.filter((x) => x !== eventId) : [...s, eventId]);
}
