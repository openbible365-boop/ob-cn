"""AI 接口准入控制：IP 限流(全员兜底) + 登录用户按套餐月配额 / 匿名按 IP 日上限。

设计（两者结合）：
  1) 全员：同一 IP 的 AI 调用做突发限流，挡批量刷。
  2) 登录用户：按其套餐 support_plans.dialogue_limit 限制「每月对话次数」，
     用量直接统计 AILog 中本月、计费类交互(METERED_TYPES)的行数(已带 user_id)。
  3) 匿名用户：无法按用户计数，改用更严格的「每日 IP 上限」，并提示登录。
"""
import time
from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException, Request
from sqlalchemy import select, func

from backend.core import ratelimit
from backend.model.ai import AILog
from backend.model.support_plan import SupportPlan
from backend.repository.user import get_user_by_id

# 计入「每月对话配额」的交互类型（端点须以这些 type + user_id 落 AILog 才会被计数）
METERED_TYPES = ("自由问答", "标签解释")

# 套餐对话上限的兜底（DB 未配置 dialogue_limit 时使用）
_DEFAULT_LIMITS = {"free": 20, "basic": 100, "pro": 300, "supporter": 400}

# 全员 IP 突发限流
_IP_BURST_LIMIT = 40
_IP_BURST_WINDOW = 60
# 匿名「计费类」调用的每日 IP 上限（鼓励登录）
_ANON_DAILY_LIMIT = 40
_ANON_DAILY_WINDOW = 86400

# 套餐上限的进程内缓存，避免每次 AI 调用都查库
_plan_cache: dict[str, int] = {}
_plan_cache_ts = 0.0
_PLAN_CACHE_TTL = 300  # 秒


def _client_ip(request: Request) -> str:
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _decode_user_id(token: Optional[str]) -> Optional[int]:
    """从 JWT 解析 user_id（sub）。与 api/deps.py 的解码方式一致。"""
    if not token:
        return None
    try:
        from jose import jwt
        from backend.core.config import settings
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        sub = payload.get("sub")
        return int(sub) if sub is not None else None
    except Exception:
        return None


def _month_start_utc() -> datetime:
    now = datetime.now(timezone.utc)
    return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


def _effective_plan(user) -> str:
    plan = user.plan or "free"
    exp = getattr(user, "plan_expires_at", None)
    if plan != "free" and exp is not None and exp < datetime.now(timezone.utc):
        return "free"  # 已过期 → 降级 free
    return plan


async def _plan_limit(db, plan: str) -> int:
    global _plan_cache, _plan_cache_ts
    now = time.time()
    if not _plan_cache or now - _plan_cache_ts > _PLAN_CACHE_TTL:
        try:
            rows = (await db.execute(select(SupportPlan.id, SupportPlan.dialogue_limit))).all()
            _plan_cache = {r[0]: int(r[1]) for r in rows if r[1]}
            _plan_cache_ts = now
        except Exception:
            pass
    return _plan_cache.get(plan) or _DEFAULT_LIMITS.get(plan, _DEFAULT_LIMITS["free"])


async def _month_usage(db, user_id: int) -> int:
    stmt = select(func.count(AILog.id)).where(
        AILog.user_id == user_id,
        AILog.created_at >= _month_start_utc(),
        AILog.interaction_type.in_(METERED_TYPES),
    )
    return int(await db.scalar(stmt) or 0)


async def guard_ai_request(request: Request, db, token: Optional[str], metered: bool = True) -> Optional[int]:
    """AI 接口准入。返回解析出的 user_id（用于落 AILog 计费）；超限抛 429。"""
    ip = _client_ip(request)
    ok, retry = ratelimit.hit(f"ai:ip:{ip}", _IP_BURST_LIMIT, _IP_BURST_WINDOW)
    if not ok:
        raise HTTPException(status_code=429, detail="请求过于频繁，请稍后再试。",
                            headers={"Retry-After": str(retry)})

    user_id = _decode_user_id(token)
    if not metered:
        return user_id

    if user_id is not None:
        user = await get_user_by_id(db, user_id)
        if user:
            limit = await _plan_limit(db, _effective_plan(user))
            used = await _month_usage(db, user_id)
            if used >= limit:
                raise HTTPException(
                    status_code=429,
                    detail=f"本月 AI 对话次数已用完（上限 {limit} 次）。下月自动恢复，或升级套餐获取更多。",
                )
            return user_id

    # 匿名计费类调用：更严格的每日 IP 上限
    ok, retry = ratelimit.hit(f"ai:anon:{ip}", _ANON_DAILY_LIMIT, _ANON_DAILY_WINDOW)
    if not ok:
        raise HTTPException(status_code=429, detail="今日匿名 AI 使用已达上限，请登录后继续使用。",
                            headers={"Retry-After": str(retry)})
    return user_id
