from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from uuid import uuid4

class MediaItemBase(BaseModel):
    media_type: str = Field(..., description="'video' or 'audio'")
    title: str
    series: Optional[str] = None
    category: str
    duration: Optional[str] = None
    teacher: Optional[str] = None
    description: Optional[str] = None
    cover_style: Optional[str] = None
    url: Optional[str] = None

class MediaItemCreate(MediaItemBase):
    id: Optional[str] = None # Allow providing id like 'v1' or 'a1' manually

class MediaItemUpdate(BaseModel):
    media_type: Optional[str] = None
    title: Optional[str] = None
    series: Optional[str] = None
    category: Optional[str] = None
    duration: Optional[str] = None
    teacher: Optional[str] = None
    description: Optional[str] = None
    cover_style: Optional[str] = None
    url: Optional[str] = None

class MediaItemOut(MediaItemBase):
    id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True
        from_attributes = True
