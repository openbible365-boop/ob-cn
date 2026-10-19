from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import update, delete
from backend.model.user import User
from backend.schema.user import UserCreate

async def get_user_by_email(db: AsyncSession, email: str) -> Optional[User]:
    """根据邮箱获取用户"""
    result = await db.execute(select(User).where(User.email == email))
    return result.scalars().first()

async def get_user_by_email_or_username(db: AsyncSession, identifier: str) -> Optional[User]:
    """根据邮箱或用户名获取用户"""
    from sqlalchemy import or_
    result = await db.execute(select(User).where(or_(User.email == identifier, User.username == identifier)))
    return result.scalars().first()

async def get_user_by_google_id(db: AsyncSession, google_id: str) -> Optional[User]:
    """根据 Google ID 获取用户"""
    result = await db.execute(select(User).where(User.google_id == google_id))
    return result.scalars().first()

async def create_user(db: AsyncSession, user: UserCreate, hashed_password: Optional[str] = None) -> User:
    """创建新用户"""
    db_user = User(
        email=user.email,
        username=user.username,
        google_id=user.google_id,
        hashed_password=hashed_password,
        avatar_url=user.avatar_url,
        role=user.role if user.role else "user"
    )
    db.add(db_user)
    await db.commit()
    await db.refresh(db_user)
    return db_user

async def get_users(db: AsyncSession, skip: int = 0, limit: int = 100) -> list[User]:
    """分页获取所有用户"""
    result = await db.execute(select(User).offset(skip).limit(limit))
    return list(result.scalars().all())

async def get_user_by_id(db: AsyncSession, user_id: int) -> Optional[User]:
    """根据用户 ID 获取用户"""
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalars().first()

async def get_user_by_subscription_id(db: AsyncSession, sub_id: str) -> Optional[User]:
    """根据 Stripe 订阅 ID 获取用户"""
    result = await db.execute(select(User).where(User.stripe_subscription_id == sub_id))
    return result.scalars().first()

async def update_user(db: AsyncSession, user: User, update_data: dict) -> User:
    """更新用户信息"""
    for key, value in update_data.items():
        setattr(user, key, value)
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user
