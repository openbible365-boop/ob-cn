from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Generator
from backend.core.database import get_db
from backend.core.config import settings
from backend.model.user import User
from backend.repository import user as user_repo

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/api/auth/login"
)

async def get_current_user(
    db: AsyncSession = Depends(get_db),
    token: str = Depends(oauth2_scheme)
) -> User:
    """根据 Token 获取当前用户"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="认证失败或Token过期",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id_str: str = payload.get("sub")
        if user_id_str is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    # 查找用户（这里的 user_id_str 其实在存储时用的是 user_id，我们需要查询）
    # 但是我们也可以查询时通过 email 或 id，取决于上面的 sub 是什么，这里假设 sub 是 user.id
    try:
        user_id = int(user_id_str)
    except ValueError:
        raise credentials_exception
    
    # 因为 repository 里没有 get_user_by_id，我们可以直接写：
    from sqlalchemy.future import select
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    if user is None:
        raise credentials_exception
    if not user.is_active:
        raise HTTPException(status_code=400, detail="该账户已被禁用")
    return user

async def get_current_admin(current_user: User = Depends(get_current_user)) -> User:
    """获取当前管理员用户"""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="权限不足：需要管理员权限"
        )
    return current_user
