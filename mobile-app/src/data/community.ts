// Community data: seeded content matching the design, with user actions
// (likes, event signups, new posts/groups) persisted locally. Becomes a
// fetch-based API client when the mobile app is wired to the backend.
import { load, save, uid } from "./store";

export type Group = {
  id: string;
  letter: string;
  color: string;
  name: string;
  badge?: string;
  badgeStyle?: "official" | "owner" | "muted";
  desc: string;
  tier?: string;
  memberCount: number;
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

const SEED_GROUPS: Group[] = [
  { id: "official", letter: "慧", color: "rgba(191,120,246,.3)", name: "慧读总群", badge: "官方", badgeStyle: "official", desc: "全体用户 · 官方公告与慧读答疑", memberCount: 3280 },
  { id: "youth", letter: "青", color: "#FFD465", name: "青年查经小组", badge: "群主", badgeStyle: "owner", desc: "周五线上查经报名中", tier: "初阶", memberCount: 32 },
  { id: "grace", letter: "恩", color: "rgba(191,120,246,.3)", name: "恩典读经群", badge: "3 条新消息", badgeStyle: "muted", desc: "一年读经计划进行中", memberCount: 118 },
  { id: "prayer", letter: "祷", color: "rgba(233,130,100,.3)", name: "姊妹祷告会", desc: "今晨祷告接力已完成", memberCount: 21 },
];

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
  return load<Group[]>(GROUPS_KEY, SEED_GROUPS).map((group) => ({
    ...group,
    memberCount: (group.memberCount ?? SEED_GROUPS.find((seed) => seed.id === group.id)?.memberCount ?? Number(group.desc.match(/(\d+)\s*成员/)?.[1])) || 1,
  }));
}

export function getGroup(id: string) {
  return getGroups().find((g) => g.id === id) ?? null;
}

export function createGroup(name: string, desc?: string, color?: string): Group {
  const group: Group = {
    id: uid(),
    letter: name.slice(0, 1) || "群",
    color: color || "#FFD465",
    name,
    badge: "群主",
    badgeStyle: "owner",
    desc: desc || "1 成员 · 刚刚创建",
    tier: "初阶",
    memberCount: 1,
  };
  save(GROUPS_KEY, [...getGroups(), group]);
  return group;
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
