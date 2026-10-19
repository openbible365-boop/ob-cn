from sqlalchemy import Column, Integer, String, DateTime, Boolean
from sqlalchemy.sql import func
from backend.core.database import Base

class User(Base):
    """
    用户 ORM 模型，支持本地密码登录与 Google 第三方登录
    """
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=True)
    email = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=True)
    google_id = Column(String(255), unique=True, index=True, nullable=True)
    role = Column(String(20), default="user", nullable=False)  # "user" or "admin"
    avatar_url = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Stripe 支付与订阅计划字段
    plan = Column(String(50), default="free", nullable=False)  # "free", "basic", "pro", "supporter"
    plan_expires_at = Column(DateTime(timezone=True), nullable=True)
    stripe_customer_id = Column(String(255), nullable=True)
    stripe_subscription_id = Column(String(255), nullable=True)
