#!/usr/bin/env bash
set -euo pipefail

# 从本地把 llm-chat 后端部署到 VPS。
# LLM 后端暴露宿主机 8002 端口, 由已有的 ko-tts Caddy 统一反代 llm.ezra76.com。
# 用法: ./deploy/deploy.sh [VPS_HOST]

VPS_HOST="${1:-root@43.99.101.9}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/id_ed25519}"
REMOTE_DIR="/opt/llm-chat"
DOMAIN="llm.ezra76.com"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_PROD="${SCRIPT_DIR}/.env.prod"

COMPOSE="docker compose -f docker-compose.prod.yml"

step() { echo; echo ">>> $*"; }
remote() { ssh -i "${SSH_KEY}" "${VPS_HOST}" "$@"; }

# 1. 检查本地 .env.prod
step "[1/7] 检查本地 ${ENV_PROD}"
if [[ ! -f "${ENV_PROD}" ]]; then
  echo "错误: 缺少 ${ENV_PROD}" >&2
  echo "请先: cp deploy/.env.prod.example deploy/.env.prod 并填值。" >&2
  exit 1
fi
echo "OK"

# 2. rsync 同步项目
step "[2/7] rsync -> ${VPS_HOST}:${REMOTE_DIR}/"
rsync -az --delete \
  -e "ssh -i ${SSH_KEY}" \
  --exclude '.git' \
  --exclude '.venv' \
  --exclude '__pycache__' \
  --exclude 'node_modules' \
  --exclude '*.pyc' \
  --exclude '*.pdf' \
  --exclude '.env' \
  --exclude '/data/' \
  --exclude '/logs/' \
  --exclude '/.models/' \
  --exclude '/.sepvenv/' \
  --exclude '/.minio-data/' \
  --exclude '/.dev/' \
  --exclude 'backend/uploads/' \
  --exclude 'gpu-service/uploads/' \
  "${REPO_ROOT}/" "${VPS_HOST}:${REMOTE_DIR}/"
echo "OK"

# 3. 部署 .env
step "[3/7] 部署 .env.prod -> ${REMOTE_DIR}/deploy/.env"
remote "cp '${REMOTE_DIR}/deploy/.env.prod' '${REMOTE_DIR}/deploy/.env' && chmod 600 '${REMOTE_DIR}/deploy/.env'"
echo "OK"

# 3.5. 确保持久化目录存在且权限正确
# NOTE: uploads 目录挂载到容器内 /app/uploads，容器以 app(uid=999) 运行，
# 宿主机目录必须对 uid=999 可写，否则上传文件会报 Permission denied (500)
step "[3.5/7] 初始化持久化目录权限"
remote "mkdir -p /opt/llm/data/uploads && chmod 777 /opt/llm/data/uploads"
echo "OK"

# 4. 构建镜像
step "[4/7] docker compose build"
remote "cd '${REMOTE_DIR}/deploy' && ${COMPOSE} build"

# 5. 启动服务
step "[5/7] docker compose up -d"
remote "cd '${REMOTE_DIR}/deploy' && ${COMPOSE} up -d"

# 6. 数据库迁移
step "[6/7] 等待 10s 后 alembic upgrade head"
sleep 10
remote "cd '${REMOTE_DIR}/deploy' && ${COMPOSE} exec -T backend alembic upgrade head"

# 7. 健康检查（经由公网 Caddy TLS）
step "[7/7] 健康检查 https://${DOMAIN}/health"
sleep 3
if curl -fsS --max-time 15 "https://${DOMAIN}/health" >/dev/null; then
  echo
  echo "✅ 部署成功, /health 正常。"
else
  echo
  echo "⚠️  公网健康检查失败（可能 DNS 未生效或 Caddy 未配置）。"
  echo "   直接检查: ssh ${VPS_HOST} 'curl -s http://127.0.0.1:8002/health'"
  echo "   排查日志: ssh ${VPS_HOST} 'cd ${REMOTE_DIR}/deploy && ${COMPOSE} logs --tail=50'"
fi
