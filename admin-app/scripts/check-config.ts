// 部署前配置自检：npm run check:config
//
// 上线时最容易出的问题不是代码错，而是某个环境变量没配 —— 现象往往是
// 「按钮点了没反应」或「验证码收不到」，很难从日志一眼看出。这个脚本把
// 这些依赖一次性列清楚：哪些必须配、哪些没配会导致对应功能不可用。
//
// 退出码：缺必需项 → 1（可直接卡住 CI/部署流程），其余 → 0。
import { existsSync } from "node:fs";
import { loadEnv } from "./load-env";

loadEnv();

type Check = {
  name: string;
  ok: boolean;
  detail: string;
};

const env = (key: string) => process.env[key]?.trim() ?? "";
const results: Check[] = [];
const required: Check[] = [];

function require_(name: string, ok: boolean, detail: string) {
  required.push({ name, ok, detail });
}
function optional(name: string, ok: boolean, detail: string) {
  results.push({ name, ok, detail });
}

// ── 必需：缺了服务根本跑不起来或不安全 ──
const isProd = process.env.NODE_ENV === "production";

require_("DATABASE_URL", Boolean(env("DATABASE_URL")), "数据库连接串");
require_(
  "AUTH_SECRET",
  env("AUTH_SECRET").length >= 32 && env("AUTH_SECRET") !== "change-me",
  "后台登录会话密钥，需 ≥32 字符且不能是 change-me（生成：openssl rand -base64 32）",
);
// 本地开发用 localhost origin 兜底即可，只有正式域名才必须显式配置
if (isProd) {
  require_(
    "APP_URL",
    /^https:\/\//.test(env("APP_URL")),
    "站点公网地址，必须是 https（Apple 回调、邮件链接都依赖它）",
  );
}

// ── 可选：缺了对应功能不可用，但服务能起 ──
const smtpKeys = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "EMAIL_FROM"];
const smtpMissing = smtpKeys.filter((k) => !env(k));
optional(
  "邮箱验证码登录（SMTP）",
  smtpMissing.length === 0,
  smtpMissing.length === 0
    ? `经由 ${env("SMTP_HOST")} 发信`
    : `缺 ${smtpMissing.join(", ")} —— 验证码只会打印到服务端日志，用户收不到邮件`,
);

optional(
  "Google 登录",
  Boolean(env("GOOGLE_WEB_CLIENT_ID")),
  env("GOOGLE_WEB_CLIENT_ID")
    ? "已配置；请确认 App 端构建时的 VITE_GOOGLE_WEB_CLIENT_ID 与此完全一致"
    : "未配置 GOOGLE_WEB_CLIENT_ID —— 三端的 Google 登录入口都会隐藏",
);

const applePrivateKey =
  Boolean(env("APPLE_PRIVATE_KEY")) ||
  (Boolean(env("APPLE_PRIVATE_KEY_PATH")) && existsSync(env("APPLE_PRIVATE_KEY_PATH")));
const appleReady =
  Boolean(env("APPLE_CLIENT_ID") && env("APPLE_TEAM_ID") && env("APPLE_KEY_ID")) && applePrivateKey;
optional(
  "Apple 登录",
  appleReady,
  appleReady
    ? "已配置"
    : "缺 APPLE_CLIENT_ID / APPLE_TEAM_ID / APPLE_KEY_ID / 私钥 —— Apple 登录入口会隐藏",
);

optional(
  "慧读 AI",
  Boolean(env("OPENBIBLE_LLM_API_KEY")),
  env("OPENBIBLE_LLM_API_KEY") ? "已配置" : "未配置 OPENBIBLE_LLM_API_KEY —— 慧读问答不可用",
);

optional(
  "社群文件存储",
  Boolean(env("COMMUNITY_UPLOAD_DIR")),
  env("COMMUNITY_UPLOAD_DIR")
    ? env("COMMUNITY_UPLOAD_DIR")
    : "未配置 COMMUNITY_UPLOAD_DIR —— 头像/附件写在默认目录，重新部署会丢失",
);

// ── 生产环境专有的危险项 ──
if (isProd && env("OPENBIBLE_TEST_LOGIN_CODE")) {
  required.push({
    name: "OPENBIBLE_TEST_LOGIN_CODE",
    ok: false,
    detail: "生产环境不应设置万能测试验证码，请删除该变量",
  });
}

// ── 输出 ──
const mark = (ok: boolean) => (ok ? "✓" : "✗");
console.log(`\n配置自检（NODE_ENV=${process.env.NODE_ENV ?? "development"}）\n`);

console.log("必需项：");
for (const c of required) console.log(`  ${mark(c.ok)} ${c.name} —— ${c.detail}`);

console.log("\n功能开关（未配置即该功能关闭）：");
for (const c of results) console.log(`  ${mark(c.ok)} ${c.name} —— ${c.detail}`);

const missing = required.filter((c) => !c.ok);
if (missing.length) {
  console.error(`\n必需项缺失 ${missing.length} 项，不可上线。\n`);
  process.exit(1);
}
console.log("\n必需项齐备。\n");
