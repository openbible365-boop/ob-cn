from sqlalchemy import Column, String, Text, Float, Integer, DateTime
from sqlalchemy.sql import func
from backend.core.database import Base

class SupportPlan(Base):
    """
    我们需要您的支持 - 订阅/支持套餐计划模型
    """
    __tablename__ = "support_plans"

    id = Column(String(50), primary_key=True, index=True)  # 例如 "free", "basic", "pro", "supporter"
    name = Column(String(100), nullable=False)             # 计划标题 (中文)，如 "基础计划"
    name_en = Column(String(100), nullable=True)           # 计划标题 (英文)
    name_ko = Column(String(100), nullable=True)           # 计划标题 (韩文)
    price_monthly = Column(Float, nullable=False, default=0.0)  # 连续每月支持价格 (USD)
    price_once = Column(Float, nullable=False, default=0.0)     # 单月单次支持价格 (USD)
    badge = Column(String(50), nullable=True)                   # 徽章，如 "热门" 或空
    badge_en = Column(String(50), nullable=True)                # 徽章 (英文)，如 "Popular"
    badge_ko = Column(String(50), nullable=True)                # 徽章 (韩文)，如 "인기"
    features = Column(Text, nullable=False)                     # 套餐包含的特性特征列表 (中文)，以 \n 分隔
    features_en = Column(Text, nullable=True)                   # 套餐包含的特性特征列表 (英文)，以 \n 分隔
    features_ko = Column(Text, nullable=True)                   # 套餐包含的特性特征列表 (韩文)，以 \n 分隔
    dialogue_limit = Column(Integer, nullable=False, default=20) # 对话次数配额上限
    sort_order = Column(Integer, default=0)                     # 排序权重
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
