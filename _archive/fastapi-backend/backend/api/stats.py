from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, case
from typing import Any, Dict, Optional, List
from datetime import datetime, timedelta

from backend.core.database import get_db
from backend.model.user import User
from backend.api.deps import get_current_admin
from backend.model.stats import UserActionLog
from backend.model.ai import AILog

router = APIRouter(prefix="/api/admin/stats", tags=["stats"])

@router.get("/reading", response_model=Dict[str, Any])
async def get_reading_stats(
    start_date: str = Query(..., description="YYYY-MM-DD"),
    end_date: str = Query(..., description="YYYY-MM-DD"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """
    阅读统计数据
    """
    sd = datetime.fromisoformat(start_date)
    ed = datetime.fromisoformat(end_date) + timedelta(days=1)
    
    # 基础过滤条件: action_type="read" 并且在时间范围内
    base_query = select(UserActionLog).where(
        UserActionLog.action_type == "read",
        UserActionLog.created_at >= sd,
        UserActionLog.created_at < ed
    )
    
    # 获取总人次（只要有记录算一次）
    total_reads_res = await db.execute(select(func.count(UserActionLog.id)).where(
        UserActionLog.action_type == "read", UserActionLog.created_at >= sd, UserActionLog.created_at < ed
    ))
    total_reads = total_reads_res.scalar_one_or_none() or 0

    # 热度排行（按书卷）
    book_rank_res = await db.execute(
        select(UserActionLog.book, func.count(UserActionLog.id).label("count"))
        .where(UserActionLog.action_type == "read", UserActionLog.created_at >= sd, UserActionLog.created_at < ed)
        .group_by(UserActionLog.book)
        .order_by(desc("count"))
        .limit(20)
    )
    book_ranks = [{"name": row.book, "count": row.count} for row in book_rank_res.all()]
    
    return {
        "summary": {
            "total_reads": total_reads,
            "total_chapters": total_reads, # 在按章阅读模式下阅读人次近似于总章节数
            "avg_chapters_per_person": round(total_reads/1, 2) if total_reads else 0 # 临时逻辑
        },
        "book_ranking": book_ranks
    }

@router.get("/audio", response_model=Dict[str, Any])
async def get_audio_stats(
    start_date: str = Query(...),
    end_date: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """
    音频统计数据 
    """
    sd = datetime.fromisoformat(start_date)
    ed = datetime.fromisoformat(end_date) + timedelta(days=1)

    # 时长/次数聚合
    agg_res = await db.execute(
        select(
            func.count(UserActionLog.id), 
            func.sum(UserActionLog.duration)
        ).where(
            UserActionLog.action_type == "audio_complete",
            UserActionLog.created_at >= sd,
            UserActionLog.created_at < ed
        )
    )
    row = agg_res.first()
    total_plays = row[0] or 0
    total_duration_seconds = row[1] or 0

    return {
        "summary": {
            "total_plays": total_plays,
            "total_duration_hours": round(total_duration_seconds / 3600, 2)
        }
    }

@router.get("/login", response_model=Dict[str, Any])
async def get_login_stats(
    start_date: str = Query(...),
    end_date: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """
    登录统计数据
    """
    sd = datetime.fromisoformat(start_date)
    ed = datetime.fromisoformat(end_date) + timedelta(days=1)
    
    agg_res = await db.execute(
        select(
            func.count(UserActionLog.id), 
            func.count(func.distinct(UserActionLog.user_id))
        ).where(
            UserActionLog.action_type == "login",
            UserActionLog.created_at >= sd,
            UserActionLog.created_at < ed
        )
    )
    row = agg_res.first()
    total_logins = row[0] or 0
    unique_users = row[1] or 0
    
    return {
        "summary": {
            "total_logins": total_logins,
            "unique_users": unique_users
        }
    }

@router.get("/ai-logs", response_model=Dict[str, Any])
async def list_ai_logs(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """
    获取 AI 对话明细流水列表
    """
    total_res = await db.execute(select(func.count(AILog.id)))
    total = total_res.scalar_one_or_none() or 0
    
    logs_res = await db.execute(
        select(AILog).order_by(AILog.created_at.desc()).offset(skip).limit(limit)
    )
    logs = logs_res.scalars().all()
    
    return {
        "total": total,
        "items": [{
            "id": log.id,
            "user_id": log.user_id,
            "interaction_type": log.interaction_type,
            "prompt_summary": log.prompt_summary,
            "reference": log.reference,
            "model_name": log.model_name,
            "tokens": log.tokens_in + log.tokens_out,
            "latency_ms": log.latency_ms,
            "created_at": log.created_at.isoformat()
        } for log in logs]
    }
