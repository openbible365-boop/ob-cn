from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class SupportPlanBase(BaseModel):
    name: str
    name_en: Optional[str] = None
    name_ko: Optional[str] = None
    price_monthly: float
    price_once: float
    badge: Optional[str] = None
    badge_en: Optional[str] = None
    badge_ko: Optional[str] = None
    features: str
    features_en: Optional[str] = None
    features_ko: Optional[str] = None
    dialogue_limit: int
    sort_order: int

class SupportPlanUpdate(BaseModel):
    name: Optional[str] = None
    name_en: Optional[str] = None
    name_ko: Optional[str] = None
    price_monthly: Optional[float] = None
    price_once: Optional[float] = None
    badge: Optional[str] = None
    badge_en: Optional[str] = None
    badge_ko: Optional[str] = None
    features: Optional[str] = None
    features_en: Optional[str] = None
    features_ko: Optional[str] = None
    dialogue_limit: Optional[int] = None
    sort_order: Optional[int] = None

class SupportPlanResponse(SupportPlanBase):
    id: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        orm_mode = True
        from_attributes = True
