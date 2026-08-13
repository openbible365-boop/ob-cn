// 网页版社群面板的接口验收：npm run verify:web:community
//
// 网页版社群面板复用 App 的 /api/mobile/community/*，这里只覆盖面板真正会调的那几条：
//   社群列表 → 群动态(workspace) → 发帖 / 点赞 / 评论 / 评论翻页
// 以及权限边界：非成员不能发帖、未登录只能看公开目录。
//
// 会话直接按 lib/current-user.ts 的规则在库里签发（随机 token + SHA-256），
// 不依赖万能测试验证码，也就不必为验收把它开在服务端。
import { createHash, randomBytes } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { loadEnv } from "./load-env";

loadEnv();

const baseUrl = process.env.COMMUNITY_API_BASE?.replace(/\/$/, "") ?? "http://127.0.0.1:3000";
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL 未配置");
// 与已有验收脚本一致：只允许打本机库，避免误连生产
const dbHost = new URL(connectionString).hostname;
if (!["127.0.0.1", "localhost"].includes(dbHost)) {
  throw new Error("验收只允许连接本机测试数据库");
}

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

// 只声明面板真正读到的字段
type ApiAuthor = { name?: string };
type ApiComment = { content?: string; author?: ApiAuthor };
type ApiPost = {
  id: string;
  content?: string;
  verseRef?: string | null;
  likeCount?: number;
  likedByMe?: boolean;
  commentCount?: number;
  comments?: ApiComment[];
  author?: ApiAuthor;
};
type ApiCommunity = {
  id: string;
  name?: string;
  isOfficial?: boolean;
  membershipRole?: string | null;
};
type ApiBody = {
  ok?: boolean;
  message?: string;
  authenticated?: boolean;
  canCreateCommunity?: boolean;
  communities?: ApiCommunity[];
  discoverableCommunities?: unknown[];
  community?: { name?: string };
  posts?: ApiPost[];
  comments?: ApiComment[];
};

