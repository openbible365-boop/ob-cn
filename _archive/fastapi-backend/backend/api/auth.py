from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import timedelta
from typing import Any

from backend.core.database import get_db
from backend.core.config import settings
from backend.service import auth as auth_service
from backend.repository import user as user_repo
from backend.schema.user import UserCreate, UserResponse, GoogleLogin
from backend.api.deps import get_current_user
from backend.model.user import User

router = APIRouter(prefix="/api/auth", tags=["auth"])

@router.post("/register", response_model=Any)
async def register_user(
    payload: UserCreate,
    db: AsyncSession = Depends(get_db)
) -> Any:
    """普通用户注册"""
    if not payload.password:
        raise HTTPException(status_code=400, detail="注册需要提供密码")
    
    existing_user = await user_repo.get_user_by_email(db, email=payload.email)
    if existing_user:
        raise HTTPException(status_code=400, detail="该邮箱已被注册")
    
    hashed_pass = auth_service.get_password_hash(payload.password)
    # Default newly registered users to role "user"
    payload.role = "user"
    user = await user_repo.create_user(db, payload, hashed_password=hashed_pass)
    
    access_token = auth_service.create_access_token(user.id)
    return {"access_token": access_token, "token_type": "bearer", "role": user.role, "user": {"username": user.username, "email": user.email, "avatar": user.avatar_url, "plan": user.plan}}

@router.post("/login", response_model=Any)
async def login_access_token(
    request: Request,
    db: AsyncSession = Depends(get_db),
    form_data: OAuth2PasswordRequestForm = Depends()
) -> Any:
    """常规用户名/密码登录（Admin 或 普通用户）"""
    user = await user_repo.get_user_by_email_or_username(db, identifier=form_data.username)
    if not user or not user.hashed_password:
        raise HTTPException(status_code=400, detail="邮箱或密码错误")
    if not auth_service.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="邮箱或密码错误")
    if not user.is_active:
        raise HTTPException(status_code=400, detail="账户已被禁用")
    
    access_token = auth_service.create_access_token(user.id)
    
    from backend.service.stats_logger import log_user_action
    ip = request.client.host if request.client else None
    log_user_action(db, "login", user_id=user.id, ip_address=ip)

    return {"access_token": access_token, "token_type": "bearer", "role": user.role}

@router.post("/google", response_model=Any)
async def google_login(
    request: Request,
    payload: GoogleLogin,
    db: AsyncSession = Depends(get_db)
) -> Any:
    """Google 快捷登录，如果用户不存在则自动注册"""
    idinfo = auth_service.verify_google_token(payload.token)
    if not idinfo:
        raise HTTPException(status_code=400, detail="无效的 Google Token")
    
    email = idinfo.get("email")
    google_id = idinfo.get("sub")
    name = idinfo.get("name")
    picture = idinfo.get("picture")

    if not email:
        raise HTTPException(status_code=400, detail="Google 账号没有邮箱")
    
    # 根据 google_id 或 email 查找用户
    user = await user_repo.get_user_by_google_id(db, google_id)
    if not user:
        user = await user_repo.get_user_by_email(db, email)
        if user:
            # Email 存在但未绑定 Google ID，就绑定一下
            user.google_id = google_id
            user.avatar_url = picture
            db.add(user)
            await db.commit()
            await db.refresh(user)
        else:
            # 完全新用户，注册
            new_user = UserCreate(
                email=email,
                username=name,
                google_id=google_id,
                avatar_url=picture
            )
            user = await user_repo.create_user(db, new_user)
            
    access_token = auth_service.create_access_token(user.id)
    return {"access_token": access_token, "token_type": "bearer", "role": user.role, "user": {"username": user.username, "email": user.email, "avatar": user.avatar_url, "plan": user.plan}}

@router.get("/me", response_model=UserResponse)
async def read_current_user(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """获取当前已登录用户信息"""
    # ── Stripe 状态主动实时同步防 Webhook 滞后 ──
    if settings.STRIPE_API_KEY and current_user.stripe_subscription_id and not current_user.stripe_subscription_id.startswith("mock_"):
        try:
            import stripe
            stripe.api_key = settings.STRIPE_API_KEY
            subscription = stripe.Subscription.retrieve(current_user.stripe_subscription_id)
            if subscription.status not in ["active", "trialing"]:
                update_data = {
                    "plan": "free",
                    "plan_expires_at": None,
                    "stripe_subscription_id": None
                }
                await user_repo.update_user(db, current_user, update_data)
        except Exception as e:
            # 即使查询失败，也保持现状，不要报错以阻碍用户正常返回
            pass

    return current_user
