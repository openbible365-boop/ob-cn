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
