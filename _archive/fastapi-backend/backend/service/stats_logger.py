from __future__ import annotations

import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from backend.model.stats import UserActionLog


async def _write_log_entry(**kwargs) -> None:
    """
    在独立的数据库 session 中写入统计日志。
    NOTE: 使用独立 session 而非主请求 session，防止 commit 阻塞正在进行的数据读取。
    """
    from backend.core.database import AsyncSessionLocal
    try:
        async with AsyncSessionLocal() as session:
            log_entry = UserActionLog(**kwargs)
            session.add(log_entry)
            await session.commit()
    except Exception:
        # NOTE: 统计写入失败不应影响主业务，静默丢弃
        pass


def log_user_action(
    db: AsyncSession,          # 保持参数兼容，但不再使用该 session
    action_type: str,
    user_id: int | None = None,
    book: str | None = None,
    chapter: int | None = None,
    version_used: str | None = None,
    duration: int | None = None,
    playback_rate: float | None = None,
    ip_address: str | None = None,
    country: str | None = None,
    region: str | None = None,
    city: str | None = None
) -> None:
    """
    通用用户业务行为记录打点（fire-and-forget，不阻塞主请求）
    action_type 建议取值:
      - 'login' (常规登录或Google登录)
      - 'read' (请求阅读经文)
      - 'audio_play' (开始播放音频)
      - 'audio_complete' (播放结束)
    """
    # HACK: 用 asyncio.ensure_future 发射后不管，让日志写入在后台完成
    # 这样主请求可以立即返回，不被 DB commit 阻塞
    asyncio.ensure_future(_write_log_entry(
        user_id=user_id,
        action_type=action_type,
        book=book,
        chapter=chapter,
        version_used=version_used,
        duration=duration,
        playback_rate=playback_rate,
        ip_address=ip_address,
        country=country,
        region=region,
        city=city,
    ))
