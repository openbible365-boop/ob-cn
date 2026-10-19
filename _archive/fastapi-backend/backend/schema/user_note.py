from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class UserNoteBase(BaseModel):
    verseRef: str

class UserNoteCreate(BaseModel):
    verse_ref: str
    content: str

class UserNoteResponse(BaseModel):
    id: int
    user_id: int
    verse_ref: str
    content: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
