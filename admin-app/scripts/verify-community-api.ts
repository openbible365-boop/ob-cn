import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const baseUrl = process.env.COMMUNITY_API_BASE?.replace(/\/$/, "") ?? "http://127.0.0.1:3000";
const testCode = process.env.OPENBIBLE_TEST_LOGIN_CODE?.trim();
const connectionString = process.env.DATABASE_URL;

if (!testCode) {
  throw new Error("OPENBIBLE_TEST_LOGIN_CODE 未配置，无法执行角色接口验收");
}
if (!connectionString) {
  throw new Error("DATABASE_URL 未配置，无法清理接口验收数据");
}
const databaseUrl = new URL(connectionString);
if (!["127.0.0.1", "localhost"].includes(databaseUrl.hostname)) {
  throw new Error("角色接口验收只允许连接本机测试数据库");
}

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});
const aiValidationEventTitle = "【接口验收】AI 确认闭环";
const failedResourceTitle = "【验收】解析失败的音频";

function check(condition: unknown, message: string) {
  if (!condition) throw new Error(`验证失败：${message}`);
  console.log(`✓ ${message}`);
}

async function request(
  path: string,
  options: RequestInit & { cookie?: string } = {},
) {
  const headers = new Headers(options.headers);
  if (options.cookie) headers.set("cookie", options.cookie);
  if (options.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  return fetch(`${baseUrl}${path}`, { ...options, headers });
}

async function login(email: string) {
  const response = await request("/api/mobile/auth/verify", {
    method: "POST",
    body: JSON.stringify({ email, code: testCode }),
  });
  const body = await response.json() as { ok?: boolean; message?: string };
  check(response.ok && body.ok, `${email} 测试账号登录成功`);
  const cookie = response.headers.get("set-cookie")?.split(";", 1)[0];
  check(cookie, `${email} 获得有效会话`);
  return cookie!;
}

async function json(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

async function main() {
  const guestDirectoryResponse = await request("/api/mobile/community");
  const guestDirectory = await json(guestDirectoryResponse);
  check(guestDirectoryResponse.ok, "游客可以打开社群首页");
  check(guestDirectory.authenticated === false, "游客状态识别正确");
  const guestCommunities = guestDirectory.communities as Array<Record<string, unknown>>;
  check(
    guestCommunities.length === 1 && guestCommunities[0]?.id === "official",
    "游客目录只显示慧读总群",
  );

  const guestOfficialResponse = await request("/api/mobile/community/official/workspace");
  const guestOfficial = await json(guestOfficialResponse);
  check(guestOfficialResponse.ok, "游客可以浏览公共社群动态和活动");
  check((guestOfficial.access as Record<string, unknown>).role === "GUEST", "公共社群游客权限正确");
  check(
    ["members", "groups", "resources"].every(
      (key) => Array.isArray(guestOfficial[key]) && (guestOfficial[key] as unknown[]).length === 0,
    ),
    "公共社群接口不暴露成员、小组和资料管理数据",
  );

  const ownerCookie = await login("owner.community@openbible.local");
  const ownerDirectoryResponse = await request("/api/mobile/community", { cookie: ownerCookie });
  const ownerDirectory = await json(ownerDirectoryResponse);
  const validationCommunity = (ownerDirectory.communities as Array<Record<string, unknown>>)
    .find((community) => community.abbreviation === "验收");
  check(validationCommunity, "群主目录可以看到功能验证社群");
  const communityId = String(validationCommunity!.id);

  const guestPrivateResponse = await request(`/api/mobile/community/${communityId}/workspace`);
  check(guestPrivateResponse.status === 401, "游客不能浏览私有社群");

  const ownerWorkspaceResponse = await request(
    `/api/mobile/community/${communityId}/workspace`,
    { cookie: ownerCookie },
  );
  const ownerWorkspace = await json(ownerWorkspaceResponse);
  const ownerAccess = ownerWorkspace.access as Record<string, unknown>;
  check(ownerWorkspaceResponse.ok && ownerAccess.role === "OWNER", "群主角色识别正确");
  check(
    ownerAccess.canManageMembers === true &&
      ownerAccess.canManageRoles === true &&
      ownerAccess.canCreateGroups === true &&
      ownerAccess.canManageResources === true,
    "群主拥有成员、角色、小组和资料管理权限",
  );

  const adminCookie = await login("admin.community@openbible.local");
  const adminWorkspaceResponse = await request(
    `/api/mobile/community/${communityId}/workspace`,
    { cookie: adminCookie },
  );
  const adminWorkspace = await json(adminWorkspaceResponse);
  const adminAccess = adminWorkspace.access as Record<string, unknown>;
  check(adminWorkspaceResponse.ok && adminAccess.role === "ADMIN", "管理员角色识别正确");
  check(
    adminAccess.canManageMembers === true &&
      adminAccess.canManageRoles === false &&
      adminAccess.canCreateGroups === true,
    "管理员可管理成员和小组，但不能转让群主权限",
  );

  const memberCookie = await login("member.community@openbible.local");
  const memberUser = await db.user.findUniqueOrThrow({
    where: { email: "member.community@openbible.local" },
    select: { id: true },
  });
  const memberWorkspaceResponse = await request(
    `/api/mobile/community/${communityId}/workspace`,
    { cookie: memberCookie },
  );
  const memberWorkspace = await json(memberWorkspaceResponse);
  const memberAccess = memberWorkspace.access as Record<string, unknown>;
  check(memberWorkspaceResponse.ok && memberAccess.role === "MEMBER", "普通成员角色识别正确");
  check(
    memberAccess.canManageMembers === false &&
      memberAccess.canCreateGroups === false &&
      memberAccess.canManageResources === false,
    "普通成员没有管理权限",
  );
  check(
    (memberWorkspace.resources as Array<Record<string, unknown>>)
      .every((resource) => resource.visibility !== "ADMINS"),
    "普通成员看不到管理员专属资料",
  );
  const memberResourceResponse = await request(
    `/api/mobile/community/${communityId}/workspace`,
    {
      cookie: memberCookie,
      method: "POST",
      body: JSON.stringify({
        action: "CREATE_RESOURCE",
        title: "成员不应上传的资料",
        type: "TEXT",
        contentText: "权限测试",
      }),
    },
  );
  check(memberResourceResponse.status === 403, "普通成员不能上传群资料");

  const memberNoticeResponse = await request(
    `/api/mobile/community/${communityId}/workspace`,
    {
      cookie: memberCookie,
      method: "POST",
      body: JSON.stringify({
        action: "CREATE_POST",
        postType: "NOTICE",
        title: "权限测试",
        content: "普通成员不应发布通知",
      }),
    },
  );
  check(memberNoticeResponse.status === 403, "普通成员不能发布群通知");

  const memberNotificationResponse = await request("/api/mobile/me/notifications", {
    cookie: memberCookie,
  });
  const memberNotificationCenter = await json(memberNotificationResponse);
  const notificationPreferences = memberNotificationCenter.preferences as Record<string, unknown>;
  const memberNotifications = memberNotificationCenter.notifications as Array<Record<string, unknown>>;
  check(
    memberNotificationResponse.ok &&
      ["daily_verse", "event_reminder", "reply", "join_updates", "ai_assistant"]
        .every((key) => typeof notificationPreferences[key] === "boolean"),
    "通知中心返回完整的账号同步偏好",
  );
  check(
    ["EVENT_REMINDER", "COMMENT_REPLY", "DAILY_VERSE"]
      .every((type) => memberNotifications.some((item) => item.type === type)),
    "成员可以收到活动、评论和每日金句通知",
  );
  const enableDailyVerseResponse = await request("/api/mobile/me/notifications", {
    cookie: memberCookie,
    method: "POST",
    body: JSON.stringify({
      action: "UPDATE_PREFERENCE",
      key: "daily_verse",
      enabled: true,
    }),
  });
  check(enableDailyVerseResponse.ok, "通知偏好可以同步到账号");
  check(
    await db.notificationSetting.count({
      where: { userId: memberUser.id, key: "daily_verse", enabled: true },
    }) === 1,
    "通知偏好同步结果已经持久化",
  );
  const commentNotification = memberNotifications.find(
    (item) => item.type === "COMMENT_REPLY" && item.readAt === null,
  );
  check(commentNotification, "存在可验证已读状态的评论通知");
  const markReadResponse = await request("/api/mobile/me/notifications", {
    cookie: memberCookie,
    method: "POST",
    body: JSON.stringify({
      action: "MARK_READ",
      notificationId: commentNotification!.id,
    }),
  });
  check(markReadResponse.ok, "单条通知可以标记为已读");
  check(
    await db.userNotification.count({
      where: { id: String(commentNotification!.id), readAt: { not: null } },
    }) === 1,
    "通知已读状态已经持久化",
  );

  const applicantCookie = await login("applicant.community@openbible.local");
  const applicantWorkspaceResponse = await request(
    `/api/mobile/community/${communityId}/workspace`,
    { cookie: applicantCookie },
  );
  check(applicantWorkspaceResponse.status === 403, "待审核用户不能提前进入私有社群");
  const applicantNotificationResponse = await request("/api/mobile/me/notifications", {
    cookie: applicantCookie,
  });
  const applicantNotificationCenter = await json(applicantNotificationResponse);
  check(
    applicantNotificationResponse.ok &&
      (applicantNotificationCenter.notifications as Array<Record<string, unknown>>)
        .some((item) => item.type === "JOIN_REVIEW"),
    "申请人可以收到入群审核结果",
  );

  const mutedCookie = await login("muted.community@openbible.local");
  const mutedActionResponse = await request(
    `/api/mobile/community/${communityId}/workspace`,
    {
      cookie: mutedCookie,
      method: "POST",
      body: JSON.stringify({ action: "TOGGLE_LIKE", postId: "permission-check" }),
    },
  );
  check(mutedActionResponse.status === 403, "受限账号不能执行互动操作");

  const failedResource = (adminWorkspace.resources as Array<Record<string, unknown>>)
    .find((resource) => resource.title === failedResourceTitle);
  check(
    failedResource?.knowledgeStatus === "FAILED",
    "管理员能看到解析失败资料及其状态",
  );
  const reindexResponse = await request(
    `/api/mobile/community/${communityId}/workspace`,
    {
      cookie: adminCookie,
      method: "POST",
      body: JSON.stringify({
        action: "REINDEX_RESOURCE",
        resourceId: failedResource!.id,
      }),
    },
  );
  check(reindexResponse.ok, "管理员可以重新索引失败资料");
  check(
    await db.communityResource.count({
      where: {
        id: String(failedResource!.id),
        knowledgeStatus: "INDEXED",
        indexedAt: { not: null },
      },
    }) === 1,
    "重新索引后资料进入知识库",
  );
  await db.communityResource.update({
    where: { id: String(failedResource!.id) },
    data: {
      knowledgeStatus: "FAILED",
      indexedAt: null,
      indexError: "未识别到可索引的语音内容",
    },
  });

  await db.event.deleteMany({
    where: { communityId, title: aiValidationEventTitle },
  });
  const proposalResponse = await request("/api/mobile/community/assistant", {
    cookie: ownerCookie,
    method: "POST",
    body: JSON.stringify({
      groupId: communityId,
      message: `创建活动，标题：“${aiValidationEventTitle}”，时间：“2030-01-02 19:30”，地点：“线上会议室”，说明：“验证草稿确认后才执行”`,
      history: [],
      visibility: "private",
    }),
  });
  const proposal = await json(proposalResponse);
  const proposalAction = proposal.action as Record<string, unknown> | undefined;
  check(
    proposalResponse.ok &&
      proposalAction?.kind === "CREATE_EVENT" &&
      typeof proposalAction.token === "string",
    "AI 事务先生成活动预览草稿",
  );
  check(
    await db.event.count({
      where: { communityId, title: aiValidationEventTitle },
    }) === 0,
    "草稿未经确认不会写入数据库",
  );

  const confirmationResponse = await request("/api/mobile/community/assistant", {
    cookie: ownerCookie,
    method: "POST",
    body: JSON.stringify({
      groupId: communityId,
      confirmationToken: proposalAction!.token,
    }),
  });
  const confirmation = await json(confirmationResponse);
  const confirmationEffect = confirmation.effect as Record<string, unknown> | undefined;
  check(
    confirmationResponse.ok && confirmationEffect?.type === "EVENT_CREATED",
    "用户确认后正式创建活动",
  );
  check(
    await db.event.count({
      where: { communityId, title: aiValidationEventTitle },
    }) === 1,
    "确认结果已经持久化",
  );

  const replayResponse = await request("/api/mobile/community/assistant", {
    cookie: ownerCookie,
    method: "POST",
    body: JSON.stringify({
      groupId: communityId,
      confirmationToken: proposalAction!.token,
    }),
  });
  check(replayResponse.status === 409, "同一确认令牌不能重复执行");
  await db.event.deleteMany({
    where: { communityId, title: aiValidationEventTitle },
  });

  console.log("\n社群游客、成员、管理员与群主接口验收通过。");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.event.deleteMany({
      where: { title: aiValidationEventTitle },
    }).catch(() => {});
    await db.communityResource.updateMany({
      where: { title: failedResourceTitle },
      data: {
        knowledgeStatus: "FAILED",
        indexedAt: null,
        indexError: "未识别到可索引的语音内容",
      },
    }).catch(() => {});
    const member = await db.user.findUnique({
      where: { email: "member.community@openbible.local" },
      select: { id: true },
    }).catch(() => null);
    if (member) {
      await db.notificationSetting.deleteMany({
        where: { userId: member.id, key: "daily_verse" },
      }).catch(() => {});
      await db.userNotification.updateMany({
        where: { userId: member.id, uniqueKey: "validation:comment-reply" },
        data: { readAt: null },
      }).catch(() => {});
      await db.userNotification.deleteMany({
        where: { userId: member.id, uniqueKey: { startsWith: "daily-verse:" } },
      }).catch(() => {});
    }
    await db.$disconnect();
  });
