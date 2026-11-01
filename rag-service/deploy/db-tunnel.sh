#!/usr/bin/env bash
# 只读连接生产香港库 (阿里云 43.99.101.9) —— 经 SSH 隧道, 不改生产任何东西。
#
# 生产 Postgres 在 Docker 内网, 5432 不对外, ufw 只放 80/443。本脚本在服务器上
# 动态查出 postgres 容器的内网 IP, 用 SSH 本地端口转发把它映射到本机 15432。
#
#   ./deploy/db-tunnel.sh           开隧道 (前台保持); 另开终端用 psql 连 127.0.0.1:15432
#   ./deploy/db-tunnel.sh psql      开隧道并直接进 psql (强制只读会话), 退出即关隧道
#
# 覆盖默认值:  VPS_HOST=deploy@1.2.3.4  SSH_KEY=~/.ssh/other  LOCAL_PORT=15433  ./deploy/db-tunnel.sh

set -euo pipefail

VPS_HOST="${VPS_HOST:-root@43.99.101.9}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/id_ed25519}"
REMOTE_DIR="${REMOTE_DIR:-/opt/ko-tts/deploy}"
COMPOSE="${COMPOSE:-docker compose -f docker-compose.prod.yml}"
LOCAL_PORT="${LOCAL_PORT:-15432}"

ssh_run() { ssh -i "$SSH_KEY" "$VPS_HOST" "$@"; }

echo "▶ 解析生产 postgres 容器 (${VPS_HOST})…"
CID="$(ssh_run "cd $REMOTE_DIR && $COMPOSE ps -q postgres")"
[[ -n "$CID" ]] || { echo "❌ 没找到 postgres 容器, 它没在跑?" >&2; exit 1; }
PG_IP="$(ssh_run "docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' $CID")"
[[ -n "$PG_IP" ]] || { echo "❌ 取容器 IP 失败" >&2; exit 1; }
echo "  容器 $CID  内网 IP $PG_IP"

# 从远端 .env 读出账号/库名 (密码也读, 但仅用于本会话, 不打印)
PG_USER="$(ssh_run "grep -E '^POSTGRES_USER=' $REMOTE_DIR/.env | cut -d= -f2-" || true)"
PG_DB="$(ssh_run "grep -E '^POSTGRES_DB=' $REMOTE_DIR/.env | cut -d= -f2-" || true)"
PG_USER="${PG_USER:-kotts}"; PG_DB="${PG_DB:-kotts}"

mode="${1:-tunnel}"

if [[ "$mode" == "psql" ]]; then
  PG_PASS="$(ssh_run "grep -E '^POSTGRES_PASSWORD=' $REMOTE_DIR/.env | cut -d= -f2-")"
  echo "▶ 开隧道 127.0.0.1:$LOCAL_PORT → $PG_IP:5432 …"
  ssh -i "$SSH_KEY" -f -N -L "$LOCAL_PORT:$PG_IP:5432" "$VPS_HOST"
  TUN_PID="$(pgrep -f "ssh.*-L $LOCAL_PORT:$PG_IP:5432 $VPS_HOST" | head -1 || true)"
  trap '[[ -n "${TUN_PID:-}" ]] && kill "$TUN_PID" 2>/dev/null; echo; echo "已关隧道"' EXIT
  sleep 1
  echo "▶ 进入 psql (会话强制只读: 任何写/DDL 都会报错)"
  # PGOPTIONS 在整个会话开启 default_transaction_read_only, 防误改生产
  PGPASSWORD="$PG_PASS" PGOPTIONS="-c default_transaction_read_only=on" \
    psql -h 127.0.0.1 -p "$LOCAL_PORT" -U "$PG_USER" -d "$PG_DB"
else
  echo "▶ 开隧道 (前台, Ctrl-C 关闭): 127.0.0.1:$LOCAL_PORT → $PG_IP:5432"
  echo
  echo "  另开一个终端, 只读连接:"
  echo "    PGOPTIONS='-c default_transaction_read_only=on' \\"
  echo "      psql -h 127.0.0.1 -p $LOCAL_PORT -U $PG_USER -d $PG_DB"
  echo "  (密码在服务器 $REMOTE_DIR/.env 的 POSTGRES_PASSWORD)"
  echo
  echo "  或临时把 backend/.env 指过来 (只读看, 别跑 worker/alembic):"
  echo "    database_url=postgresql+asyncpg://$PG_USER:<密码>@127.0.0.1:$LOCAL_PORT/$PG_DB"
  echo
  exec ssh -i "$SSH_KEY" -N -L "$LOCAL_PORT:$PG_IP:5432" "$VPS_HOST"
fi
