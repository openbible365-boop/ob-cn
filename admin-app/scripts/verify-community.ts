import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { communityKnowledgeContext } from "../src/lib/community-knowledge";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL 未配置，无法验证社群数据");
}

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

function check(condition: unknown, message: string) {
  if (!condition) throw new Error(`验证失败：${message}`);
  console.log(`✓ ${message}`);
}

function eventState(
  startAt: Date,
  endAt: Date | null,
): "ENDED" | "ACTIVE" | "UPCOMING" {
  const now = Date.now();
  if ((endAt ?? startAt).getTime() < now) return "ENDED";
  if (startAt.getTime() <= now) return "ACTIVE";
  return "UPCOMING";
}

async function main() {
  const community = await db.community.findUnique({
    where: { abbreviation: "验收" },
    include: {
      memberships: { include: { user: true } },
      groups: true,
      joinRequests: { include: { user: true } },
      posts: true,
      events: true,
      resources: true,
      auditLogs: true,
    },
  });
  check(community, "本地功能验证社群已建立");
  if (!community) return;

  const roleByEmail = new Map(
    community.memberships.map(({ role, user }) => [user.email, role]),
  );
  check(roleByEmail.get("owner.community@openbible.local") === "OWNER", "群主权限数据正确");
  check(roleByEmail.get("admin.community@openbible.local") === "ADMIN", "管理员权限数据正确");
  check(roleByEmail.get("member.community@openbible.local") === "MEMBER", "普通成员权限数据正确");
  check(roleByEmail.get("applicant.community@openbible.local") === undefined, "待审核用户尚未获得成员权限");
  check(
    community.memberships.some(({ user }) => user.email === "muted.community@openbible.local" && user.status === "MUTED"),
    "受限账号场景已建立",
  );
  check(community.groups.some(({ abbreviation }) => abbreviation === "验组"), "父子社群小组结构正确");
  check(
    community.joinRequests.some(({ status, user }) => status === "PENDING" && user.email === "applicant.community@openbible.local"),
    "待审核入群申请已建立",
  );

  const postTypes = new Set(community.posts.map(({ postType }) => postType));
  check(["POST", "ARTICLE", "NOTICE", "MEDIA"].every((type) => postTypes.has(type as never)), "动态、文章、通知和影音测试内容完整");
  check(community.posts.some(({ status }) => status === "HIDDEN"), "隐藏内容审核场景已建立");

  const eventStates = new Set(
    community.events.map(({ startAt, endAt }) => eventState(startAt, endAt)),
  );
  const requiredEventStates: Array<"UPCOMING" | "ACTIVE" | "ENDED"> = [
    "UPCOMING",
    "ACTIVE",
    "ENDED",
  ];
  check(requiredEventStates.every((state) => eventStates.has(state)), "活动时间状态覆盖完整");
  check(community.events.some(({ capacity, signupCount }) => capacity !== null && signupCount >= capacity), "活动满员场景已建立");

  const knowledgeStates = new Set(
    community.resources.map(({ knowledgeStatus }) => knowledgeStatus),
  );
  check(
    ["PARSING", "INDEXED", "FAILED", "REINDEX_REQUIRED"].every((state) => knowledgeStates.has(state as never)),
    "知识库解析状态覆盖完整",
  );
  check(community.resources.some(({ visibility }) => visibility === "ADMINS"), "仅管理员可见资料已建立");
  const memberKnowledgeContext = await communityKnowledgeContext({
    communityId: community.id,
    query: "请根据本群资料说明观察、解释和应用三个步骤",
    includeAdminResources: false,
  });
  check(
    memberKnowledgeContext.includes("《资料标题》") &&
      memberKnowledgeContext.includes("【验收】青年查经计划") &&
      !memberKnowledgeContext.includes("【验收】管理员带领说明"),
    "成员知识检索包含引用规则且隔离管理员资料",
  );
  const adminKnowledgeContext = await communityKnowledgeContext({
    communityId: community.id,
    query: "处理成员申请前需要做什么",
    includeAdminResources: true,
  });
  check(
    adminKnowledgeContext.includes("【验收】管理员带领说明") &&
      !adminKnowledgeContext.includes("【验收】解析失败的音频"),
    "管理员可检索专属资料且失败资料不会进入回答上下文",
  );
  check(community.auditLogs.some(({ action }) => action === "VALIDATION_FIXTURES_READY"), "社群审计记录可用");

  const notificationTypes = new Set(
    (await db.userNotification.findMany({
      where: { uniqueKey: { startsWith: "validation:" } },
      select: { type: true },
    })).map(({ type }) => type),
  );
  check(
    ["EVENT_REMINDER", "COMMENT_REPLY", "JOIN_REQUEST", "JOIN_REVIEW", "AI_TASK", "DAILY_VERSE"]
      .every((type) => notificationTypes.has(type as never)),
    "活动、评论、入群审核、AI 和每日金句通知测试数据完整",
  );

  console.log("\n社群验证数据检查通过。可使用 @openbible.local 测试账号进行页面验收。");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
