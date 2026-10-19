from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class EncyclopediaBase(BaseModel):
    entry_type: str  # 'dictionary' | 'article' | 'devotional'
    category: Optional[str] = None
    index_letter: Optional[str] = None
    cover_style: Optional[str] = None
    author: Optional[str] = None
    sort_order: Optional[int] = 0
    is_active: Optional[bool] = True

    title_zh: Optional[str] = None
    title_en: Optional[str] = None
    title_ko: Optional[str] = None
    summary_zh: Optional[str] = None
    summary_en: Optional[str] = None
    summary_ko: Optional[str] = None
    content_zh: Optional[str] = None
    content_en: Optional[str] = None
    content_ko: Optional[str] = None


class EncyclopediaCreate(EncyclopediaBase):
    id: Optional[str] = None  # 允许手动指定 id，否则自动 uuid


class EncyclopediaUpdate(BaseModel):
    entry_type: Optional[str] = None
    category: Optional[str] = None
    index_letter: Optional[str] = None
    cover_style: Optional[str] = None
    author: Optional[str] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None

    title_zh: Optional[str] = None
    title_en: Optional[str] = None
    title_ko: Optional[str] = None
    summary_zh: Optional[str] = None
    summary_en: Optional[str] = None
    summary_ko: Optional[str] = None
    content_zh: Optional[str] = None
    content_en: Optional[str] = None
    content_ko: Optional[str] = None


class EncyclopediaOut(EncyclopediaBase):
    id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True
        from_attributes = True


class EncyclopediaListItem(BaseModel):
    """列表轻量视图：仅含表格所需字段，不含 summary/content 长文，以减小列表负载。"""
    id: str
    entry_type: str
    category: Optional[str] = None
    index_letter: Optional[str] = None
    cover_style: Optional[str] = None
    author: Optional[str] = None
    sort_order: Optional[int] = 0
    is_active: Optional[bool] = True
    title_zh: Optional[str] = None
    title_en: Optional[str] = None
    title_ko: Optional[str] = None

    class Config:
        orm_mode = True
        from_attributes = True


class EncyclopediaPage(BaseModel):
    """分页列表响应。"""
    total: int
    items: list[EncyclopediaListItem]
