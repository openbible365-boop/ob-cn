from pydantic import BaseModel
from typing import Optional

class BookBase(BaseModel):
    version: str
    sn: int
    code: str
    full_name: str
    short_name: str
    chapter_count: int
    new_old: int = 0

class BookCreate(BookBase):
    pass

class BookUpdate(BaseModel):
    sn: Optional[int] = None
    code: Optional[str] = None
    full_name: Optional[str] = None
    short_name: Optional[str] = None
    chapter_count: Optional[int] = None
    new_old: Optional[int] = None

class BookResponse(BookBase):
    id: int

    class Config:
        from_attributes = True
