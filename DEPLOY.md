# OpenBible 部署指南

## 架构一览

```
ob-cn-main/
├── admin-app/    唯一后端（Next.js）：/admin 管理台 · /read 网页版 · /api/mobile/* · /api/web/*
├── mobile-app/   App 前端（Vite + React + Capacitor），构建产物为静态文件
├── web-app/      网页版静态资源（index.html/js/css/vendor），由 admin-app 经 /read 与 public/ 符号链接提供
├── data/         圣经数据 JSON（两端共用，只读）
└── _archive/     已下线的旧 FastAPI 后端（仅存档，不部署）
```

生产环境只需要部署 **admin-app 一个服务** + 静态托管 mobile-app 构建产物（或打包进 Capacitor 壳）。

## admin-app（后端 + 管理台 + 网页版）

### 环境变量（.env / 部署平台密钥）

上线前先跑一遍自检，它会列出缺哪些变量、各自会导致什么功能不可用：

```bash
cd admin-app && npm run check:config
```

必需项缺失时退出码为 1，可直接接进部署流程卡住发布。

| 变量 | 说明 |
|---|---|
| `DATABASE_URL` | **必需**。PostgreSQL 连接串（生产用真实 PG，本地开发是 `prisma dev` 的 PGlite） |
| `AUTH_SECRET` | **必需**。管理台登录（NextAuth）的会话密钥，≥32 字符：`openssl rand -base64 32`。管理员账号在数据库里按角色授权，没有「管理台密码」这种环境变量 |
| `APP_URL` | **生产必需**，须为 https。Apple 回调地址与邮件里的链接都基于它拼装 |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` / `SMTP_USER` / `SMTP_PASS` / `EMAIL_FROM` | 登录验证码发信；未配置时验证码只打到服务端日志（仅适合开发） |
| `GOOGLE_WEB_CLIENT_ID` | Google 登录，见下方「第三方登录」。生产留空 = 关闭该入口 |
| `APPLE_CLIENT_ID` / `APPLE_TEAM_ID` / `APPLE_KEY_ID` / `APPLE_PRIVATE_KEY_PATH` | Apple 登录；配不全则入口自动隐藏 |
| `COMMUNITY_UPLOAD_DIR` | 社群头像/附件的存放目录。**生产务必指向持久化卷**，否则重新部署即丢失 |
| `OPENBIBLE_LLM_API_KEY` / `OPENBIBLE_LLM_BASE_URL` / `OPENBIBLE_LLM_MODEL` | 慧读 LLM 网关；未配置时 AI 接口走确定性模板降级，页面仍可用 |
| `BIBLE_DATA_DIR` | 可选，圣经数据目录；默认 `../data` |
| `OPENBIBLE_TEST_LOGIN_CODE` | **仅开发**：万能测试验证码，生产环境必须不设置（代码里已限 `NODE_ENV !== "production"`，自检也会拦截） |

### 第三方登录（三端必须同一个 client ID）

`GOOGLE_WEB_CLIENT_ID` 是三端唯一真相，三处必须完全一致，否则 Google 会正常签发 token
而服务端在校验 audience 时以 **401** 拒绝——现象是「点了 Google 登录没反应」：

| 位置 | 取值方式 |
|---|---|
| 服务端校验 | `GOOGLE_WEB_CLIENT_ID`（`lib/google-login.ts` 的 `googleWebClientId()`） |
| 网页版 | 运行时向 `/api/web/config/auth` 拉取，自动与服务端一致，无需单独配置 |
| App 端 | 构建时的 `VITE_GOOGLE_WEB_CLIENT_ID`，**需手动填成同一个值** |

未配置时（生产环境不会回落到仓库里的开发演示凭据）：网页版与 App 端的 Google 入口自动隐藏，
服务端对 Google 登录返回 503 并提示改用邮箱验证码。Apple 同理，由 `appleConfigured()` 统一判定。

### 构建与启动

```bash
cd admin-app
npm ci
npx prisma generate
npx prisma migrate deploy   # 应用 prisma/migrations/，只前进不回滚
npm run build               # next build（含类型检查）
npm start                   # next start，生产默认开启 gzip
```

### 静态资源符号链接（重要）

`admin-app/public/` 里的 `js` `css` `images` `vendor` 指向 `../../web-app/*`，`data` 指向 `../../data`。
**部署时必须保留符号链接**（rsync 加 `--links`；Docker 里 COPY 整个仓库即可）。若平台不支持符号链接，把对应目录复制为实体目录。

### 数据库迁移流程

- 生产：`npx prisma migrate deploy`（CI/发布脚本里跑）。
- 本地开发库无 shadow DB，`migrate dev` 会失败；新迁移用
  `prisma migrate diff --from-config-datasource --to-schema` 生成 SQL → 手建 `prisma/migrations/<timestamp>_<name>/migration.sql` → `migrate deploy`。

### 备份

- 数据库：每日 `pg_dump -Fc "$DATABASE_URL" > backup-$(date +%F).dump`，保留 30 天；恢复用 `pg_restore`。
- 文件：`admin-app/uploads/`（用户头像等）随数据库同频备份。
- `data/` 是版本库内静态资产，不需要单独备份。

## mobile-app（App 前端）

```bash
cd mobile-app
npm ci
# 要启用 Google 登录就必须传，且与服务端 GOOGLE_WEB_CLIENT_ID 完全一致；
# 不传则正式包里 Google 入口不可用（不会回落到开发演示凭据）。
VITE_GOOGLE_WEB_CLIENT_ID=<与服务端相同的 client ID> npm run build   # 产物在 dist/
npx cap sync         # 同步进 iOS/Android 壳（需要发 App 时）
```

Web 直接托管 `dist/`（任意静态托管/CDN）。App 内 `/api/*` 请求由静态站点反代到 admin-app 同域，登录 Cookie 才是第一方（见 `api/mobile/auth/send-code/route.ts` 顶部注释）。

## 测试

```bash
cd admin-app && npm test    # vitest，覆盖网页兼容层/AI 底座/笔记翻译/AI 路由降级
```

## 已知待办

- mobile-app 单包 672KB gzip（圣经数据静态打包所致），后续用动态 import 分包。
- 阅读位置跨端同步未做（后端无模型，需迁移）。
- 在线支付（Stripe）代码保留但入口已拦截，后端未实现 /api/web/payment/*。
