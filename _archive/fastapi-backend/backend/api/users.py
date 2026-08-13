from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Any
from backend.core.database import get_db
from backend.repository import user as user_repo
from backend.schema.user import UserResponse
from backend.api.deps import get_current_admin, get_current_user
from backend.model.user import User
from backend.model.stats import UserActionLog
from backend.model.ai import AILog
from sqlalchemy import func

router = APIRouter(prefix="/api/admin/users", tags=["admin"])
public_router = APIRouter(prefix="/api/users", tags=["users"])

@router.get("/", response_model=List[UserResponse])
async def read_users(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
) -> Any:
    """后台管理：获取用户列表"""
    users = await user_repo.get_users(db, skip=skip, limit=limit)
    return users

from backend.schema.user import UserUpdate
from sqlalchemy.future import select

@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    user_in: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
) -> Any:
    """后台管理：管理员更新用户状态或角色"""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="用户未找到")
    
    update_data = user_in.model_dump(exclude_unset=True)
    user = await user_repo.update_user(db, user, update_data)
    return user


@public_router.get("/me/stats")
async def get_my_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """前台体验：获取当前登录用户的各项操作统计"""
    # 统计阅读文章/经卷次数
    read_count = await db.scalar(
        select(func.count(UserActionLog.id))
        .where(UserActionLog.user_id == current_user.id)
        .where(UserActionLog.action_type == "read")
    )
    
    # 统计完整收听次数
    audio_count = await db.scalar(
        select(func.count(UserActionLog.id))
        .where(UserActionLog.user_id == current_user.id)
        .where(UserActionLog.action_type == "audio_complete")
    )
    
    # 统计 AI 对话被调用次数
    ai_count = await db.scalar(
        select(func.count(AILog.id))
        .where(AILog.user_id == current_user.id)
    )
    
    return {
        "reading_count": read_count or 0,
        "audio_count": audio_count or 0,
        "ai_count": ai_count or 0
    }