let passed = 0;
const failures: string[] = [];
function check(condition: unknown, message: string) {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${message}`);
  } else {
    failures.push(message);
    console.log(`  ✗ ${message}`);
  }
}
function section(title: string) {
  console.log(`\n${title}`);
}

const TAG = "[网页版验收]";

/** 按服务端同样的规则签发一个会话，返回可直接用的 cookie 串。 */
async function sessionCookie(userId: string) {
  const token = randomBytes(32).toString("base64url");
  await db.session.create({
    data: {
      tokenHash: createHash("sha256").update(token).digest("hex"),
      userId,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      userAgent: "verify-web-community",
    },
  });
  return `ob_session=${token}`;
}

type Res = { status: number; body: ApiBody | null };
async function api(path: string, options: RequestInit & { cookie?: string } = {}): Promise<Res> {
  const headers = new Headers(options.headers);
  if (options.cookie) headers.set("cookie", options.cookie);
  if (options.body) headers.set("content-type", "application/json");
  const res = await fetch(`${baseUrl}/api/mobile/community${path}`, { ...options, headers });
  let body: ApiBody | null = null;
  try {
    body = (await res.json()) as ApiBody;
  } catch {
    /* 非 JSON 响应 */
  }
  return { status: res.status, body };
}

async function main() {
  // ── 准备：一个社群、一个成员、一个非成员 ──
  const owner = await db.user.upsert({
    where: { email: "web.cmty.owner@openbible.local" },
    update: {},
    create: { email: "web.cmty.owner@openbible.local", name: `${TAG}群主`, avatarColor: "#8250ab" },
  });
  const outsider = await db.user.upsert({
    where: { email: "web.cmty.outsider@openbible.local" },
    update: {},
    create: {
      email: "web.cmty.outsider@openbible.local",
      name: `${TAG}非成员`,
      avatarColor: "#2f7a50",
    },
  });

  // 按 abbreviation 查——它才是唯一键。用 name 查会在简称被占用时创建失败。
  let community = await db.community.findFirst({ where: { abbreviation: "网页版验收" } });
  if (!community) {
    community = await db.community.create({
      data: {
        name: `${TAG}测试社群`,
        abbreviation: "网页版验收",
        description: "接口验收用，可安全删除",
        owner: { connect: { id: owner.id } },
        memberships: { create: { userId: owner.id, role: "OWNER" } },
      },
    });
  }
  const ownerCookie = await sessionCookie(owner.id);
  const outsiderCookie = await sessionCookie(outsider.id);

  // ── 1. 未登录 ──
  section("未登录");
  // 社群列表是公开目录（未登录也能看官方群，用于登录前的发现），
  // 但必须标明未登录、且不带任何私有社群或成员身份信息。
  const anonList = await api("");
  check(anonList.status === 200, `社群列表未登录可读公开目录（实际 ${anonList.status}）`);
  check(anonList.body?.authenticated === false, "未登录时 authenticated 为 false");
  const anonCommunities = anonList.body?.communities ?? [];
  check(
    anonCommunities.every((c) => c.isOfficial === true),
    "未登录只暴露官方社群，不泄露私有社群",
  );
  check(
    anonCommunities.every((c) => c.membershipRole === null),
    "未登录不携带成员身份信息",
  );
  check((anonList.body?.discoverableCommunities ?? []).length === 0, "未登录不返回可发现社群列表");
  check(anonList.body?.canCreateCommunity === false, "未登录不允许创建社群");
  const anonWs = await api(`/${community.id}/workspace`);
  check(anonWs.status === 401, `群动态未登录返回 401（实际 ${anonWs.status}）`);

  // ── 2. 社群列表：面板第一屏 ──
  section("社群列表（面板第一屏）");
  const list = await api("", { cookie: ownerCookie });
  check(list.status === 200, `列表返回 200（实际 ${list.status}）`);
  const listArray = list.body?.communities ?? [];
  check(listArray.length > 0, `列表非空（${listArray.length} 个社群）`);
  const mine = listArray.find((c) => c.id === community.id);
  check(Boolean(mine), "已加入的社群出现在列表里");
  check(Boolean(mine?.name), "列表项带社群名（面板要渲染）");

  // ── 3. 群动态 ──
  section("群动态 workspace");
  const ws = await api(`/${community.id}/workspace`, { cookie: ownerCookie });
  check(ws.status === 200, `workspace 返回 200（实际 ${ws.status}）`);
  check(Boolean(ws.body?.community?.name), "返回社群信息（面板标题依赖）");
  check(Array.isArray(ws.body?.posts), "返回 posts 数组");

  // ── 4. 发帖 ──
  section("发帖 CREATE_POST");
  const content = `${TAG}自动发布的动态 ${randomBytes(4).toString("hex")}`;
  const created = await api(`/${community.id}/workspace`, {
    method: "POST",
    cookie: ownerCookie,
    body: JSON.stringify({ action: "CREATE_POST", postType: "POST", content, verseRef: "约 3:16" }),
  });
  check(created.status === 200, `发帖返回 200（实际 ${created.status}）`);

  const afterPost = await api(`/${community.id}/workspace`, { cookie: ownerCookie });
  const post = (afterPost.body?.posts ?? []).find((p) => p.content === content);
  check(Boolean(post), "新动态出现在群动态里");
  check(post?.verseRef === "约 3:16", `经文引用被保存（实际 ${JSON.stringify(post?.verseRef)}）`);
  check(Boolean(post?.author?.name), "动态带作者信息（面板要渲染头像和昵称）");

  if (post) {
    // ── 5. 点赞：面板做的是局部更新，服务端必须真的翻转 ──
    section("点赞 TOGGLE_LIKE");
    const before = post.likeCount ?? 0;
    const like = await api(`/${community.id}/workspace`, {
      method: "POST",
      cookie: ownerCookie,
      body: JSON.stringify({ action: "TOGGLE_LIKE", postId: post.id }),
    });
    check(like.status === 200, `点赞返回 200（实际 ${like.status}）`);
    let ws2 = await api(`/${community.id}/workspace`, { cookie: ownerCookie });
    let p2 = (ws2.body?.posts ?? []).find((p) => p.id === post.id);
    check(p2?.likeCount === before + 1, `点赞后计数 +1（${before} → ${p2?.likeCount}）`);
    check(p2?.likedByMe === true, "likedByMe 为 true（面板据此高亮）");

    await api(`/${community.id}/workspace`, {
      method: "POST",
      cookie: ownerCookie,
      body: JSON.stringify({ action: "TOGGLE_LIKE", postId: post.id }),
    });
    ws2 = await api(`/${community.id}/workspace`, { cookie: ownerCookie });
    p2 = (ws2.body?.posts ?? []).find((p) => p.id === post.id);
    check(p2?.likeCount === before, `再次点赞取消，计数回到 ${before}（实际 ${p2?.likeCount}）`);
    check(p2?.likedByMe === false, "likedByMe 回到 false");

    // ── 6. 评论 ──
    section("评论 ADD_COMMENT");
    const commentText = `${TAG}自动评论 ${randomBytes(3).toString("hex")}`;
    const commented = await api(`/${community.id}/workspace`, {
      method: "POST",
      cookie: ownerCookie,
      body: JSON.stringify({ action: "ADD_COMMENT", postId: post.id, content: commentText }),
    });
    check(commented.status === 200, `评论返回 200（实际 ${commented.status}）`);

    const ws3 = await api(`/${community.id}/workspace`, { cookie: ownerCookie });
    const p3 = (ws3.body?.posts ?? []).find((p) => p.id === post.id);
    check(
      (p3?.comments ?? []).some((c) => c.content === commentText),
      "评论出现在动态的内联评论里",
    );
    check(typeof p3?.commentCount === "number", "返回 commentCount（面板显示评论数）");

    // 评论翻页是独立的 GET 接口（挂在 communityId 下）。
    // 注意：网页版面板目前并不调用它，见文末提示。
    const commentsRes = await fetch(
      `${baseUrl}/api/mobile/community/${community.id}/posts/${post.id}/comments`,
      { headers: { cookie: ownerCookie } },
    );
    check(commentsRes.status === 200, `评论翻页接口返回 200（实际 ${commentsRes.status}）`);
    const commentsBody = (await commentsRes.json().catch(() => null)) as ApiBody | null;
    check(
      (commentsBody?.comments ?? []).some((c) => c.content === commentText),
      "评论翻页接口能读到刚发的评论",
    );

    // ── 7. 权限边界 ──
    section("权限边界（非成员）");
    const outsiderWs = await api(`/${community.id}/workspace`, { cookie: outsiderCookie });
    check(
      outsiderWs.status === 200 || outsiderWs.status === 403,
      `非成员访问群动态返回 200(预览) 或 403，不应是 500（实际 ${outsiderWs.status}）`,
    );
    const outsiderPost = await api(`/${community.id}/workspace`, {
      method: "POST",
      cookie: outsiderCookie,
      body: JSON.stringify({
        action: "CREATE_POST",
        postType: "POST",
        content: "非成员不该发得出去",
      }),
    });
    check(
      outsiderPost.status === 403 || outsiderPost.body?.ok === false,
      `非成员发帖被拒（实际 ${outsiderPost.status}）`,
    );

    // ── 8. 输入校验：坏输入应是 4xx，不该把服务端打成 500 ──
    section("输入校验");
    const empty = await api(`/${community.id}/workspace`, {
      method: "POST",
      cookie: ownerCookie,
      body: JSON.stringify({ action: "CREATE_POST", postType: "POST", content: "" }),
    });
    check(empty.status >= 400 || empty.body?.ok === false, `空内容发帖被拒（实际 ${empty.status}）`);

    const badAction = await api(`/${community.id}/workspace`, {
      method: "POST",
      cookie: ownerCookie,
      body: JSON.stringify({ action: "NOT_A_REAL_ACTION" }),
    });
    check(
      badAction.status >= 400 && badAction.status < 500,
      `未知 action 返回 4xx 而非 500（实际 ${badAction.status}）`,
    );

    const ghost = await api(`/${community.id}/workspace`, {
      method: "POST",
      cookie: ownerCookie,
      body: JSON.stringify({ action: "TOGGLE_LIKE", postId: "does-not-exist" }),
    });
    check(
      ghost.status >= 400 && ghost.status < 500,
      `点赞不存在的动态返回 4xx 而非 500（实际 ${ghost.status}）`,
    );
  }

  // ── 清理会话（社群与用户保留，重复运行会复用）──
  await db.session.deleteMany({ where: { userId: { in: [owner.id, outsider.id] } } });

  console.log(`\n通过 ${passed} 项，失败 ${failures.length} 项`);
  if (failures.length) {
    console.log("\n失败项：");
    for (const f of failures) console.log(`  - ${f}`);
  }
  console.log(`\n验收数据以「${TAG}」开头，可在后台按名称清理。`);
  return failures.length ? 1 : 0;
}

main()
  .then(async (code) => {
    await db.$disconnect();
    process.exit(code);
  })
  .catch(async (err) => {
    console.error(err);
    await db.$disconnect();
    process.exit(1);
  });
