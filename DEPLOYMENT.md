# 部署记录

## 服务器

- 地址：`43.99.101.9`
- SSH 用户：`root`
- 身份文件：`~/.ssh/id_ed25519`
- 连接命令：

  ```bash
  ssh -i ~/.ssh/id_ed25519 root@43.99.101.9
  ```

## 现有部署配置

- Docker Compose：`deploy/docker-compose.yml`
- Nginx 配置：`deploy/app-nginx.conf`
- 管理端域名：`https://admin.openbible.live`

## 安全说明

SSH 私钥、数据库密码和应用密钥不得提交到仓库。部署密钥应通过服务器环境变量或未纳入版本控制的环境文件提供。

## 社群工作区版本发布顺序

本版本包含数据库迁移 `20260722090000_community_workspace`。先在测试环境验证，再更新生产环境：

1. 构建移动端静态文件：

   ```bash
   npm --prefix mobile-app ci
   npm --prefix mobile-app run build
   ```

2. 在 `deploy/.env` 中配置现有 `DB_PASSWORD`、`AUTH_SECRET` 等变量。不要把该文件提交到仓库。

3. 启动数据库并等待健康检查：

   ```bash
   docker compose --env-file deploy/.env -f deploy/docker-compose.yml up -d db
   ```

4. 执行迁移前备份数据库；备份文件保存在服务器受限目录，不放入仓库。

5. 构建新的后台镜像并执行迁移：

   ```bash
   docker compose --env-file deploy/.env -f deploy/docker-compose.yml build admin
   docker compose --env-file deploy/.env -f deploy/docker-compose.yml run --rm admin npx prisma migrate deploy
   ```

6. 启动后台和移动端：

   ```bash
   docker compose --env-file deploy/.env -f deploy/docker-compose.yml up -d admin app
   ```

7. 验证登录、社群六栏目、内容审核和 `/api/mobile/me` 后再切换流量。

迁移会统一团体会员目录为人民币：初阶免费、中阶 ¥30/月、高阶 ¥98/月，但本阶段不会开通真实扣费。
